--
-- PostgreSQL database dump
--

\restrict yB9UH4C0d0lSxdYIXcRDuMQs5h5S8lPf2HFubtuFLED71hxGISypDoRSkJdjXWc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: auto_favorite_owned_recipe(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_favorite_owned_recipe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.user_id is not null then
    insert into public.user_recipe_favorites (
      user_id,
      recipe_id,
      created_at
    )
    values (
      new.user_id,
      new.id,
      now()
    )
    on conflict (
      user_id,
      recipe_id
    )
    do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: auto_favorite_recipe_after_owner_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_favorite_recipe_after_owner_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.user_id is not null
     and new.user_id is distinct from old.user_id then

    insert into public.user_recipe_favorites (
      user_id,
      recipe_id,
      created_at
    )
    values (
      new.user_id,
      new.id,
      now()
    )
    on conflict (
      user_id,
      recipe_id
    )
    do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: create_account_records_for_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_account_records_for_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (
    user_id,
    display_name,
    avatar_url,
    created_at,
    updated_at
  )
  values (
    new.id,

    coalesce(
      nullif(
        trim(
          new.raw_user_meta_data
            ->> 'display_name'
        ),
        ''
      ),
      nullif(
        trim(
          new.raw_user_meta_data
            ->> 'full_name'
        ),
        ''
      ),
      nullif(
        split_part(
          coalesce(new.email, ''),
          '@',
          1
        ),
        ''
      ),
      'Meal Planner User'
    ),

    nullif(
      trim(
        new.raw_user_meta_data
          ->> 'avatar_url'
      ),
      ''
    ),

    coalesce(
      new.created_at,
      now()
    ),

    now()
  )
  on conflict (user_id)
  do nothing;

  insert into public.account_preferences (
    user_id
  )
  values (
    new.id
  )
  on conflict (user_id)
  do nothing;

  return new;
end;
$$;


--
-- Name: create_profile_for_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_for_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (
    user_id,
    display_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(
      nullif(
        trim(
          new.raw_user_meta_data
            ->> 'display_name'
        ),
        ''
      ),
      nullif(
        split_part(
          coalesce(new.email, ''),
          '@',
          1
        ),
        ''
      ),
      'Meal Planner User'
    ),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id)
  do nothing;

  return new;
end;
$$;


--
-- Name: create_scheduler_records_for_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_scheduler_records_for_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.scheduler_preferences (
    user_id
  )
  values (new.id)
  on conflict (user_id)
  do nothing;

  insert into public.day_schedule_preferences (
    user_id,
    day_of_week
  )
  select
    new.id,
    days.day_of_week
  from generate_series(
    1,
    7
  ) as days(day_of_week)
  on conflict (
    user_id,
    day_of_week
  )
  do nothing;

  insert into public.meal_slot_preferences (
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
    new.id,
    days.day_of_week,
    slots.position,
    slots.name,
    slots.recipe_category,
    slots.eat_time::time,
    slots.ready_time::time,
    slots.preparation_mode
  from generate_series(
    1,
    7
  ) as days(day_of_week)
  cross join (
    values
      (
        0,
        'Breakfast',
        'breakfast',
        '08:00',
        '08:00',
        'fresh'
      ),
      (
        1,
        'Lunch',
        'lunch',
        '12:30',
        '08:10',
        'packed'
      ),
      (
        2,
        'Snack',
        'snack',
        '17:00',
        '08:15',
        'packed'
      ),
      (
        3,
        'Dinner',
        'dinner',
        '19:30',
        '19:30',
        'fresh'
      )
  ) as slots(
    position,
    name,
    recipe_category,
    eat_time,
    ready_time,
    preparation_mode
  );

  return new;
end;
$$;


--
-- Name: delete_current_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_current_user() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required';
  end if;

  delete from auth.users
  where id = current_user_id;

  if not found then
    raise exception
      'Account not found';
  end if;
end;
$$;


--
-- Name: delete_owned_recipe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_owned_recipe(p_recipe_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.recipes
    where id = p_recipe_id
      and user_id = v_user_id
  ) then
    raise exception 'You can only delete recipes that you own';
  end if;

  delete from public.user_recipe_favorites where recipe_id = p_recipe_id;
  delete from public.recipe_ingredients where recipe_id = p_recipe_id;
  delete from public.recipe_steps where recipe_id = p_recipe_id;
  delete from public.recipe_tasks where recipe_id = p_recipe_id;
  delete from public.recipes where id = p_recipe_id and user_id = v_user_id;

  return true;
end;
$$;


--
-- Name: fork_public_recipe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fork_public_recipe(p_source_recipe_id uuid) RETURNS uuid
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


--
-- Name: fork_public_recipe(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fork_public_recipe(source_recipe_id uuid, customized_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  source_recipe public.recipes%rowtype;
  new_recipe_id uuid;
  target_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into source_recipe
  from public.recipes
  where id = source_recipe_id
    and (
      is_public = true
      or user_id = auth.uid()
    );

  if not found then
    raise exception 'Recipe not found or unavailable';
  end if;

  target_name := coalesce(
    nullif(trim(customized_name), ''),
    source_recipe.name || ' (My version)'
  );

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
    forked_at,
    created_at,
    updated_at
  )
  values (
    auth.uid(),
    target_name,
    source_recipe.description,
    source_recipe.meal_types,
    source_recipe.default_servings,
    source_recipe.minimum_batch_servings,
    source_recipe.maximum_batch_servings,
    source_recipe.preparation_minutes,
    source_recipe.cooking_minutes,
    source_recipe.cleanup_minutes,
    source_recipe.refrigerator_life_days,
    source_recipe.freezer_allowed,
    source_recipe.freezer_life_days,
    false,
    source_recipe.id,
    now(),
    now(),
    now()
  )
  returning id into new_recipe_id;

  insert into public.recipe_ingredients (
    recipe_id,
    user_id,
    ingredient_id,
    name,
    quantity,
    unit,
    preparation_note,
    is_optional,
    position
  )
  select
    new_recipe_id,
    auth.uid(),
    null,
    ingredient.name,
    ingredient.quantity,
    ingredient.unit,
    ingredient.preparation_note,
    ingredient.is_optional,
    ingredient.position
  from public.recipe_ingredients ingredient
  where ingredient.recipe_id = source_recipe.id
  order by ingredient.position;

  insert into public.recipe_steps (
    recipe_id,
    user_id,
    instruction,
    duration_minutes,
    step_type,
    position
  )
  select
    new_recipe_id,
    auth.uid(),
    step.instruction,
    step.duration_minutes,
    step.step_type,
    step.position
  from public.recipe_steps step
  where step.recipe_id = source_recipe.id
  order by step.position;

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
    batch_key,
    can_batch,
    unattended,
    blocks_active_work,
    position,
    depends_on_task_id
  )
  select
    new_recipe_id,
    auth.uid(),
    task.title,
    task.instructions,
    task.task_type,
    task.active_minutes,
    task.passive_minutes,
    task.day_offset,
    task.start_before_meal_minutes,
    task.batch_key,
    task.can_batch,
    task.unattended,
    task.blocks_active_work,
    task.position,
    null
  from public.recipe_tasks task
  where task.recipe_id = source_recipe.id
  order by task.position;

  return new_recipe_id;
end;
$$;


--
-- Name: get_recipe_library_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recipe_library_counts() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'discover_count', (
      select count(*) from public.recipes where is_public = true
    ),
    'favorites_count', (
      select count(distinct r.id)
      from public.recipes r
      left join public.user_recipe_favorites f
        on f.recipe_id = r.id
       and f.user_id = auth.uid()
      where f.recipe_id is not null or r.user_id = auth.uid()
    ),
    'my_recipes_count', (
      select count(*) from public.recipes where user_id = auth.uid()
    )
  );
$$;


--
-- Name: get_recipe_page(text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recipe_page(p_tab text DEFAULT 'discover'::text, p_search text DEFAULT NULL::text, p_meal_type text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with parameters as (
    select
      case
        when lower(coalesce(p_tab, 'discover')) in ('discover', 'favorites', 'mine')
          then lower(coalesce(p_tab, 'discover'))
        else 'discover'
      end as selected_tab,
      nullif(trim(coalesce(p_search, '')), '') as search_term,
      nullif(lower(trim(coalesce(p_meal_type, ''))), '') as selected_meal_type,
      greatest(coalesce(p_page, 1), 1) as selected_page,
      least(greatest(coalesce(p_page_size, 50), 1), 50) as selected_page_size
  ),
  filtered as (
    select distinct
      r.*,
      (f.recipe_id is not null or r.user_id = auth.uid()) as is_favorite
    from public.recipes r
    cross join parameters p
    left join public.user_recipe_favorites f
      on f.recipe_id = r.id
     and f.user_id = auth.uid()
    where
      (
        (p.selected_tab = 'discover' and r.is_public = true)
        or (p.selected_tab = 'favorites' and (f.recipe_id is not null or r.user_id = auth.uid()))
        or (p.selected_tab = 'mine' and r.user_id = auth.uid())
      )
      and (
        p.selected_meal_type is null
        or exists (
          select 1
          from unnest(coalesce(r.meal_types, array[]::text[])) as meal_type(value)
          where lower(trim(meal_type.value)) = p.selected_meal_type
        )
      )
      and (
        p.search_term is null
        or r.name ilike '%' || p.search_term || '%'
        or coalesce(r.description, '') ilike '%' || p.search_term || '%'
        or coalesce(r.creator_name, '') ilike '%' || p.search_term || '%'
        or coalesce(array_to_string(r.meal_types, ' '), '') ilike '%' || p.search_term || '%'
      )
  ),
  page_rows as (
    select filtered.*
    from filtered
    cross join parameters p
    order by lower(filtered.name), filtered.id
    limit (select selected_page_size from parameters)
    offset (
      select (selected_page - 1) * selected_page_size
      from parameters
    )
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(page_rows) order by lower(page_rows.name), page_rows.id)
        from page_rows
      ),
      '[]'::jsonb
    ),
    'total_count', (select count(*) from filtered),
    'page', (select selected_page from parameters),
    'page_size', (select selected_page_size from parameters)
  );
