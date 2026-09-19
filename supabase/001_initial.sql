-- Run once in the Supabase SQL editor. All data access is server-side.
create table public.rounds (
 id uuid primary key default gen_random_uuid(), title text not null default 'Kampens pause',
 status text not null default 'open' check(status in ('open','closing','final')),
 starts_at timestamptz not null default now(), ends_at timestamptz not null,
 cutoff_at timestamptz not null, finalized_at timestamptz,
 prize text not null default 'Præmie til top 5', check(cutoff_at >= ends_at)
);
create unique index one_unfinished_round on public.rounds ((true)) where status <> 'final';
create table public.participants (
 id uuid primary key, nickname text not null check(char_length(nickname) between 2 and 18),
 hidden boolean not null default false, created_at timestamptz not null default now()
);
create table public.runs (
 id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.participants,
 round_id uuid not null references public.rounds, seed bigint not null,
 started_at timestamptz not null default now(), finished_at timestamptz, score_ms integer,
 check(score_ms is null or score_ms between 0 and 1800000)
);
create index run_player_time on public.runs(participant_id,started_at desc);
create table public.scores (
 round_id uuid not null references public.rounds, participant_id uuid not null references public.participants,
 score_ms integer not null, achieved_at timestamptz not null default now(),
 primary key(round_id,participant_id)
);
create index ranking_order on public.scores(round_id,score_ms desc,achieved_at,participant_id);
create table public.prizes (
 round_id uuid not null references public.rounds, participant_id uuid not null references public.participants,
 rank integer not null check(rank between 1 and 5), claim_hash text not null unique,
 redeemed_at timestamptz, created_at timestamptz not null default now(), primary key(round_id,participant_id), unique(round_id,rank)
);
create table public.admin_attempts (bucket text primary key, attempts integer not null default 1, expires_at timestamptz not null);
alter table public.rounds enable row level security;
alter table public.participants enable row level security;
alter table public.runs enable row level security;
alter table public.scores enable row level security;
alter table public.prizes enable row level security;
alter table public.admin_attempts enable row level security;
revoke all on public.rounds,public.participants,public.runs,public.scores,public.prizes,public.admin_attempts from anon,authenticated;
grant all on public.rounds,public.participants,public.runs,public.scores,public.prizes,public.admin_attempts to service_role;

create function public.start_run(p_player uuid,p_seed bigint) returns jsonb language plpgsql set search_path=public as $$
declare r public.rounds; run public.runs; recent timestamptz;
begin
 perform 1 from participants where id=p_player for update;
 if not found then raise exception 'PLAYER_MISSING'; end if;
 select * into r from rounds where status='open' and ends_at>now() order by starts_at desc limit 1 for share;
 if r.id is null then raise exception 'ROUND_CLOSED'; end if;
 select max(started_at) into recent from runs where participant_id=p_player;
 if recent>now()-interval '3 seconds' then raise exception 'TOO_FAST'; end if;
 update runs set finished_at=now() where participant_id=p_player and finished_at is null;
 insert into runs(participant_id,round_id,seed) values(p_player,r.id,p_seed) returning * into run;
 return jsonb_build_object('run',to_jsonb(run),'round',to_jsonb(r));
end $$;

create function public.finish_run(p_run uuid,p_player uuid,p_score integer) returns jsonb language plpgsql set search_path=public as $$
declare r public.rounds; run public.runs; best integer;
begin
 -- Same lock order as start_run. Round share lock serializes against finalization.
 perform 1 from participants where id=p_player for update;
 select * into run from runs where id=p_run and participant_id=p_player;
 if run.id is null then raise exception 'RUN_MISSING'; end if;
 select * into r from rounds where id=run.round_id for share;
 select * into run from runs where id=p_run for update;
 if run.finished_at is not null then
   if run.score_ms is null then raise exception 'RUN_REPLACED'; end if;
   return jsonb_build_object('score',run.score_ms,'duplicate',true);
 end if;
 if r.status='final' or now()>r.cutoff_at+interval '20 seconds' then raise exception 'ROUND_FINAL'; end if;
 if p_score<0 or p_score>extract(epoch from (least(now()+interval '1 second',r.cutoff_at)-run.started_at))*1000 then raise exception 'INVALID_TIME'; end if;
 update runs set finished_at=now(),score_ms=p_score where id=p_run;
 insert into scores(round_id,participant_id,score_ms) values(run.round_id,p_player,p_score)
 on conflict(round_id,participant_id) do update set score_ms=excluded.score_ms,achieved_at=now() where excluded.score_ms>scores.score_ms;
 select score_ms into best from scores where round_id=run.round_id and participant_id=p_player;
 return jsonb_build_object('score',p_score,'best',best);
