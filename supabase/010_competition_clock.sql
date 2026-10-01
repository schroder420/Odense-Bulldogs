-- Run in Supabase SQL editor after 009. Requires Supabase Cron (pg_cron >= 1.6).
create extension if not exists pg_cron;
select cron.schedule('bulldogs-competition-clock','1 second','select public.advance_competitions()');
-- Keep this app's per-second job history bounded on the free database.
select cron.schedule('bulldogs-clock-history','15 * * * *',
 $$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname='bulldogs-competition-clock') and end_time < now()-interval '1 day'$$);
-- Staff can check installation without receiving access to Cron's other jobs.
create or replace function public.competition_clock_ready() returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from cron.job where jobname='bulldogs-competition-clock' and active and schedule='1 second');
$$;
revoke all on function public.competition_clock_ready() from public,anon,authenticated;
grant execute on function public.competition_clock_ready() to service_role;
