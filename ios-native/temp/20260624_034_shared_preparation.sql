begin;

alter table public.schedule_tasks
  add column if not exists
    is_shared_prep boolean
    not null default false;

alter table public.schedule_tasks
  add column if not exists
    shared_prep_key text;

alter table public.schedule_tasks
  add column if not exists
    shared_prep_recipe_ids uuid[]
    not null default '{}'::uuid[];

alter table public.schedule_tasks
  add column if not exists
    shared_prep_recipe_names text[]
    not null default '{}'::text[];

alter table public.schedule_tasks
  add column if not exists
    shared_prep_task_ids uuid[]
    not null default '{}'::uuid[];

alter table public.schedule_tasks
  add column if not exists
    shared_prep_explanation text;

create index if not exists
  schedule_tasks_shared_prep_key_idx
on public.schedule_tasks(
  user_id,
  week_start,
  shared_prep_key
)
where is_shared_prep = true;

create index if not exists
  schedule_tasks_shared_recipe_ids_gin
on public.schedule_tasks
using gin(shared_prep_recipe_ids);

notify pgrst, 'reload schema';

commit;
