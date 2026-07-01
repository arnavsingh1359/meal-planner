begin;

alter table public.schedule_tasks
  add column if not exists batch_id uuid;

alter table public.schedule_tasks
  add column if not exists batch_servings numeric
  not null default 1;

alter table public.schedule_tasks
  add column if not exists batch_meal_count integer
  not null default 1;

alter table public.schedule_tasks
  add column if not exists batch_explanation text;

alter table public.schedule_tasks
  add column if not exists covered_week_plan_entry_ids uuid[]
  not null default '{}'::uuid[];

update public.schedule_tasks
set
  batch_servings = coalesce(batch_servings, 1),
  batch_meal_count = coalesce(batch_meal_count, 1),
  covered_week_plan_entry_ids =
    case
      when covered_week_plan_entry_ids is null
        or cardinality(covered_week_plan_entry_ids) = 0
      then array[week_plan_entry_id]
      else covered_week_plan_entry_ids
    end;

alter table public.schedule_tasks
  drop constraint if exists schedule_tasks_batch_servings_check;

alter table public.schedule_tasks
  add constraint schedule_tasks_batch_servings_check
  check (batch_servings > 0);

alter table public.schedule_tasks
  drop constraint if exists schedule_tasks_batch_meal_count_check;

alter table public.schedule_tasks
  add constraint schedule_tasks_batch_meal_count_check
  check (batch_meal_count > 0);

create index if not exists schedule_tasks_batch_id_idx
on public.schedule_tasks(batch_id)
where batch_id is not null;

create index if not exists schedule_tasks_covered_entries_gin
on public.schedule_tasks
using gin(covered_week_plan_entry_ids);

notify pgrst, 'reload schema';

commit;
