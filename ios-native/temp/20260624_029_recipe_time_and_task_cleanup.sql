begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        recipe_id,
        position
      order by
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as row_number
  from public.recipe_tasks
)
delete from public.recipe_tasks
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
        recipe_id,
        source_step_positions,
        lower(trim(title))
      order by
        updated_at desc nulls last,
        created_at desc nulls last,
        position,
        id
    ) as row_number
  from public.recipe_tasks
  where cardinality(source_step_positions) > 0
)
delete from public.recipe_tasks
where id in (
  select id
  from ranked
  where row_number > 1
);

create unique index if not exists
  recipe_tasks_recipe_position_unique
on public.recipe_tasks (
  recipe_id,
  position
);

create unique index if not exists
  recipe_tasks_recipe_source_title_unique
on public.recipe_tasks (
  recipe_id,
  source_step_positions,
  lower(trim(title))
)
where cardinality(source_step_positions) > 0;

update public.recipe_steps
set duration_minutes =
  case
    when duration_minutes <= 0
      then 0
    else greatest(
      5,
      round(
        duration_minutes::numeric
        / 5
      )::integer * 5
    )
  end;

commit;
