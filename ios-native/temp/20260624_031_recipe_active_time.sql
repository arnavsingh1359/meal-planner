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
        sum(active_minutes)
          filter (
            where task_type not in (
              'cooking',
              'cleanup'
            )
          ),
        0
      ),
      coalesce(
        sum(active_minutes)
          filter (
            where task_type = 'cooking'
          ),
        0
      ),
      coalesce(
        sum(active_minutes)
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
    -- Use only plausible hands-on step durations as a fallback.
    -- Long durations are treated as passive waiting and excluded.
    select
      coalesce(
        sum(duration_minutes)
          filter (
            where duration_minutes <= 180
          ),
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
