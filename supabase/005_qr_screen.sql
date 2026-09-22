-- Run after 003_screen_control.sql. No access or score changes.
alter table public.rounds drop constraint if exists rounds_screen_mode_check;
alter table public.rounds add constraint rounds_screen_mode_check
  check (screen_mode in ('leaderboard','rules','info','winners','qr'));
