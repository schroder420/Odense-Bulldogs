alter table public.rounds alter column prize set default '1 alm. fadøl / sodavand pr. vinder · Viggos Bar';
alter table public.rounds alter column pickup_instructions set default 'Indløses i Viggos Bar. Kun barpersonalet må swipe din voucher.';
update public.rounds set prize='1 alm. fadøl / sodavand pr. vinder · Viggos Bar',
 pickup_instructions='Indløses i Viggos Bar. Kun barpersonalet må swipe din voucher.'
 where status <> 'final';
