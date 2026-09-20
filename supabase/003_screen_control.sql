-- Existing rounds retain their leaderboard. RLS/service-role access is inherited.
alter table public.rounds
  add column if not exists screen_mode text not null default 'leaderboard'
    check (screen_mode in ('leaderboard','rules','info','winners')),
  add column if not exists screen_title text not null default 'Kampens info'
    check (length(screen_title)<=80),
  add column if not exists screen_body text not null default ''
    check (length(screen_body)<=500),
  add column if not exists pickup_instructions text not null default 'Vis dit præmiebevis til personalet for at hente dine billetter.'
    check (length(pickup_instructions)<=240);
