begin;

alter table public.account_preferences
  add column if not exists
    suppress_non_severe_warnings boolean
    not null default false;

update public.account_preferences
set suppress_non_severe_warnings = false
where suppress_non_severe_warnings is null;

commit;