$$;


--
-- Name: save_recipe_full(uuid, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_recipe_full(p_recipe_id uuid DEFAULT NULL::uuid, p_recipe jsonb DEFAULT '{}'::jsonb, p_ingredients jsonb DEFAULT '[]'::jsonb, p_steps jsonb DEFAULT '[]'::jsonb, p_tasks jsonb DEFAULT '[]'::jsonb) RETURNS uuid
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
    (value->>'position')::integer
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb));

  insert into public.user_recipe_favorites (user_id, recipe_id, created_at)
  values (v_user_id, v_recipe_id, now())
  on conflict (user_id, recipe_id) do nothing;

  return v_recipe_id;
end;
$$;


--
-- Name: save_scheduler_settings(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_scheduler_settings(p_global jsonb, p_days jsonb, p_slots jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: set_account_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_account_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_planned_meal_recipe_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_planned_meal_recipe_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_profile_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_profile_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_recipe_creator_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_recipe_creator_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  resolved_name text;
begin
  select coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(auth_user.email, '@', 1)), ''),
    'Unknown cook'
  )
  into resolved_name
  from auth.users as auth_user
  where auth_user.id = new.user_id;

  new.creator_name := coalesce(resolved_name, 'Unknown cook');
  return new;
end;
$$;


--
-- Name: set_schedule_task_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_schedule_task_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_scheduler_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_scheduler_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_user_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_week_plan_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_week_plan_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_recipe_creator_name_from_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_recipe_creator_name_from_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.display_name
    is distinct from old.display_name then

    update public.recipes
    set creator_name =
      new.display_name
    where user_id =
      new.user_id;
  end if;

  return new;
end;
$$;


--
-- Name: validate_planned_meal_recipe_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_planned_meal_recipe_owner() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  meal_owner uuid;
  recipe_owner uuid;
begin
  select user_id
  into meal_owner
  from public.planned_meals
  where id = new.planned_meal_id;

  select user_id
  into recipe_owner
  from public.recipes
  where id = new.recipe_id;

  if meal_owner is null then
    raise exception 'Planned meal does not exist';
  end if;

  if recipe_owner is null then
    raise exception 'Recipe does not exist';
  end if;

  if meal_owner <> new.user_id then
    raise exception 'Planned meal belongs to another user';
  end if;

  if recipe_owner <> new.user_id then
    raise exception 'Recipe belongs to another user';
  end if;

  return new;
end;
$$;


--
-- Name: validate_recipe_ingredient_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_recipe_ingredient_owner() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  catalogue_user_id uuid;
begin
  if new.ingredient_id is null then
    return new;
  end if;

  select user_id
  into catalogue_user_id
  from public.ingredients
  where id = new.ingredient_id;

  if catalogue_user_id is null then
    raise exception 'Ingredient catalogue entry does not exist';
  end if;

  if catalogue_user_id <> new.user_id then
    raise exception 'Ingredient belongs to another user';
  end if;

  return new;
end;
$$;


--
-- Name: validate_recipe_task_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_recipe_task_owner() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  recipe_owner uuid;
begin
  select user_id
  into recipe_owner
  from public.recipes
  where id = new.recipe_id;

  if recipe_owner is null then
    raise exception
      'Recipe does not exist';
  end if;

  if recipe_owner <> new.user_id then
    raise exception
      'Recipe belongs to another user';
  end if;

  if new.depends_on_task_id is not null then
    if not exists (
      select 1
      from public.recipe_tasks
      where id = new.depends_on_task_id
        and recipe_id = new.recipe_id
        and user_id = new.user_id
    ) then
      raise exception
        'Dependency must belong to the same recipe';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: validate_scheduled_task_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_scheduled_task_owner() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  plan_owner uuid;
