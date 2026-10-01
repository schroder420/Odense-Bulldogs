-- Apply after 008. Existing rounds keep legacy deadlines and vouchers.
-- Then install 010 for browser-independent automatic finalization.
begin;
alter table public.rounds add column if not exists timing_version integer not null default 1 check(timing_version in (1,2));
alter table public.rounds add column if not exists screen_rotation boolean not null default false;
alter table public.prizes add column if not exists claim_code text check(claim_code is null or claim_code ~ '^[A-F0-9]{24}$');
create or replace function public.start_round_run(p_player uuid,p_seed bigint,p_round uuid) returns jsonb language plpgsql set search_path=public as $$
declare r public.rounds; run public.runs; recent timestamptz;
begin
 perform 1 from participants where id=p_player for update;
 if not found then raise exception 'PLAYER_MISSING'; end if;
 select * into r from rounds where status='open' and starts_at<=clock_timestamp() and ends_at>clock_timestamp() and (p_round is null or id=p_round) order by starts_at desc limit 1 for share;
 if r.id is null then raise exception 'ROUND_CLOSED'; end if;
 select max(started_at) into recent from runs where participant_id=p_player;
 if recent>now()-interval '3 seconds' then raise exception 'TOO_FAST'; end if;
 update runs set finished_at=now() where participant_id=p_player and finished_at is null;
 insert into runs(participant_id,round_id,seed) values(p_player,r.id,p_seed) returning * into run;
 return jsonb_build_object('run',to_jsonb(run),'round',to_jsonb(r));
end $$;


create or replace function public.start_run(p_player uuid,p_seed bigint) returns jsonb language sql set search_path=public as $$
 select start_round_run(p_player,p_seed,null);
$$;
create or replace function public.finish_run(p_run uuid,p_player uuid,p_points integer,p_time integer,p_passes integer) returns jsonb language plpgsql set search_path=public as $$
declare r public.rounds; run public.runs; best integer;
begin
 -- Same lock order as start_run. Round share lock serializes against finalization.
 perform 1 from participants where id=p_player for update;
 select * into run from runs where id=p_run and participant_id=p_player;
 if run.id is null then raise exception 'RUN_MISSING'; end if;
 select * into r from rounds where id=run.round_id for share;
 select * into run from runs where id=p_run for update;
 if run.finished_at is not null then
   if run.score_points is null then raise exception 'RUN_REPLACED'; end if;
   return jsonb_build_object('score',run.score_points,'duplicate',true);
 end if;
 if r.status='final' or clock_timestamp()>=r.cutoff_at+(case when r.timing_version=2 then interval '0 seconds' else interval '20 seconds' end) then raise exception 'ROUND_FINAL'; end if;
 if p_passes<0 or p_passes>6000 then raise exception 'INVALID_TIME'; end if;
 -- started_at har mikrosekunder, men serveren regner forsoegets slutfrist ud fra tider afkortet
 -- til hele millisekunder. Afkortningen goer serverens frist op til 1 ms laengere end databasens,
 -- og uden ceil() ville naesten hvert eneste slutfloejt blive afvist som ugyldig tid.
 if p_time<0 or p_time>ceil(extract(epoch from (least(clock_timestamp()+interval '1 second',case when r.timing_version=2 then r.ends_at else r.cutoff_at end)-run.started_at))*1000) then raise exception 'INVALID_TIME'; end if;
 -- Point må hverken være mindre end tiden eller mere end tiden plus et point per aflevering.
 if p_points<p_time or p_points>p_time+p_passes*1000 then raise exception 'INVALID_TIME'; end if;
 update runs set finished_at=now(),score_points=p_points,time_ms=p_time,passes=p_passes where id=p_run;
 insert into scores(round_id,participant_id,score_points,time_ms,passes) values(run.round_id,p_player,p_points,p_time,p_passes)
 on conflict(round_id,participant_id) do update set score_points=excluded.score_points,time_ms=excluded.time_ms,passes=excluded.passes,achieved_at=now() where excluded.score_points>scores.score_points;
 select score_points into best from scores where round_id=run.round_id and participant_id=p_player;
 return jsonb_build_object('score',p_points,'best',best);
end $$;

create or replace function public.round_board(p_round uuid) returns jsonb language sql stable set search_path=public as $$
 with r as (select * from rounds where id=p_round),
 ranked as (
 select s.participant_id,s.score_points,s.time_ms,s.passes,p.nickname,row_number() over(order by s.score_points desc,s.achieved_at,s.participant_id) as rank
 from scores s join participants p on p.id=s.participant_id join r on r.id=s.round_id where not p.hidden
 ), final_ranked as (
 select pr.participant_id,s.score_points,s.time_ms,s.passes,case when p.hidden then 'Bulldogs-fan' else p.nickname end nickname,pr.rank
 from prizes pr join r on r.id=pr.round_id join participants p on p.id=pr.participant_id
 join scores s on s.round_id=pr.round_id and s.participant_id=pr.participant_id
 ), entries as (
 select * from ranked where (select status from r)<>'final' and rank<=10
 union all select * from final_ranked where (select status from r)='final'
 )
 select jsonb_build_object('round',(select to_jsonb(r) from r),'entries',coalesce((select jsonb_agg(to_jsonb(e) order by rank) from entries e),'[]'::jsonb),
 'participants',(select count(*) from scores where round_id=(select id from r)),'serverTime',now());
$$;


create or replace function public.public_board() returns jsonb language sql stable set search_path=public as $$
 select round_board((select id from rounds order by starts_at desc limit 1));
$$;
-- Atomic round lock serializes finalization against finish_run's share lock.
-- Claim codes are generated here so neither an open browser nor a Vercel secret is required.
create or replace function public.advance_competitions() returns void language plpgsql set search_path=public as $$
declare r public.rounds; winner record; code text;
begin
 for r in select * from rounds where timing_version=2 and status<>'final' and cutoff_at<=clock_timestamp() for update skip locked
 loop
  for winner in
   select s.participant_id,row_number() over(order by s.score_points desc,s.achieved_at,s.participant_id) place
   from scores s join participants p on p.id=s.participant_id where s.round_id=r.id and not p.hidden
   order by s.score_points desc,s.achieved_at,s.participant_id limit 5
  loop
   code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,24));
   insert into prizes(round_id,participant_id,rank,claim_code,claim_hash)
   values(r.id,winner.participant_id,winner.place,code,encode(sha256(convert_to(code,'UTF8')),'hex'));
  end loop;
  update rounds set status='final',finalized_at=clock_timestamp(),screen_mode='winners',screen_rotation=false where id=r.id;
 end loop;
end $$;
revoke all on function public.start_round_run(uuid,bigint,uuid),public.round_board(uuid),public.advance_competitions() from public,anon,authenticated;
grant execute on function public.start_round_run(uuid,bigint,uuid),public.round_board(uuid),public.advance_competitions() to service_role;
commit;
