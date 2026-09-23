create index if not exists runs_round_started on public.runs(round_id,started_at);

-- Aggregates only: no participant names, identifiers or claim codes leave this function.
create or replace function public.staff_analytics(p_round uuid) returns jsonb
language sql stable set search_path=public as $$
with attempts as materialized (select * from runs where round_id=p_round),
players as (select participant_id,count(*) attempts from attempts group by participant_id),
accepted as (select * from attempts where finished_at is not null and score_points is not null),
activity as (
 select date_trunc('minute',started_at) as bucket_start,count(*) as starts
 from attempts group by 1 order by 1
)
select jsonb_build_object(
 'players',(select count(*) from players),
 'starts',(select count(*) from attempts),
 'accepted',(select count(*) from accepted),
 'repeatPlayers',(select count(*) from players where attempts>1),
 'totalTimeMs',(select coalesce(sum(time_ms),0) from accepted),
 'averageTimeMs',(select coalesce(avg(time_ms),0) from accepted),
 'bestScore',(select coalesce(max(score_points),0) from accepted),
 'passes',(select coalesce(sum(passes),0) from accepted),
 'vouchers',(select count(*) from prizes where round_id=p_round),
 'redeemed',(select count(*) from prizes where round_id=p_round and redeemed_at is not null),
 'activity',coalesce((select jsonb_agg(jsonb_build_object('minute',bucket_start,'starts',starts) order by bucket_start) from activity),'[]'::jsonb)
);
$$;
revoke all on function public.staff_analytics(uuid) from public,anon,authenticated;
grant execute on function public.staff_analytics(uuid) to service_role;