begin
  select user_id
  into plan_owner
  from public.weekly_plans
  where id = new.weekly_plan_id;

  if plan_owner is null then
    raise exception
      'Weekly plan does not exist';
  end if;

  if plan_owner <> new.user_id then
    raise exception
      'Weekly plan belongs to another user';
  end if;

  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_preferences (
    user_id uuid NOT NULL,
    theme text DEFAULT 'system'::text NOT NULL,
    time_format text DEFAULT '12h'::text NOT NULL,
    measurement_system text DEFAULT 'metric'::text NOT NULL,
    week_starts_on text DEFAULT 'monday'::text NOT NULL,
    default_recipe_tab text DEFAULT 'discover'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    suppress_non_severe_warnings boolean DEFAULT false NOT NULL,
    CONSTRAINT account_preferences_default_recipe_tab_check CHECK ((default_recipe_tab = ANY (ARRAY['discover'::text, 'favorites'::text, 'mine'::text]))),
    CONSTRAINT account_preferences_measurement_system_check CHECK ((measurement_system = ANY (ARRAY['metric'::text, 'us'::text]))),
    CONSTRAINT account_preferences_theme_check CHECK ((theme = ANY (ARRAY['system'::text, 'light'::text, 'dark'::text]))),
    CONSTRAINT account_preferences_time_format_check CHECK ((time_format = ANY (ARRAY['12h'::text, '24h'::text]))),
    CONSTRAINT account_preferences_week_starts_on_check CHECK ((week_starts_on = ANY (ARRAY['monday'::text, 'sunday'::text])))
);


--
-- Name: cooking_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cooking_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    weekly_plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    day_index integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    block_type text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cooking_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['light'::text, 'normal'::text, 'batch'::text]))),
    CONSTRAINT cooking_blocks_check CHECK ((end_time > start_time)),
    CONSTRAINT cooking_blocks_day_index_check CHECK (((day_index >= 0) AND (day_index <= 6)))
);


--
-- Name: day_schedule_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_schedule_preferences (
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    earliest_task_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    latest_task_time time without time zone DEFAULT '21:30:00'::time without time zone NOT NULL,
    leave_home_time time without time zone DEFAULT '08:30:00'::time without time zone NOT NULL,
    return_home_time time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    evening_prep_start time without time zone DEFAULT '18:30:00'::time without time zone NOT NULL,
    evening_prep_end time without time zone DEFAULT '21:00:00'::time without time zone NOT NULL,
    max_active_cooking_minutes integer DEFAULT 75 NOT NULL,
    cooking_allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT day_schedule_preferences_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7))),
    CONSTRAINT day_schedule_preferences_max_active_cooking_minutes_check CHECK (((max_active_cooking_minutes >= 0) AND (max_active_cooking_minutes <= 1440)))
);


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'Other'::text NOT NULL,
    default_unit text DEFAULT ''::text NOT NULL,
    approximate_allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingredients_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: meal_slot_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_slot_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    "position" integer NOT NULL,
    name text NOT NULL,
    recipe_category text NOT NULL,
    eat_time time without time zone NOT NULL,
    ready_time time without time zone NOT NULL,
    preparation_mode text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meal_slot_preferences_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7))),
    CONSTRAINT meal_slot_preferences_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT meal_slot_preferences_position_check CHECK (("position" >= 0)),
    CONSTRAINT meal_slot_preferences_preparation_mode_check CHECK ((preparation_mode = ANY (ARRAY['fresh'::text, 'packed'::text, 'leftovers'::text, 'batch_prepared'::text]))),
    CONSTRAINT meal_slot_preferences_recipe_category_check CHECK ((recipe_category = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'any'::text])))
);


--
-- Name: pantry_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pantry_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    tracking_mode text DEFAULT 'approximate'::text NOT NULL,
    quantity numeric,
    unit text,
    stock_status text DEFAULT 'enough'::text NOT NULL,
    expiry_date date,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pantry_items_check CHECK (((tracking_mode = 'approximate'::text) OR ((quantity IS NOT NULL) AND (unit IS NOT NULL) AND (length(TRIM(BOTH FROM unit)) > 0)))),
    CONSTRAINT pantry_items_quantity_check CHECK (((quantity IS NULL) OR (quantity >= (0)::numeric))),
    CONSTRAINT pantry_items_stock_status_check CHECK ((stock_status = ANY (ARRAY['out'::text, 'low'::text, 'enough'::text, 'plenty'::text]))),
    CONSTRAINT pantry_items_tracking_mode_check CHECK ((tracking_mode = ANY (ARRAY['exact'::text, 'approximate'::text])))
);


--
-- Name: planned_meal_recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planned_meal_recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    planned_meal_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    servings integer DEFAULT 1 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planned_meal_recipes_position_check CHECK (("position" >= 0)),
    CONSTRAINT planned_meal_recipes_servings_check CHECK ((servings > 0))
);


--
-- Name: planned_meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planned_meals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    weekly_plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    day_index integer NOT NULL,
    meal_type text NOT NULL,
    servings integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meal_slot_id text DEFAULT 'meal'::text NOT NULL,
    meal_slot_name text DEFAULT 'Meal'::text NOT NULL,
    meal_category text DEFAULT 'any'::text NOT NULL,
    meal_time time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    ready_by_time time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    preparation_mode text DEFAULT 'fresh'::text NOT NULL,
    CONSTRAINT planned_meals_day_index_check CHECK (((day_index >= 0) AND (day_index <= 6))),
    CONSTRAINT planned_meals_meal_type_check CHECK ((meal_type = ANY (ARRAY['Breakfast'::text, 'Lunch'::text, 'Dinner'::text, 'Snack'::text]))),
    CONSTRAINT planned_meals_preparation_mode_check CHECK ((preparation_mode = ANY (ARRAY['fresh'::text, 'packed'::text, 'previous_evening'::text, 'batch_cooked'::text, 'leftover'::text, 'reheat_only'::text, 'no_cooking'::text]))),
    CONSTRAINT planned_meals_servings_check CHECK ((servings > 0))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    bio text,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    public_profile_enabled boolean DEFAULT true NOT NULL,
    show_avatar_publicly boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_bio_length CHECK (((bio IS NULL) OR (length(bio) <= 300))),
    CONSTRAINT profiles_display_name_length CHECK ((length(display_name) <= 80)),
    CONSTRAINT profiles_display_name_not_blank CHECK ((length(TRIM(BOTH FROM display_name)) > 0))
);


