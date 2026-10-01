-- Start a planned competition immediately without changing its identity or duration.
create or replace function public.start_round_now(p_round uuid) returns jsonb
language plpgsql set search_path=public as $$
declare r public.rounds; started timestamptz;
begin
 select * into r from rounds where id=p_round for update;
 if r.id is null or r.status<>'open' then raise exception 'ROUND_CLOSED'; end if;
 started=clock_timestamp();
 -- Repeated clicks, or a scheduled start that just happened, must not reset the clock.
 if r.starts_at<=started then
  if r.ends_at<=started then raise exception 'ROUND_CLOSED'; end if;
  return jsonb_build_object('ok',true,'alreadyStarted',true);
 end if;
 update rounds set
  starts_at=started,
  ends_at=started+(r.ends_at-r.starts_at),
  cutoff_at=started+(r.cutoff_at-r.starts_at)
 where id=p_round;
 return jsonb_build_object('ok',true,'alreadyStarted',false);
end $$;
revoke all on function public.start_round_now(uuid) from public,anon,authenticated;
grant execute on function public.start_round_now(uuid) to service_role;
