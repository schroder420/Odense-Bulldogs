-- Standardpræmie til nye runder. Bevar allerede fastlåste præmier.
alter table public.rounds alter column prize set default '1 alm. fadøl eller sodavand pr. vinder · Viggos Bar';

update public.rounds
set prize = '1 alm. fadøl eller sodavand pr. vinder · Viggos Bar'
where status <> 'final'
  and prize in ('Præmie til top 5', '2 ølbilletter til hver i top 5', '1 alm. fadøl / sodavand pr. vinder · Viggos Bar');
