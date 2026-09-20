-- Samlet score = overlevelsestid + 1 point per gennemført aflevering, holdt i millisekund-skala.
-- 24.820 ms + 11 afleveringer * 1000 = 35.820 point, som vises som 35,82.
-- Kør efter 003_screen_control.sql. Kan køres igen uden skade.

-- 1. Kolonnen hed score_ms og indeholdt kun tid. Nu hedder den score_points og rummer begge dele.
do $$
begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='scores' and column_name='score_ms')
  then alter table public.scores rename column score_ms to score_points; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='runs' and column_name='score_ms')
  then alter table public.runs rename column score_ms to score_points; end if;
end $$;

alter table public.scores add column if not exists time_ms integer not null default 0;
alter table public.scores add column if not exists passes integer not null default 0;
alter table public.runs add column if not exists time_ms integer;
alter table public.runs add column if not exists passes integer;

-- Resultater fra spilversion 1-2 var ren overlevelsestid. De beholder deres værdi som tid.
update public.scores set time_ms=score_points where time_ms=0 and score_points>0;

-- 2. Den gamle grænse på 1.800.000 gjaldt kun tid. Afleveringspoint skal kunne være med.
do $$ declare c record;
begin
 for c in select conname,conrelid::regclass::text as tbl from pg_constraint
  where conrelid in ('public.runs'::regclass,'public.scores'::regclass) and contype='c' and pg_get_constraintdef(oid) ilike '%score%'
 loop execute format('alter table %s drop constraint %I',c.tbl,c.conname); end loop;
end $$;
alter table public.runs add constraint runs_score_points_check check(score_points is null or score_points between 0 and 12000000);
alter table public.scores add constraint scores_score_points_check check(score_points between 0 and 12000000);

-- 3. Serveren afleverer både point, tid og antal afleveringer. Databasen kontrollerer at de hænger sammen.
drop function if exists public.finish_run(uuid,uuid,integer);
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
 if r.status='final' or now()>r.cutoff_at+interval '20 seconds' then raise exception 'ROUND_FINAL'; end if;
 if p_passes<0 or p_passes>6000 then raise exception 'INVALID_TIME'; end if;
 if p_time<0 or p_time>extract(epoch from (least(now()+interval '1 second',r.cutoff_at)-run.started_at))*1000 then raise exception 'INVALID_TIME'; end if;
 -- Point må hverken være mindre end tiden eller mere end tiden plus et point per aflevering.
 if p_points<p_time or p_points>p_time+p_passes*1000 then raise exception 'INVALID_TIME'; end if;
 update runs set finished_at=now(),score_points=p_points,time_ms=p_time,passes=p_passes where id=p_run;
 insert into scores(round_id,participant_id,score_points,time_ms,passes) values(run.round_id,p_player,p_points,p_time,p_passes)
 on conflict(round_id,participant_id) do update set score_points=excluded.score_points,time_ms=excluded.time_ms,passes=excluded.passes,achieved_at=now() where excluded.score_points>scores.score_points;
 select score_points into best from scores where round_id=run.round_id and participant_id=p_player;
 return jsonb_build_object('score',p_points,'best',best);
end $$;

-- 4. Rangering og storskærm følger point. Tid og afleveringer følger med, så publikum kan se regnestykket.
create or replace function public.public_board() returns jsonb language sql stable set search_path=public as $$
 with r as (select * from rounds order by starts_at desc limit 1),
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

create or replace function public.finalize_round(p_round uuid,p_claims jsonb) returns void language plpgsql set search_path=public as $$
declare r public.rounds; winner record; supplied text;
begin
 select * into r from rounds where id=p_round for update;
 if r.id is null or r.status='final' then raise exception 'INVALID_ROUND'; end if;
 if now()<r.cutoff_at+interval '20 seconds' then raise exception 'WAIT_FOR_RUNS'; end if;
 for winner in
   select s.participant_id,row_number() over(order by s.score_points desc,s.achieved_at,s.participant_id) place
   from scores s join participants p on p.id=s.participant_id where s.round_id=p_round and not p.hidden
   order by s.score_points desc,s.achieved_at,s.participant_id limit 5
 loop
   supplied=p_claims->>winner.participant_id::text;
   if supplied is null or length(supplied)<>64 then raise exception 'WINNERS_CHANGED'; end if;
   insert into prizes(round_id,participant_id,rank,claim_hash) values(p_round,winner.participant_id,winner.place,supplied);
 end loop;
 update rounds set status='final',finalized_at=now() where id=p_round;
end $$;

revoke all on function public.finish_run(uuid,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.finish_run(uuid,uuid,integer,integer,integer) to service_role;
revoke all on function public.public_board(),public.finalize_round(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.public_board(),public.finalize_round(uuid,jsonb) to service_role;
