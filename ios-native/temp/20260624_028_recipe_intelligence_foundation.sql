begin;

-- Remove the abandoned first-generation planning stack.
drop table if exists public.scheduled_tasks cascade;
drop table if exists public.cooking_blocks cascade;
drop table if exists public.planned_meal_recipes cascade;
drop table if exists public.planned_meals cascade;
drop table if exists public.weekly_plans cascade;
drop table if exists public.user_settings cascade;

drop function if exists public.validate_planned_meal_recipe_owner() cascade;
drop function if exists public.validate_scheduled_task_owner() cascade;
drop function if exists public.set_user_settings_updated_at() cascade;
drop function if exists public.set_planned_meal_recipe_updated_at() cascade;

-- Servings can be selected in half-serving increments.
alter table public.recipes
  alter column default_servings type numeric(8,2)
    using default_servings::numeric,
  alter column minimum_batch_servings type numeric(8,2)
    using minimum_batch_servings::numeric,
  alter column maximum_batch_servings type numeric(8,2)
    using maximum_batch_servings::numeric;

-- Ingredient behavior used by serving scaling, pantry, and shopping.
alter table public.recipe_ingredients
  add column if not exists scaling_behavior text not null default 'linear',
  add column if not exists shopping_included boolean not null default true,
  add column if not exists preparation_state text;

alter table public.recipe_ingredients
  drop constraint if exists recipe_ingredients_scaling_behavior_check;

alter table public.recipe_ingredients
  add constraint recipe_ingredients_scaling_behavior_check
  check (scaling_behavior in ('linear', 'fixed', 'to_taste'));

-- Generated scheduling metadata. Original recipe steps remain authoritative.
alter table public.recipe_tasks
  add column if not exists source_step_positions integer[] not null default '{}',
  add column if not exists inference_source text not null default 'manual',
  add column if not exists inference_version text not null default '',
  add column if not exists confidence numeric(4,3) not null default 1,
  add column if not exists manually_edited boolean not null default true,
  add column if not exists can_make_ahead boolean not null default false,
  add column if not exists maximum_make_ahead_hours integer not null default 0,
  add column if not exists storage_method text not null default 'none';

alter table public.recipe_tasks
  drop constraint if exists recipe_tasks_confidence_check,
  drop constraint if exists recipe_tasks_maximum_make_ahead_hours_check,
  drop constraint if exists recipe_tasks_storage_method_check;

alter table public.recipe_tasks
  add constraint recipe_tasks_confidence_check
    check (confidence between 0 and 1),
  add constraint recipe_tasks_maximum_make_ahead_hours_check
    check (maximum_make_ahead_hours >= 0),
  add constraint recipe_tasks_storage_method_check
    check (storage_method in ('none', 'room_temperature', 'refrigerated', 'frozen'));

update public.recipe_tasks
set
  inference_source = 'manual',
  manually_edited = true,
  confidence = 1
where inference_source = 'manual';

