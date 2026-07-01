begin;

create or replace function
  public.recalculate_recipe_times(
    p_recipe_id uuid
  )
returns void
language plpgsql
set search_path = public
as $function$
declare
  v_task_count integer;
  v_preparation integer;
  v_cooking integer;
  v_cleanup integer;
begin
  select count(*)
  into v_task_count
  from public.recipe_tasks
  where recipe_id = p_recipe_id;

  if v_task_count > 0 then
    select
      coalesce(
        sum(active_minutes + passive_minutes)
          filter (
            where task_type not in (
              'cooking',
              'cleanup'
            )
          ),
        0
      ),
      coalesce(
        sum(active_minutes + passive_minutes)
          filter (
            where task_type = 'cooking'
          ),
        0
      ),
      coalesce(
        sum(active_minutes + passive_minutes)
          filter (
            where task_type = 'cleanup'
          ),
        0
      )
    into
      v_preparation,
      v_cooking,
      v_cleanup
    from public.recipe_tasks
    where recipe_id = p_recipe_id;
  else
    -- A recipe without inferred tasks still gets a usable time
    -- from its entered step durations. Once tasks are generated,
    -- the more specific task-type calculation above takes over.
    select
      coalesce(
        sum(duration_minutes),
        0
      )
    into v_preparation
    from public.recipe_steps
    where recipe_id = p_recipe_id;

    v_cooking := 0;
    v_cleanup := 0;
  end if;

  update public.recipes
  set
    preparation_minutes = v_preparation,
    cooking_minutes = v_cooking,
    cleanup_minutes = v_cleanup,
    updated_at = now()
  where id = p_recipe_id;
end;
$function$;

create or replace function
  public.sync_recipe_times_from_tasks()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE'
    and old.recipe_id is distinct from new.recipe_id then
    perform public.recalculate_recipe_times(
      old.recipe_id
    );
  end if;

  perform public.recalculate_recipe_times(
    coalesce(
      new.recipe_id,
      old.recipe_id
    )
  );

  return coalesce(new, old);
end;
$function$;

create or replace function
  public.sync_recipe_times_from_steps()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE'
    and old.recipe_id is distinct from new.recipe_id then
    perform public.recalculate_recipe_times(
      old.recipe_id
    );
  end if;

  perform public.recalculate_recipe_times(
    coalesce(
      new.recipe_id,
      old.recipe_id
    )
  );

  return coalesce(new, old);
end;
$function$;

drop trigger if exists
  recipe_tasks_sync_recipe_times
on public.recipe_tasks;

create trigger
  recipe_tasks_sync_recipe_times
after insert or update or delete
on public.recipe_tasks
for each row
execute function
  public.sync_recipe_times_from_tasks();

drop trigger if exists
  recipe_steps_sync_recipe_times
on public.recipe_steps;

create trigger
  recipe_steps_sync_recipe_times
after insert or update or delete
on public.recipe_steps
for each row
execute function
  public.sync_recipe_times_from_steps();

do $block$
declare
  v_recipe_id uuid;
begin
  for v_recipe_id in
    select id
    from public.recipes
  loop
    perform public.recalculate_recipe_times(
      v_recipe_id
    );
  end loop;
end;
$block$;

commit;
