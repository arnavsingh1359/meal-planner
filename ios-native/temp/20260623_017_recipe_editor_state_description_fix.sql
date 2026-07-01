begin;

alter table public.recipes
  alter column description set default '';

update public.recipes
set description = ''
where description is null;

alter table public.recipes
  alter column description set not null;

create or replace function public.save_recipe_full(
  p_recipe_id uuid default null,
  p_recipe jsonb default '{}'::jsonb,
  p_ingredients jsonb default '[]'::jsonb,
  p_steps jsonb default '[]'::jsonb,
  p_tasks jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  if jsonb_array_length(
    coalesce(
      p_recipe->'meal_types',
      '[]'::jsonb
    )
  ) = 0 then
    raise exception 'Select at least one meal type';
  end if;

  if v_recipe_id is null then
    select coalesce(
      (
        select display_name
        from public.profiles
        where user_id = v_user_id
      ),
      (
        select split_part(email, '@', 1)
        from auth.users
        where id = v_user_id
      ),
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
      coalesce(
        nullif(
          trim(p_recipe->>'description'),
          ''
        ),
        ''
      ),
      array(
        select lower(trim(value))
        from jsonb_array_elements_text(
          coalesce(
            p_recipe->'meal_types',
            '[]'::jsonb
          )
        )
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
      description = coalesce(
        nullif(
          trim(p_recipe->>'description'),
          ''
        ),
        ''
      ),
      meal_types = array(
        select lower(trim(value))
        from jsonb_array_elements_text(
          coalesce(
            p_recipe->'meal_types',
            '[]'::jsonb
          )
        )
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
      nullif(trim(v_item->>'preparation_note'), ''),
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
    nullif(trim(value->>'instructions'), ''),
    coalesce(nullif(trim(value->>'task_type'), ''), 'preparation'),
    coalesce((value->>'active_minutes')::integer, 0),
    coalesce((value->>'passive_minutes')::integer, 0),
    coalesce((value->>'day_offset')::integer, 0),
    coalesce((value->>'start_before_meal_minutes')::integer, 0),
    coalesce((value->>'can_batch')::boolean, false),
    case
      when coalesce((value->>'can_batch')::boolean, false)
        then nullif(trim(value->>'batch_key'), '')
      else null
    end,
    coalesce((value->>'unattended')::boolean, false),
    coalesce((value->>'blocks_active_work')::boolean, true),
    (value->>'position')::integer
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb));

  insert into public.user_recipe_favorites (
    user_id,
    recipe_id,
    created_at
  )
  values (
    v_user_id,
    v_recipe_id,
    now()
  )
  on conflict (user_id, recipe_id) do nothing;

  return v_recipe_id;
end;
$$;

revoke all
on function public.save_recipe_full(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from public;

grant execute
on function public.save_recipe_full(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
to authenticated;

commit;
