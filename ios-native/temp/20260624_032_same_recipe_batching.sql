begin;

alter table public.schedule_tasks
  add column if not exists batch_id uuid;

alter table public.schedule_tasks
  add column if not exists batch_servings numeric
  not null default 1
  check (batch_servings > 0);

alter table public.schedule_tasks
  add column if not exists batch_meal_count integer
  not null default 1
  check (batch_meal_count > 0);

alter table public.schedule_tasks
  add column if not exists batch_explanation text;

alter table public.schedule_tasks
  add column if not exists
    covered_week_plan_entry_ids uuid[]
    not null default '{}'::uuid[];

update public.schedule_tasks
set
  batch_servings = 1,
  batch_meal_count = 1,
  covered_week_plan_entry_ids =
    array[week_plan_entry_id]
where cardinality(
  covered_week_plan_entry_ids
) = 0;

create index if not exists
  schedule_tasks_batch_id_idx
on public.schedule_tasks(batch_id)
where batch_id is not null;

create index if not exists
  schedule_tasks_covered_entries_gin
on public.schedule_tasks
using gin(covered_week_plan_entry_ids);

commit;