--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    quantity numeric NOT NULL,
    unit text NOT NULL,
    preparation_note text DEFAULT ''::text NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ingredient_id uuid,
    CONSTRAINT recipe_ingredients_position_check CHECK (("position" >= 0)),
    CONSTRAINT recipe_ingredients_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: recipe_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    instruction text NOT NULL,
    duration_minutes integer DEFAULT 0 NOT NULL,
    step_type text DEFAULT 'active'::text NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_steps_duration_minutes_check CHECK ((duration_minutes >= 0)),
    CONSTRAINT recipe_steps_position_check CHECK (("position" >= 0)),
    CONSTRAINT recipe_steps_step_type_check CHECK ((step_type = ANY (ARRAY['active'::text, 'passive'::text])))
);


--
-- Name: recipe_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    title text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    task_type text DEFAULT 'preparation'::text NOT NULL,
    active_minutes integer DEFAULT 0 NOT NULL,
    passive_minutes integer DEFAULT 0 NOT NULL,
    day_offset integer DEFAULT 0 NOT NULL,
    start_before_meal_minutes integer DEFAULT 0 NOT NULL,
    batch_key text DEFAULT ''::text NOT NULL,
    can_batch boolean DEFAULT false NOT NULL,
    unattended boolean DEFAULT false NOT NULL,
    blocks_active_work boolean DEFAULT true NOT NULL,
    depends_on_task_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recipe_tasks_active_minutes_check CHECK ((active_minutes >= 0)),
    CONSTRAINT recipe_tasks_day_offset_check CHECK (((day_offset >= '-14'::integer) AND (day_offset <= 14))),
    CONSTRAINT recipe_tasks_passive_minutes_check CHECK ((passive_minutes >= 0)),
    CONSTRAINT recipe_tasks_start_before_meal_minutes_check CHECK ((start_before_meal_minutes >= 0)),
    CONSTRAINT recipe_tasks_task_type_check CHECK ((task_type = ANY (ARRAY['preparation'::text, 'marinating'::text, 'soaking'::text, 'thawing'::text, 'cooking'::text, 'resting'::text, 'cooling'::text, 'portioning'::text, 'storage'::text, 'cleanup'::text, 'serving'::text, 'other'::text]))),
    CONSTRAINT recipe_tasks_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    meal_types text[] DEFAULT '{}'::text[] NOT NULL,
    default_servings integer DEFAULT 1 NOT NULL,
    preparation_minutes integer DEFAULT 0 NOT NULL,
    cooking_minutes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    minimum_batch_servings integer DEFAULT 1 NOT NULL,
    maximum_batch_servings integer DEFAULT 10 NOT NULL,
    cleanup_minutes integer DEFAULT 0 NOT NULL,
    refrigerator_life_days integer DEFAULT 3 NOT NULL,
    freezer_allowed boolean DEFAULT false NOT NULL,
    freezer_life_days integer,
    is_public boolean DEFAULT true NOT NULL,
    parent_recipe_id uuid,
    forked_at timestamp with time zone,
    creator_name text DEFAULT 'Unknown cook'::text NOT NULL,
    CONSTRAINT recipes_cleanup_minutes_check CHECK ((cleanup_minutes >= 0)),
    CONSTRAINT recipes_cooking_minutes_check CHECK ((cooking_minutes >= 0)),
    CONSTRAINT recipes_default_servings_check CHECK ((default_servings > 0)),
    CONSTRAINT recipes_freezer_life_days_check CHECK (((freezer_life_days IS NULL) OR (freezer_life_days >= 0))),
    CONSTRAINT recipes_maximum_batch_servings_check CHECK ((maximum_batch_servings > 0)),
    CONSTRAINT recipes_minimum_batch_servings_check CHECK ((minimum_batch_servings > 0)),
    CONSTRAINT recipes_preparation_minutes_check CHECK ((preparation_minutes >= 0)),
    CONSTRAINT recipes_refrigerator_life_days_check CHECK ((refrigerator_life_days >= 0))
);


--
-- Name: COLUMN recipes.is_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recipes.is_public IS 'Public recipes are readable by all authenticated users. Private rows are user-owned customizations.';


--
-- Name: COLUMN recipes.parent_recipe_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recipes.parent_recipe_id IS 'The public source recipe from which a private customized recipe was forked.';


--
-- Name: COLUMN recipes.forked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recipes.forked_at IS 'When a private customized copy was created from its public source.';


--
-- Name: schedule_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    task_date date NOT NULL,
    week_plan_entry_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    recipe_task_id uuid,
    title text NOT NULL,
    instructions text,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone NOT NULL,
    active_minutes integer DEFAULT 0 NOT NULL,
    passive_minutes integer DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    is_manually_adjusted boolean DEFAULT false NOT NULL,
    has_conflict boolean DEFAULT false NOT NULL,
    warning_message text,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_tasks_active_minutes_check CHECK ((active_minutes >= 0)),
    CONSTRAINT schedule_tasks_passive_minutes_check CHECK ((passive_minutes >= 0)),
    CONSTRAINT schedule_tasks_position_check CHECK (("position" >= 0))
);


--
-- Name: scheduled_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    weekly_plan_id uuid NOT NULL,
    planned_meal_id uuid,
    recipe_id uuid,
    recipe_task_id uuid,
    title text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    task_type text DEFAULT 'preparation'::text NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_start time without time zone,
    scheduled_end time without time zone,
    active_minutes integer DEFAULT 0 NOT NULL,
    passive_minutes integer DEFAULT 0 NOT NULL,
    unattended boolean DEFAULT false NOT NULL,
    blocks_active_work boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    is_generated boolean DEFAULT true NOT NULL,
    manually_adjusted boolean DEFAULT false NOT NULL,
    batch_key text DEFAULT ''::text NOT NULL,
    source_recipe_name text DEFAULT ''::text NOT NULL,
    source_meal_type text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduled_tasks_active_minutes_check CHECK ((active_minutes >= 0)),
    CONSTRAINT scheduled_tasks_passive_minutes_check CHECK ((passive_minutes >= 0)),
    CONSTRAINT scheduled_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'skipped'::text]))),
    CONSTRAINT scheduled_tasks_task_type_check CHECK ((task_type = ANY (ARRAY['preparation'::text, 'marinating'::text, 'soaking'::text, 'thawing'::text, 'cooking'::text, 'resting'::text, 'cooling'::text, 'portioning'::text, 'storage'::text, 'cleanup'::text, 'serving'::text, 'other'::text]))),
    CONSTRAINT scheduled_tasks_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: scheduler_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduler_preferences (
    user_id uuid NOT NULL,
    conflict_grouping_minutes integer DEFAULT 60 NOT NULL,
    preferred_batch_days text[] DEFAULT ARRAY['saturday'::text, 'sunday'::text] NOT NULL,
    preserve_manual_adjustments boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduler_preferences_conflict_grouping_minutes_check CHECK (((conflict_grouping_minutes >= 1) AND (conflict_grouping_minutes <= 1440)))
);