CREATE OR REPLACE FUNCTION public.save_recipe_full(p_recipe_id uuid DEFAULT NULL::uuid, p_recipe jsonb DEFAULT '{}'::jsonb, p_ingredients jsonb DEFAULT '[]'::jsonb, p_steps jsonb DEFAULT '[]'::jsonb, p_tasks jsonb DEFAULT '[]'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid := p_recipe_id;
  v_item jsonb;
  v_ingredient_id uuid;
  v_creator_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_recipe->>'name'), '') is null then
    raise exception 'Recipe name is required';
  end if;

  if jsonb_array_length(coalesce(p_recipe->'meal_types', '[]'::jsonb)) = 0 then
    raise exception 'Select at least one meal type';
  end if;

  if v_recipe_id is null then
    select coalesce(
      (select display_name from public.profiles where user_id = v_user_id),
      (select split_part(email, '@', 1) from auth.users where id = v_user_id),
      'Unknown cook'
    )
    into v_creator_name;

    insert into public.recipes (
      user_id,
      name,
      description,
      meal_types,
      default_servings,
      minimum_batch_servings,
      maximum_batch_servings,
      preparation_minutes,
      cooking_minutes,
      cleanup_minutes,
      refrigerator_life_days,
      freezer_allowed,
      freezer_life_days,
      is_public,
      parent_recipe_id,
      creator_name
    )
    values (
      v_user_id,
      trim(p_recipe->>'name'),
      coalesce(nullif(trim(p_recipe->>'description'), ''), ''),
      array(
        select lower(trim(value))
        from jsonb_array_elements_text(coalesce(p_recipe->'meal_types', '[]'::jsonb))
      ),
      nullif(p_recipe->>'default_servings', '')::numeric,
      nullif(p_recipe->>'minimum_batch_servings', '')::numeric,
      nullif(p_recipe->>'maximum_batch_servings', '')::numeric,
      nullif(p_recipe->>'preparation_minutes', '')::integer,
      nullif(p_recipe->>'cooking_minutes', '')::integer,
      nullif(p_recipe->>'cleanup_minutes', '')::integer,
      nullif(p_recipe->>'refrigerator_life_days', '')::integer,
      coalesce((p_recipe->>'freezer_allowed')::boolean, false),
      case
        when coalesce((p_recipe->>'freezer_allowed')::boolean, false)
          then nullif(p_recipe->>'freezer_life_days', '')::integer
        else null
      end,
      coalesce((p_recipe->>'is_public')::boolean, true),
      null,
      v_creator_name
    )
    returning id into v_recipe_id;
  else
    if not exists (
      select 1
      from public.recipes
      where id = v_recipe_id
        and user_id = v_user_id
    ) then
      raise exception 'You can only edit recipes that you own';
    end if;

    update public.recipes
    set
      name = trim(p_recipe->>'name'),
      description = coalesce(nullif(trim(p_recipe->>'description'), ''), ''),
      meal_types = array(
        select lower(trim(value))
        from jsonb_array_elements_text(coalesce(p_recipe->'meal_types', '[]'::jsonb))
      ),
      default_servings = nullif(p_recipe->>'default_servings', '')::numeric,
      minimum_batch_servings = nullif(p_recipe->>'minimum_batch_servings', '')::numeric,
      maximum_batch_servings = nullif(p_recipe->>'maximum_batch_servings', '')::numeric,
      preparation_minutes = nullif(p_recipe->>'preparation_minutes', '')::integer,
      cooking_minutes = nullif(p_recipe->>'cooking_minutes', '')::integer,
      cleanup_minutes = nullif(p_recipe->>'cleanup_minutes', '')::integer,
      refrigerator_life_days = nullif(p_recipe->>'refrigerator_life_days', '')::integer,
      freezer_allowed = coalesce((p_recipe->>'freezer_allowed')::boolean, false),
      freezer_life_days = case
        when coalesce((p_recipe->>'freezer_allowed')::boolean, false)
          then nullif(p_recipe->>'freezer_life_days', '')::integer
        else null
      end,
      is_public = coalesce((p_recipe->>'is_public')::boolean, false)
    where id = v_recipe_id
      and user_id = v_user_id;

    delete from public.recipe_ingredients where recipe_id = v_recipe_id;
    delete from public.recipe_steps where recipe_id = v_recipe_id;
    delete from public.recipe_tasks where recipe_id = v_recipe_id;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
    order by (value->>'position')::integer
  loop
    v_ingredient_id := null;

    select id
    into v_ingredient_id
    from public.ingredients
    where user_id = v_user_id
      and lower(trim(name)) = lower(trim(v_item->>'name'))
    order by created_at
    limit 1;

    if v_ingredient_id is null then
      begin
        insert into public.ingredients (
          user_id,
          name,
          category,
          default_unit,
          approximate_allowed
        )
        values (
          v_user_id,
          trim(v_item->>'name'),
          'Other',
          coalesce(nullif(trim(v_item->>'unit'), ''), 'unit'),
          true
        )
        returning id into v_ingredient_id;
      exception
        when unique_violation then
          select id
          into v_ingredient_id
          from public.ingredients
          where user_id = v_user_id
            and lower(trim(name)) = lower(trim(v_item->>'name'))
          order by created_at
          limit 1;
      end;
    end if;

    insert into public.recipe_ingredients (
      recipe_id,
      user_id,
      ingredient_id,
      name,
      quantity,
      unit,
      preparation_note,
      is_optional,
      scaling_behavior,
      shopping_included,
      preparation_state,
      position
    )
    values (
      v_recipe_id,
      v_user_id,
      v_ingredient_id,
      trim(v_item->>'name'),
      (v_item->>'quantity')::numeric,
      trim(v_item->>'unit'),
      coalesce(nullif(trim(v_item->>'preparation_note'), ''), ''),
      coalesce((v_item->>'is_optional')::boolean, false),
      coalesce(nullif(trim(v_item->>'scaling_behavior'), ''), 'linear'),
      coalesce((v_item->>'shopping_included')::boolean, true),
      nullif(trim(v_item->>'preparation_state'), ''),
      (v_item->>'position')::integer
    );
  end loop;

  insert into public.recipe_steps (
    recipe_id,
    user_id,
    instruction,
    duration_minutes,
    step_type,
    position
  )
  select
    v_recipe_id,
    v_user_id,
    trim(value->>'instruction'),
    coalesce((value->>'duration_minutes')::integer, 0),
    coalesce(nullif(trim(value->>'step_type'), ''), 'active'),
    (value->>'position')::integer
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb));

  insert into public.recipe_tasks (
    recipe_id,
    user_id,
    title,
    instructions,
    task_type,
    active_minutes,
    passive_minutes,
    day_offset,
    start_before_meal_minutes,
    can_batch,
    batch_key,
    unattended,
    blocks_active_work,
    source_step_positions,
    inference_source,
    inference_version,
    confidence,
    manually_edited,
    can_make_ahead,
    maximum_make_ahead_hours,
    storage_method,
    position
  )
  select
    v_recipe_id,
    v_user_id,
    trim(value->>'title'),
    coalesce(nullif(trim(value->>'instructions'), ''), ''),
    coalesce(nullif(trim(value->>'task_type'), ''), 'preparation'),
    coalesce((value->>'active_minutes')::integer, 0),
    coalesce((value->>'passive_minutes')::integer, 0),
    coalesce((value->>'day_offset')::integer, 0),
    coalesce((value->>'start_before_meal_minutes')::integer, 0),
    coalesce((value->>'can_batch')::boolean, false),
    case
      when coalesce((value->>'can_batch')::boolean, false)
        then coalesce(nullif(trim(value->>'batch_key'), ''), '')
      else ''
    end,
    coalesce((value->>'unattended')::boolean, false),
    coalesce((value->>'blocks_active_work')::boolean, true),
    array(
      select jsonb_array_elements_text(
        coalesce(value->'source_step_positions', '[]'::jsonb)
      )::integer
    ),
    coalesce(nullif(trim(value->>'inference_source'), ''), 'manual'),
    coalesce(nullif(trim(value->>'inference_version'), ''), ''),
    greatest(0, least(1, coalesce((value->>'confidence')::numeric, 1))),
    coalesce((value->>'manually_edited')::boolean, true),
    coalesce((value->>'can_make_ahead')::boolean, false),
    greatest(0, coalesce((value->>'maximum_make_ahead_hours')::integer, 0)),
    coalesce(nullif(trim(value->>'storage_method'), ''), 'none'),
    (value->>'position')::integer
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb));

  insert into public.user_recipe_favorites (user_id, recipe_id, created_at)
  values (v_user_id, v_recipe_id, now())
  on conflict (user_id, recipe_id) do nothing;

  return v_recipe_id;