end $$;

create function public.public_board() returns jsonb language sql stable set search_path=public as $$
 with r as (select * from rounds order by starts_at desc limit 1),
 ranked as (
 select s.participant_id,s.score_ms,p.nickname,row_number() over(order by s.score_ms desc,s.achieved_at,s.participant_id) as rank
 from scores s join participants p on p.id=s.participant_id join r on r.id=s.round_id where not p.hidden
 ), final_ranked as (
 select pr.participant_id,s.score_ms,case when p.hidden then 'Bulldogs-fan' else p.nickname end nickname,pr.rank
 from prizes pr join r on r.id=pr.round_id join participants p on p.id=pr.participant_id
 join scores s on s.round_id=pr.round_id and s.participant_id=pr.participant_id
 ), entries as (
 select * from ranked where (select status from r)<>'final' and rank<=10
 union all select * from final_ranked where (select status from r)='final'
 )
 select jsonb_build_object('round',(select to_jsonb(r) from r),'entries',coalesce((select jsonb_agg(to_jsonb(e) order by rank) from entries e),'[]'::jsonb),
 'participants',(select count(*) from scores where round_id=(select id from r)),'serverTime',now());
$$;

create function public.finalize_round(p_round uuid,p_claims jsonb) returns void language plpgsql set search_path=public as $$
declare r public.rounds; winner record; supplied text;
begin
 select * into r from rounds where id=p_round for update;
 if r.id is null or r.status='final' then raise exception 'INVALID_ROUND'; end if;
 if now()<r.cutoff_at+interval '20 seconds' then raise exception 'WAIT_FOR_RUNS'; end if;
 for winner in
   select s.participant_id,row_number() over(order by s.score_ms desc,s.achieved_at,s.participant_id) place
   from scores s join participants p on p.id=s.participant_id where s.round_id=p_round and not p.hidden
   order by s.score_ms desc,s.achieved_at,s.participant_id limit 5
 loop
   supplied=p_claims->>winner.participant_id::text;
   if supplied is null or length(supplied)<>64 then raise exception 'WINNERS_CHANGED'; end if;
   insert into prizes(round_id,participant_id,rank,claim_hash) values(p_round,winner.participant_id,winner.place,supplied);
 end loop;
 update rounds set status='final',finalized_at=now() where id=p_round;
end $$;

create function public.redeem_prize(p_hash text) returns jsonb language plpgsql set search_path=public as $$
declare prize public.prizes; name text;
begin
 select * into prize from prizes where claim_hash=p_hash for update;
 if prize.round_id is null then raise exception 'INVALID_CLAIM'; end if;
 if prize.redeemed_at is not null then raise exception 'ALREADY_REDEEMED'; end if;
 update prizes set redeemed_at=now() where claim_hash=p_hash;
 select nickname into name from participants where id=prize.participant_id;
 return jsonb_build_object('nickname',name,'rank',prize.rank,'redeemed',true);
end $$;

create function public.admin_rate_limit(p_bucket text) returns boolean language plpgsql set search_path=public as $$
declare n integer;
begin
 insert into admin_attempts(bucket,expires_at) values(p_bucket,now()+interval '15 minutes')
 on conflict(bucket) do update set attempts=case when admin_attempts.expires_at<now() then 1 else admin_attempts.attempts+1 end,
 expires_at=case when admin_attempts.expires_at<now() then now()+interval '15 minutes' else admin_attempts.expires_at end returning attempts into n;
 return n<=10;
end $$;

revoke all on function public.start_run(uuid,bigint), public.finish_run(uuid,uuid,integer),public.public_board(),public.finalize_round(uuid,jsonb),public.redeem_prize(text),public.admin_rate_limit(text) from public,anon,authenticated;
grant execute on function public.start_run(uuid,bigint), public.finish_run(uuid,uuid,integer),public.public_board(),public.finalize_round(uuid,jsonb),public.redeem_prize(text),public.admin_rate_limit(text) to service_role;