--
-- Name: shopping_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shopping_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shopping_list_id uuid NOT NULL,
    user_id uuid NOT NULL,
    ingredient_id uuid,
    name text NOT NULL,
    category text DEFAULT 'Other'::text NOT NULL,
    required_quantity numeric,
    pantry_quantity numeric,
    quantity_to_buy numeric,
    unit text DEFAULT ''::text NOT NULL,
    is_manual boolean DEFAULT false NOT NULL,
    is_purchased boolean DEFAULT false NOT NULL,
    source_recipes text[] DEFAULT '{}'::text[] NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shopping_items_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT shopping_items_pantry_quantity_check CHECK (((pantry_quantity IS NULL) OR (pantry_quantity >= (0)::numeric))),
    CONSTRAINT shopping_items_quantity_to_buy_check CHECK (((quantity_to_buy IS NULL) OR (quantity_to_buy >= (0)::numeric))),
    CONSTRAINT shopping_items_required_quantity_check CHECK (((required_quantity IS NULL) OR (required_quantity >= (0)::numeric)))
);


--
-- Name: shopping_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shopping_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    generated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_recipe_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_recipe_favorites (
    user_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    conflict_grouping_minutes integer DEFAULT 60 NOT NULL,
    preferred_batch_day text DEFAULT 'sunday'::text NOT NULL,
    preserve_manual_tasks boolean DEFAULT true NOT NULL,
    day_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    preferred_batch_days jsonb DEFAULT '["sunday"]'::jsonb NOT NULL,
    CONSTRAINT user_settings_conflict_grouping_minutes_check CHECK (((conflict_grouping_minutes >= 15) AND (conflict_grouping_minutes <= 180))),
    CONSTRAINT user_settings_day_settings_check CHECK ((jsonb_typeof(day_settings) = 'object'::text)),
    CONSTRAINT user_settings_preferred_batch_day_check CHECK ((preferred_batch_day = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text]))),
    CONSTRAINT user_settings_preferred_batch_days_type_check CHECK ((jsonb_typeof(preferred_batch_days) = 'array'::text))
);


--
-- Name: week_plan_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.week_plan_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    meal_date date NOT NULL,
    meal_slot_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    servings numeric DEFAULT 1 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT week_plan_entries_position_check CHECK (("position" >= 0)),
    CONSTRAINT week_plan_entries_servings_check CHECK ((servings > (0)::numeric))
);


--
-- Name: weekly_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_preferences account_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_preferences
    ADD CONSTRAINT account_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: cooking_blocks cooking_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooking_blocks
    ADD CONSTRAINT cooking_blocks_pkey PRIMARY KEY (id);


--
-- Name: day_schedule_preferences day_schedule_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_schedule_preferences
    ADD CONSTRAINT day_schedule_preferences_pkey PRIMARY KEY (user_id, day_of_week);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: meal_slot_preferences meal_slot_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_slot_preferences
    ADD CONSTRAINT meal_slot_preferences_pkey PRIMARY KEY (id);


--
-- Name: meal_slot_preferences meal_slot_preferences_user_id_day_of_week_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_slot_preferences
    ADD CONSTRAINT meal_slot_preferences_user_id_day_of_week_position_key UNIQUE (user_id, day_of_week, "position");


--
-- Name: pantry_items pantry_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pantry_items
    ADD CONSTRAINT pantry_items_pkey PRIMARY KEY (id);


--
-- Name: pantry_items pantry_items_user_id_ingredient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pantry_items
    ADD CONSTRAINT pantry_items_user_id_ingredient_id_key UNIQUE (user_id, ingredient_id);


--
-- Name: planned_meal_recipes planned_meal_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_recipes
    ADD CONSTRAINT planned_meal_recipes_pkey PRIMARY KEY (id);


--
-- Name: planned_meal_recipes planned_meal_recipes_planned_meal_id_recipe_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_recipes
    ADD CONSTRAINT planned_meal_recipes_planned_meal_id_recipe_id_key UNIQUE (planned_meal_id, recipe_id);


--
-- Name: planned_meals planned_meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: recipe_steps recipe_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_pkey PRIMARY KEY (id);


--
-- Name: recipe_tasks recipe_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_tasks
    ADD CONSTRAINT recipe_tasks_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: schedule_tasks schedule_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_tasks
    ADD CONSTRAINT schedule_tasks_pkey PRIMARY KEY (id);


--
-- Name: scheduled_tasks scheduled_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_pkey PRIMARY KEY (id);


--
-- Name: scheduler_preferences scheduler_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_preferences
    ADD CONSTRAINT scheduler_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: shopping_items shopping_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_pkey PRIMARY KEY (id);


--
-- Name: shopping_lists shopping_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_pkey PRIMARY KEY (id);