end;
$$;


CREATE OR REPLACE FUNCTION public.fork_public_recipe(p_source_recipe_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_source_recipe public.recipes%rowtype;
  v_new_recipe_id uuid;
  v_source_ingredient record;
  v_target_ingredient_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_source_recipe
  from public.recipes
  where id = p_source_recipe_id
    and (is_public = true or user_id = v_user_id);

  if not found then
    raise exception 'Recipe not found or unavailable';
  end if;

  insert into public.recipes (
    user_id,
    name,
    description,
    meal_types,
    default_servings,
    minimum_batch_servings,
    maximum_batch_servings,
    preparation_minutes,
    cooking_minutes,
    cleanup_minutes,
    refrigerator_life_days,
    freezer_allowed,
    freezer_life_days,
    is_public,
    parent_recipe_id,
    creator_name
  )
  values (
    v_user_id,
    v_source_recipe.name,
    v_source_recipe.description,
    v_source_recipe.meal_types,
    v_source_recipe.default_servings,
    v_source_recipe.minimum_batch_servings,
    v_source_recipe.maximum_batch_servings,
    v_source_recipe.preparation_minutes,
    v_source_recipe.cooking_minutes,
    v_source_recipe.cleanup_minutes,
    v_source_recipe.refrigerator_life_days,
    v_source_recipe.freezer_allowed,
    v_source_recipe.freezer_life_days,
    false,
    v_source_recipe.id,
    coalesce(
      (select display_name from public.profiles where user_id = v_user_id),
      (select split_part(email, '@', 1) from auth.users where id = v_user_id),
      'Unknown cook'
    )
  )
  returning id into v_new_recipe_id;

  for v_source_ingredient in
    select
      ri.name,
      ri.quantity,
      ri.unit,
      ri.preparation_note,
      ri.is_optional,
      ri.scaling_behavior,
      ri.shopping_included,
      ri.preparation_state,
      ri.position,
      i.category,
      i.default_unit,
      i.approximate_allowed
    from public.recipe_ingredients ri
    left join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = p_source_recipe_id
    order by ri.position
  loop
    select id
    into v_target_ingredient_id
    from public.ingredients
    where user_id = v_user_id
      and lower(trim(name)) = lower(trim(v_source_ingredient.name))
    order by created_at
    limit 1;

    if v_target_ingredient_id is null then
      insert into public.ingredients (
        user_id,
        name,
        category,
        default_unit,
        approximate_allowed
      )
      values (
        v_user_id,
        trim(v_source_ingredient.name),
        coalesce(v_source_ingredient.category, 'Other'),
        coalesce(nullif(trim(v_source_ingredient.default_unit), ''), nullif(trim(v_source_ingredient.unit), ''), 'unit'),
        coalesce(v_source_ingredient.approximate_allowed, true)
      )
      returning id into v_target_ingredient_id;
    end if;

    insert into public.recipe_ingredients (
      recipe_id,
      user_id,
      ingredient_id,
      name,
      quantity,
      unit,
      preparation_note,
      is_optional,
      scaling_behavior,
      shopping_included,
      preparation_state,
      position
    )
    values (
      v_new_recipe_id,
      v_user_id,
      v_target_ingredient_id,
      v_source_ingredient.name,
      v_source_ingredient.quantity,
      v_source_ingredient.unit,
      v_source_ingredient.preparation_note,
      v_source_ingredient.is_optional,
      v_source_ingredient.scaling_behavior,
      v_source_ingredient.shopping_included,
      v_source_ingredient.preparation_state,
      v_source_ingredient.position
    );
  end loop;

  insert into public.recipe_steps (
    recipe_id,
    user_id,
    instruction,
    duration_minutes,
    step_type,
    position
  )
  select
    v_new_recipe_id,
    v_user_id,
    instruction,
    duration_minutes,
    step_type,
    position
  from public.recipe_steps
  where recipe_id = p_source_recipe_id
  order by position;

  insert into public.recipe_tasks (
    recipe_id,
    user_id,
    title,
    instructions,
    task_type,
    active_minutes,
    passive_minutes,
    day_offset,
    start_before_meal_minutes,
    can_batch,
    batch_key,
    unattended,
    blocks_active_work,
    source_step_positions,
    inference_source,
    inference_version,
    confidence,
    manually_edited,
    can_make_ahead,
    maximum_make_ahead_hours,
    storage_method,
    position
  )
  select
    v_new_recipe_id,
    v_user_id,
    title,
    instructions,
    task_type,
    active_minutes,
    passive_minutes,
    day_offset,
    start_before_meal_minutes,
    can_batch,
    batch_key,
    unattended,
    blocks_active_work,
    source_step_positions,
    inference_source,
    inference_version,
    confidence,
    manually_edited,
    can_make_ahead,
    maximum_make_ahead_hours,
    storage_method,
    position
  from public.recipe_tasks
  where recipe_id = p_source_recipe_id
  order by position;

  insert into public.user_recipe_favorites (user_id, recipe_id, created_at)
  values (v_user_id, v_new_recipe_id, now())
  on conflict (user_id, recipe_id) do nothing;

  return v_new_recipe_id;
end;
$$;


commit;
