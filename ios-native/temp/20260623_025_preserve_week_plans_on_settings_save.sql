begin;

create or replace function
  public.save_scheduler_settings(
    p_global jsonb,
    p_days jsonb,
    p_slots jsonb
  )
returns void
language plpgsql
security invoker
set search_path = public
as $function$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.scheduler_preferences (
    user_id,
    conflict_grouping_minutes,
    preferred_batch_days,
    preserve_manual_adjustments
  )
  values (
    current_user_id,
    (
      p_global
        ->> 'conflict_grouping_minutes'
    )::integer,
    array(
      select jsonb_array_elements_text(
        p_global
          -> 'preferred_batch_days'
      )
    ),
    (
      p_global
        ->> 'preserve_manual_adjustments'
    )::boolean
  )
  on conflict (user_id)
  do update set
    conflict_grouping_minutes =
      excluded.conflict_grouping_minutes,
    preferred_batch_days =
      excluded.preferred_batch_days,
    preserve_manual_adjustments =
      excluded.preserve_manual_adjustments;

  insert into public.day_schedule_preferences (
    user_id,
    day_of_week,
    earliest_task_time,
    latest_task_time,
    leave_home_time,
    return_home_time,
    evening_prep_start,
    evening_prep_end,
    max_active_cooking_minutes,
    cooking_allowed
  )
  select
    current_user_id,
    values.day_of_week,
    values.earliest_task_time::time,
    values.latest_task_time::time,
    values.leave_home_time::time,
    values.return_home_time::time,
    values.evening_prep_start::time,
    values.evening_prep_end::time,
    values.max_active_cooking_minutes,
    values.cooking_allowed
  from jsonb_to_recordset(
    p_days
  ) as values(
    day_of_week integer,
    earliest_task_time text,
    latest_task_time text,
    leave_home_time text,
    return_home_time text,
    evening_prep_start text,
    evening_prep_end text,
    max_active_cooking_minutes integer,
    cooking_allowed boolean
  )
  on conflict (
    user_id,
    day_of_week
  )
  do update set
    earliest_task_time =
      excluded.earliest_task_time,
    latest_task_time =
      excluded.latest_task_time,
    leave_home_time =
      excluded.leave_home_time,
    return_home_time =
      excluded.return_home_time,
    evening_prep_start =
      excluded.evening_prep_start,
    evening_prep_end =
      excluded.evening_prep_end,
    max_active_cooking_minutes =
      excluded.max_active_cooking_minutes,
    cooking_allowed =
      excluded.cooking_allowed;

  -- Move existing positions out of the way so reordered slots
  -- can be upserted without violating the per-day position constraint.
  update public.meal_slot_preferences
  set position = position + 10000
  where user_id = current_user_id;

  insert into public.meal_slot_preferences (
    id,
    user_id,
    day_of_week,
    position,
    name,
    recipe_category,
    eat_time,
    ready_time,
    preparation_mode
  )
  select
    values.id,
    current_user_id,
    values.day_of_week,
    values.position,
    trim(values.name),
    values.recipe_category,
    values.eat_time::time,
    values.ready_time::time,
    values.preparation_mode
  from jsonb_to_recordset(
    p_slots
  ) as values(
    id uuid,
    day_of_week integer,
    position integer,
    name text,
    recipe_category text,
    eat_time text,
    ready_time text,
    preparation_mode text
  )
  on conflict (id)
  do update set
    day_of_week =
      excluded.day_of_week,
    position =
      excluded.position,
    name =
      excluded.name,
    recipe_category =
      excluded.recipe_category,
    eat_time =
      excluded.eat_time,
    ready_time =
      excluded.ready_time,
    preparation_mode =
      excluded.preparation_mode
  where
    meal_slot_preferences.user_id
      = current_user_id;

  -- Only genuinely removed slots are deleted. Unchanged slots keep
  -- their UUIDs, so Week plan entries are no longer cascade-deleted
  -- whenever Settings is saved.
  delete from public.meal_slot_preferences
  where user_id = current_user_id
    and id not in (
      select values.id
      from jsonb_to_recordset(
        p_slots
      ) as values(id uuid)
    );
end;
$function$;

revoke all
on function
  public.save_scheduler_settings(
    jsonb,
    jsonb,
    jsonb
  )
from public;

grant execute
on function
  public.save_scheduler_settings(
    jsonb,
    jsonb,
    jsonb
  )
to authenticated;

commit;