--
-- Name: shopping_lists shopping_lists_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: user_recipe_favorites user_recipe_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recipe_favorites
    ADD CONSTRAINT user_recipe_favorites_pkey PRIMARY KEY (user_id, recipe_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: week_plan_entries week_plan_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_plan_entries
    ADD CONSTRAINT week_plan_entries_pkey PRIMARY KEY (id);


--
-- Name: weekly_plans weekly_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_pkey PRIMARY KEY (id);


--
-- Name: weekly_plans weekly_plans_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: cooking_blocks_plan_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cooking_blocks_plan_id_index ON public.cooking_blocks USING btree (weekly_plan_id);


--
-- Name: cooking_blocks_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cooking_blocks_user_id_index ON public.cooking_blocks USING btree (user_id);


--
-- Name: ingredients_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingredients_user_id_index ON public.ingredients USING btree (user_id);


--
-- Name: ingredients_user_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ingredients_user_name_unique ON public.ingredients USING btree (user_id, lower(TRIM(BOTH FROM name)));


--
-- Name: pantry_items_ingredient_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pantry_items_ingredient_id_index ON public.pantry_items USING btree (ingredient_id);


--
-- Name: pantry_items_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pantry_items_user_id_index ON public.pantry_items USING btree (user_id);


--
-- Name: planned_meal_recipes_meal_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meal_recipes_meal_id_index ON public.planned_meal_recipes USING btree (planned_meal_id, "position");


--
-- Name: planned_meal_recipes_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meal_recipes_user_id_index ON public.planned_meal_recipes USING btree (user_id);


--
-- Name: planned_meals_plan_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meals_plan_id_index ON public.planned_meals USING btree (weekly_plan_id);


--
-- Name: planned_meals_slot_lookup_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meals_slot_lookup_index ON public.planned_meals USING btree (weekly_plan_id, day_index, meal_slot_id);


--
-- Name: planned_meals_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meals_user_id_index ON public.planned_meals USING btree (user_id);


--
-- Name: planned_meals_week_day_slot_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX planned_meals_week_day_slot_unique ON public.planned_meals USING btree (weekly_plan_id, day_index, meal_slot_id);


--
-- Name: profiles_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_user_id_unique ON public.profiles USING btree (user_id);


--
-- Name: recipe_ingredients_ingredient_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_ingredients_ingredient_id_index ON public.recipe_ingredients USING btree (ingredient_id);


--
-- Name: recipe_ingredients_recipe_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_ingredients_recipe_id_index ON public.recipe_ingredients USING btree (recipe_id);


--
-- Name: recipe_ingredients_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_ingredients_user_id_index ON public.recipe_ingredients USING btree (user_id);


--
-- Name: recipe_steps_recipe_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_steps_recipe_id_index ON public.recipe_steps USING btree (recipe_id);


--
-- Name: recipe_steps_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_steps_user_id_index ON public.recipe_steps USING btree (user_id);


--
-- Name: recipe_tasks_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_tasks_position_index ON public.recipe_tasks USING btree (recipe_id, "position");


--
-- Name: recipe_tasks_recipe_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_tasks_recipe_id_index ON public.recipe_tasks USING btree (recipe_id);


--
-- Name: recipe_tasks_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipe_tasks_user_id_index ON public.recipe_tasks USING btree (user_id);


--
-- Name: recipes_parent_recipe_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipes_parent_recipe_id_index ON public.recipes USING btree (parent_recipe_id);


--
-- Name: recipes_public_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recipes_public_created_at_index ON public.recipes USING btree (is_public, created_at DESC);


--
-- Name: schedule_tasks_unique_fallback_task; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_tasks_unique_fallback_task ON public.schedule_tasks USING btree (user_id, week_plan_entry_id, title, "position") WHERE (recipe_task_id IS NULL);


--
-- Name: schedule_tasks_unique_recipe_task; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_tasks_unique_recipe_task ON public.schedule_tasks USING btree (user_id, week_plan_entry_id, recipe_task_id) WHERE (recipe_task_id IS NOT NULL);


--
-- Name: schedule_tasks_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_tasks_user_date_idx ON public.schedule_tasks USING btree (user_id, task_date, scheduled_start);


--
-- Name: schedule_tasks_week_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_tasks_week_entry_idx ON public.schedule_tasks USING btree (week_plan_entry_id);


--
-- Name: scheduled_tasks_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_tasks_date_index ON public.scheduled_tasks USING btree (user_id, scheduled_date);


--
-- Name: scheduled_tasks_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_tasks_status_index ON public.scheduled_tasks USING btree (user_id, status);


--
-- Name: scheduled_tasks_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_tasks_user_id_index ON public.scheduled_tasks USING btree (user_id);


--
-- Name: scheduled_tasks_weekly_plan_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_tasks_weekly_plan_id_index ON public.scheduled_tasks USING btree (weekly_plan_id);


--
-- Name: shopping_items_ingredient_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shopping_items_ingredient_id_index ON public.shopping_items USING btree (ingredient_id);


--
-- Name: shopping_items_list_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shopping_items_list_id_index ON public.shopping_items USING btree (shopping_list_id);


--
-- Name: shopping_items_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shopping_items_user_id_index ON public.shopping_items USING btree (user_id);


--
-- Name: shopping_lists_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shopping_lists_user_id_index ON public.shopping_lists USING btree (user_id);


--
-- Name: shopping_lists_week_start_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shopping_lists_week_start_index ON public.shopping_lists USING btree (week_start);


--
-- Name: user_recipe_favorites_recipe_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_recipe_favorites_recipe_id_index ON public.user_recipe_favorites USING btree (recipe_id);


--
-- Name: week_plan_entries_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX week_plan_entries_user_date_idx ON public.week_plan_entries USING btree (user_id, meal_date);


--
-- Name: weekly_plans_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_plans_user_id_index ON public.weekly_plans USING btree (user_id);


--
-- Name: weekly_plans_week_start_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_plans_week_start_index ON public.weekly_plans USING btree (week_start);


--
-- Name: account_preferences account_preferences_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER account_preferences_set_updated_at BEFORE UPDATE ON public.account_preferences FOR EACH ROW EXECUTE FUNCTION public.set_account_preferences_updated_at();


--
-- Name: recipes auto_favorite_owned_recipe_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_favorite_owned_recipe_trigger AFTER INSERT ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.auto_favorite_owned_recipe();


--
-- Name: recipes auto_favorite_recipe_owner_change_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_favorite_recipe_owner_change_trigger AFTER UPDATE OF user_id ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.auto_favorite_recipe_after_owner_change();


--
-- Name: day_schedule_preferences day_schedule_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER day_schedule_preferences_updated_at BEFORE UPDATE ON public.day_schedule_preferences FOR EACH ROW EXECUTE FUNCTION public.set_scheduler_updated_at();


--
-- Name: meal_slot_preferences meal_slot_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meal_slot_preferences_updated_at BEFORE UPDATE ON public.meal_slot_preferences FOR EACH ROW EXECUTE FUNCTION public.set_scheduler_updated_at();


--
-- Name: planned_meal_recipes planned_meal_recipes_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER planned_meal_recipes_updated_at_trigger BEFORE UPDATE ON public.planned_meal_recipes FOR EACH ROW EXECUTE FUNCTION public.set_planned_meal_recipe_updated_at();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();


--
-- Name: profiles profiles_sync_recipe_creator_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_sync_recipe_creator_name AFTER UPDATE OF display_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_recipe_creator_name_from_profile();


--
-- Name: recipe_tasks recipe_tasks_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recipe_tasks_updated_at_trigger BEFORE UPDATE ON public.recipe_tasks FOR EACH ROW EXECUTE FUNCTION public.set_scheduler_updated_at();


--
-- Name: schedule_tasks schedule_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER schedule_tasks_updated_at BEFORE UPDATE ON public.schedule_tasks FOR EACH ROW EXECUTE FUNCTION public.set_schedule_task_updated_at();


--
-- Name: scheduled_tasks scheduled_tasks_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scheduled_tasks_updated_at_trigger BEFORE UPDATE ON public.scheduled_tasks FOR EACH ROW EXECUTE FUNCTION public.set_scheduler_updated_at();


--
-- Name: scheduler_preferences scheduler_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scheduler_preferences_updated_at BEFORE UPDATE ON public.scheduler_preferences FOR EACH ROW EXECUTE FUNCTION public.set_scheduler_updated_at();


--
-- Name: recipes set_recipe_creator_name_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_recipe_creator_name_trigger BEFORE INSERT OR UPDATE OF user_id ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.set_recipe_creator_name();


--
-- Name: user_settings user_settings_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_settings_updated_at_trigger BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_user_settings_updated_at();


--
-- Name: planned_meal_recipes validate_planned_meal_recipe_owner_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_planned_meal_recipe_owner_trigger BEFORE INSERT OR UPDATE ON public.planned_meal_recipes FOR EACH ROW EXECUTE FUNCTION public.validate_planned_meal_recipe_owner();


--
-- Name: recipe_ingredients validate_recipe_ingredient_owner_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_recipe_ingredient_owner_trigger BEFORE INSERT OR UPDATE ON public.recipe_ingredients FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_ingredient_owner();


--
-- Name: recipe_tasks validate_recipe_task_owner_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_recipe_task_owner_trigger BEFORE INSERT OR UPDATE ON public.recipe_tasks FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_task_owner();


--
-- Name: scheduled_tasks validate_scheduled_task_owner_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_scheduled_task_owner_trigger BEFORE INSERT OR UPDATE ON public.scheduled_tasks FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_task_owner();


--
-- Name: week_plan_entries week_plan_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER week_plan_entries_updated_at BEFORE UPDATE ON public.week_plan_entries FOR EACH ROW EXECUTE FUNCTION public.set_week_plan_updated_at();


--
-- Name: account_preferences account_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_preferences
    ADD CONSTRAINT account_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cooking_blocks cooking_blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooking_blocks
    ADD CONSTRAINT cooking_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cooking_blocks cooking_blocks_weekly_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cooking_blocks
    ADD CONSTRAINT cooking_blocks_weekly_plan_id_fkey FOREIGN KEY (weekly_plan_id) REFERENCES public.weekly_plans(id) ON DELETE CASCADE;


--
-- Name: day_schedule_preferences day_schedule_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_schedule_preferences
    ADD CONSTRAINT day_schedule_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ingredients ingredients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: meal_slot_preferences meal_slot_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_slot_preferences
    ADD CONSTRAINT meal_slot_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pantry_items pantry_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pantry_items
    ADD CONSTRAINT pantry_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: pantry_items pantry_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pantry_items
    ADD CONSTRAINT pantry_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: planned_meal_recipes planned_meal_recipes_planned_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_recipes
    ADD CONSTRAINT planned_meal_recipes_planned_meal_id_fkey FOREIGN KEY (planned_meal_id) REFERENCES public.planned_meals(id) ON DELETE CASCADE;


--
-- Name: planned_meal_recipes planned_meal_recipes_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_recipes
    ADD CONSTRAINT planned_meal_recipes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: planned_meal_recipes planned_meal_recipes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_recipes
    ADD CONSTRAINT planned_meal_recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: planned_meals planned_meals_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE RESTRICT;


--
-- Name: planned_meals planned_meals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: planned_meals planned_meals_weekly_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_weekly_plan_id_fkey FOREIGN KEY (weekly_plan_id) REFERENCES public.weekly_plans(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recipe_steps recipe_steps_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_steps recipe_steps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recipe_tasks recipe_tasks_depends_on_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_tasks
    ADD CONSTRAINT recipe_tasks_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.recipe_tasks(id) ON DELETE SET NULL;


--
-- Name: recipe_tasks recipe_tasks_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_tasks
    ADD CONSTRAINT recipe_tasks_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipe_tasks recipe_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_tasks
    ADD CONSTRAINT recipe_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_parent_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_parent_recipe_id_fkey FOREIGN KEY (parent_recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;


--
-- Name: recipes recipes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: schedule_tasks schedule_tasks_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_tasks
    ADD CONSTRAINT schedule_tasks_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE RESTRICT;


--
-- Name: schedule_tasks schedule_tasks_recipe_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_tasks
    ADD CONSTRAINT schedule_tasks_recipe_task_id_fkey FOREIGN KEY (recipe_task_id) REFERENCES public.recipe_tasks(id) ON DELETE SET NULL;


--
-- Name: schedule_tasks schedule_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_tasks
    ADD CONSTRAINT schedule_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: schedule_tasks schedule_tasks_week_plan_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_tasks
    ADD CONSTRAINT schedule_tasks_week_plan_entry_id_fkey FOREIGN KEY (week_plan_entry_id) REFERENCES public.week_plan_entries(id) ON DELETE CASCADE;


--
-- Name: scheduled_tasks scheduled_tasks_planned_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_planned_meal_id_fkey FOREIGN KEY (planned_meal_id) REFERENCES public.planned_meals(id) ON DELETE CASCADE;


--
-- Name: scheduled_tasks scheduled_tasks_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;


--
-- Name: scheduled_tasks scheduled_tasks_recipe_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_recipe_task_id_fkey FOREIGN KEY (recipe_task_id) REFERENCES public.recipe_tasks(id) ON DELETE SET NULL;


--
-- Name: scheduled_tasks scheduled_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scheduled_tasks scheduled_tasks_weekly_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_weekly_plan_id_fkey FOREIGN KEY (weekly_plan_id) REFERENCES public.weekly_plans(id) ON DELETE CASCADE;


--
-- Name: scheduler_preferences scheduler_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_preferences
    ADD CONSTRAINT scheduler_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shopping_items shopping_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- Name: shopping_items shopping_items_shopping_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_shopping_list_id_fkey FOREIGN KEY (shopping_list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;


--
-- Name: shopping_items shopping_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shopping_lists shopping_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_recipe_favorites user_recipe_favorites_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recipe_favorites
    ADD CONSTRAINT user_recipe_favorites_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: user_recipe_favorites user_recipe_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recipe_favorites
    ADD CONSTRAINT user_recipe_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: week_plan_entries week_plan_entries_meal_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_plan_entries
    ADD CONSTRAINT week_plan_entries_meal_slot_id_fkey FOREIGN KEY (meal_slot_id) REFERENCES public.meal_slot_preferences(id) ON DELETE CASCADE;


--
-- Name: week_plan_entries week_plan_entries_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_plan_entries
    ADD CONSTRAINT week_plan_entries_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE RESTRICT;


--
-- Name: week_plan_entries week_plan_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_plan_entries
    ADD CONSTRAINT week_plan_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: weekly_plans weekly_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: recipes Authenticated users can view public recipes and their own recip; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view public recipes and their own recip" ON public.recipes FOR SELECT TO authenticated USING (((is_public = true) OR (user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: recipe_ingredients Authenticated users can view visible recipe ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view visible recipe ingredients" ON public.recipe_ingredients FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_ingredients.recipe_id) AND ((recipe.is_public = true) OR (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_steps Authenticated users can view visible recipe steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view visible recipe steps" ON public.recipe_steps FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_steps.recipe_id) AND ((recipe.is_public = true) OR (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_tasks Authenticated users can view visible recipe tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view visible recipe tasks" ON public.recipe_tasks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_tasks.recipe_id) AND ((recipe.is_public = true) OR (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: profiles Public profiles are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are readable" ON public.profiles FOR SELECT TO authenticated USING (((public_profile_enabled = true) OR (user_id = auth.uid())));


--
-- Name: recipe_ingredients Recipe owners can create recipe ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can create recipe ingredients" ON public.recipe_ingredients FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_ingredients.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_steps Recipe owners can create recipe steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can create recipe steps" ON public.recipe_steps FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_steps.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_tasks Recipe owners can create recipe tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can create recipe tasks" ON public.recipe_tasks FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_tasks.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_ingredients Recipe owners can delete recipe ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can delete recipe ingredients" ON public.recipe_ingredients FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_ingredients.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_steps Recipe owners can delete recipe steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can delete recipe steps" ON public.recipe_steps FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_steps.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_tasks Recipe owners can delete recipe tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can delete recipe tasks" ON public.recipe_tasks FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_tasks.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipes Recipe owners can delete recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can delete recipes" ON public.recipes FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: recipe_ingredients Recipe owners can update recipe ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can update recipe ingredients" ON public.recipe_ingredients FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_ingredients.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_ingredients.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_steps Recipe owners can update recipe steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can update recipe steps" ON public.recipe_steps FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_steps.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_steps.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipe_tasks Recipe owners can update recipe tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can update recipe tasks" ON public.recipe_tasks FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_tasks.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = recipe_tasks.recipe_id) AND (recipe.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: recipes Recipe owners can update recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recipe owners can update recipes" ON public.recipes FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: cooking_blocks Users can create their own cooking blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own cooking blocks" ON public.cooking_blocks FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ingredients Users can create their own ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own ingredients" ON public.ingredients FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: pantry_items Users can create their own pantry items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own pantry items" ON public.pantry_items FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meal_recipes Users can create their own planned meal recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own planned meal recipes" ON public.planned_meal_recipes FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meals Users can create their own planned meals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own planned meals" ON public.planned_meals FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_recipe_favorites Users can create their own recipe favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own recipe favorites" ON public.user_recipe_favorites FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.recipes recipe
  WHERE ((recipe.id = user_recipe_favorites.recipe_id) AND ((recipe.is_public = true) OR (recipe.user_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: recipes Users can create their own recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: scheduled_tasks Users can create their own scheduled tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own scheduled tasks" ON public.scheduled_tasks FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can create their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: shopping_items Users can create their own shopping items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own shopping items" ON public.shopping_items FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: shopping_lists Users can create their own shopping lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own shopping lists" ON public.shopping_lists FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can create their own weekly plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own weekly plans" ON public.weekly_plans FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: account_preferences Users can delete their own account preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own account preferences" ON public.account_preferences FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: cooking_blocks Users can delete their own cooking blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own cooking blocks" ON public.cooking_blocks FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ingredients Users can delete their own ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own ingredients" ON public.ingredients FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: pantry_items Users can delete their own pantry items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own pantry items" ON public.pantry_items FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meal_recipes Users can delete their own planned meal recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own planned meal recipes" ON public.planned_meal_recipes FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meals Users can delete their own planned meals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own planned meals" ON public.planned_meals FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can delete their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_recipe_favorites Users can delete their own recipe favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own recipe favorites" ON public.user_recipe_favorites FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: scheduled_tasks Users can delete their own scheduled tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own scheduled tasks" ON public.scheduled_tasks FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can delete their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own settings" ON public.user_settings FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: shopping_items Users can delete their own shopping items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own shopping items" ON public.shopping_items FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: shopping_lists Users can delete their own shopping lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own shopping lists" ON public.shopping_lists FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can delete their own weekly plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own weekly plans" ON public.weekly_plans FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: account_preferences Users can insert their own account preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own account preferences" ON public.account_preferences FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: account_preferences Users can read their own account preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own account preferences" ON public.account_preferences FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: account_preferences Users can update their own account preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own account preferences" ON public.account_preferences FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: cooking_blocks Users can update their own cooking blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own cooking blocks" ON public.cooking_blocks FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ingredients Users can update their own ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own ingredients" ON public.ingredients FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: pantry_items Users can update their own pantry items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own pantry items" ON public.pantry_items FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meal_recipes Users can update their own planned meal recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own planned meal recipes" ON public.planned_meal_recipes FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meals Users can update their own planned meals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own planned meals" ON public.planned_meals FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: scheduled_tasks Users can update their own scheduled tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own scheduled tasks" ON public.scheduled_tasks FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can update their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: shopping_items Users can update their own shopping items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own shopping items" ON public.shopping_items FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: shopping_lists Users can update their own shopping lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own shopping lists" ON public.shopping_lists FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can update their own weekly plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own weekly plans" ON public.weekly_plans FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: cooking_blocks Users can view their own cooking blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own cooking blocks" ON public.cooking_blocks FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ingredients Users can view their own ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own ingredients" ON public.ingredients FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: pantry_items Users can view their own pantry items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own pantry items" ON public.pantry_items FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meal_recipes Users can view their own planned meal recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own planned meal recipes" ON public.planned_meal_recipes FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: planned_meals Users can view their own planned meals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own planned meals" ON public.planned_meals FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_recipe_favorites Users can view their own recipe favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own recipe favorites" ON public.user_recipe_favorites FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: scheduled_tasks Users can view their own scheduled tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scheduled tasks" ON public.scheduled_tasks FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: user_settings Users can view their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: shopping_items Users can view their own shopping items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own shopping items" ON public.shopping_items FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: shopping_lists Users can view their own shopping lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own shopping lists" ON public.shopping_lists FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: weekly_plans Users can view their own weekly plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly plans" ON public.weekly_plans FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: day_schedule_preferences Users manage day schedule preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage day schedule preferences" ON public.day_schedule_preferences TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: meal_slot_preferences Users manage meal slot preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage meal slot preferences" ON public.meal_slot_preferences TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: scheduler_preferences Users manage scheduler preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage scheduler preferences" ON public.scheduler_preferences TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: schedule_tasks Users manage their schedule tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their schedule tasks" ON public.schedule_tasks TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: week_plan_entries Users manage their weekly plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their weekly plans" ON public.week_plan_entries TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: account_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: cooking_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cooking_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: day_schedule_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.day_schedule_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: meal_slot_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meal_slot_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: pantry_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

--
-- Name: planned_meal_recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planned_meal_recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: planned_meals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipe_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduler_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduler_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: shopping_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

--
-- Name: shopping_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: user_recipe_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_recipe_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: week_plan_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.week_plan_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict yB9UH4C0d0lSxdYIXcRDuMQs5h5S8lPf2HFubtuFLED71hxGISypDoRSkJdjXWc

