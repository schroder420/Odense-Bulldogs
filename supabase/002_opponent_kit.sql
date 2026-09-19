-- Run after 001_initial.sql. Existing rounds keep the default opponent kit.
alter table public.rounds add column if not exists opponent_name text not null default 'Modstanderne' check(char_length(opponent_name) between 2 and 40);
alter table public.rounds add column if not exists opponent_primary text not null default '#24364B' check(opponent_primary ~ '^#[0-9a-fA-F]{6}$');
alter table public.rounds add column if not exists opponent_stripe text not null default '#E48331' check(opponent_stripe ~ '^#[0-9a-fA-F]{6}$');
alter table public.runs add column if not exists game_version integer not null default 1;
