begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        week_plan_entry_id,
        recipe_task_id
      order by
        created_at,
        id
    ) as row_number
  from public.schedule_tasks
  where recipe_task_id is not null
)
delete from public.schedule_tasks
where id in (
  select id
  from ranked
  where row_number > 1
);

with ranked as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        week_plan_entry_id,
        title,
        position
      order by
        created_at,
        id
    ) as row_number
  from public.schedule_tasks
  where recipe_task_id is null
)
delete from public.schedule_tasks
where id in (
  select id
  from ranked
  where row_number > 1
);

create unique index if not exists
  schedule_tasks_unique_recipe_task
on public.schedule_tasks (
  user_id,
  week_plan_entry_id,
  recipe_task_id
)
where recipe_task_id is not null;

create unique index if not exists
  schedule_tasks_unique_fallback_task
on public.schedule_tasks (
  user_id,
  week_plan_entry_id,
  title,
  position
)
where recipe_task_id is null;

commit;
