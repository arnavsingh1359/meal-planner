begin;

create table if not exists
  public.scheduler_preferences (
    user_id uuid primary key
      references auth.users(id)
      on delete cascade,

    conflict_grouping_minutes integer
      not null default 60
      check (
        conflict_grouping_minutes
          between 1 and 1_440
      ),

    preferred_batch_days text[]
      not null default
        array[
          'saturday',
          'sunday'
        ]::text[],

    preserve_manual_adjustments boolean
      not null default true,

    created_at timestamptz
      not null default now(),

    updated_at timestamptz
      not null default now()
  );

create table if not exists
  public.day_schedule_preferences (
    user_id uuid not null
      references auth.users(id)
      on delete cascade,

    day_of_week integer not null
      check (
        day_of_week between 1 and 7
      ),

    earliest_task_time time
      not null default '09:00',

    latest_task_time time
      not null default '21:30',

    leave_home_time time
      not null default '08:30',

    return_home_time time
      not null default '18:00',

    evening_prep_start time
      not null default '18:30',

    evening_prep_end time
      not null default '21:00',

    max_active_cooking_minutes integer
      not null default 75
      check (
        max_active_cooking_minutes
          between 0 and 1_440
      ),

    cooking_allowed boolean
      not null default true,

    created_at timestamptz
      not null default now(),

    updated_at timestamptz
      not null default now(),

    primary key (
      user_id,
      day_of_week
    )
  );

create table if not exists
  public.meal_slot_preferences (
    id uuid primary key
      default gen_random_uuid(),

    user_id uuid not null
      references auth.users(id)
      on delete cascade,

    day_of_week integer not null
      check (
        day_of_week between 1 and 7
      ),

    position integer not null
      check (position >= 0),

    name text not null
      check (
        length(trim(name)) > 0
      ),

    recipe_category text not null
      check (
        recipe_category in (
          'breakfast',
          'lunch',
          'dinner',
          'snack',
          'any'
        )
      ),

    eat_time time not null,

    ready_time time not null,

    preparation_mode text not null
      check (
        preparation_mode in (
          'fresh',
          'packed',
          'leftovers',
          'batch_prepared'
        )
      ),

    created_at timestamptz
      not null default now(),

    updated_at timestamptz
      not null default now(),

    unique (
      user_id,
      day_of_week,
      position
    )
  );

alter table
  public.scheduler_preferences
enable row level security;

alter table
  public.day_schedule_preferences
enable row level security;

alter table
  public.meal_slot_preferences
enable row level security;

drop policy if exists
  "Users manage scheduler preferences"
on public.scheduler_preferences;

create policy
  "Users manage scheduler preferences"
on public.scheduler_preferences
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists
  "Users manage day schedule preferences"
on public.day_schedule_preferences;

create policy
  "Users manage day schedule preferences"
on public.day_schedule_preferences
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists
  "Users manage meal slot preferences"
on public.meal_slot_preferences;

create policy
  "Users manage meal slot preferences"
on public.meal_slot_preferences
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

grant select, insert, update, delete
on public.scheduler_preferences
to authenticated;

grant select, insert, update, delete
on public.day_schedule_preferences
to authenticated;

grant select, insert, update, delete
on public.meal_slot_preferences
to authenticated;

create or replace function
  public.set_scheduler_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists
  scheduler_preferences_updated_at
on public.scheduler_preferences;

create trigger
  scheduler_preferences_updated_at
before update
on public.scheduler_preferences
for each row
execute function
  public.set_scheduler_updated_at();

drop trigger if exists
  day_schedule_preferences_updated_at
on public.day_schedule_preferences;

create trigger
  day_schedule_preferences_updated_at
before update
on public.day_schedule_preferences
for each row
execute function
  public.set_scheduler_updated_at();

drop trigger if exists
  meal_slot_preferences_updated_at
on public.meal_slot_preferences;

create trigger
  meal_slot_preferences_updated_at
before update
on public.meal_slot_preferences
for each row
execute function
  public.set_scheduler_updated_at();

insert into public.scheduler_preferences (
  user_id
)
select id
from auth.users
on conflict (user_id)
do nothing;

insert into public.day_schedule_preferences (
  user_id,
  day_of_week
)
select
  users.id,
  days.day_of_week
from auth.users as users
cross join generate_series(
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
  users.id,
  days.day_of_week,
  slots.position,
  slots.name,
  slots.recipe_category,
  slots.eat_time::time,
  slots.ready_time::time,
  slots.preparation_mode
from auth.users as users
cross join generate_series(
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
)
where not exists (
  select 1
  from public.meal_slot_preferences
  where meal_slot_preferences.user_id
    = users.id
    and meal_slot_preferences.day_of_week
      = days.day_of_week
);

create or replace function
  public.create_scheduler_records_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists
  create_scheduler_records_after_signup
on auth.users;

create trigger
  create_scheduler_records_after_signup
after insert
on auth.users
for each row
execute function
  public.create_scheduler_records_for_new_user();

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
    raise exception
      'Authentication required';
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
      select
        jsonb_array_elements_text(
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
    day_rows.day_of_week,
    day_rows.earliest_task_time::time,
    day_rows.latest_task_time::time,
    day_rows.leave_home_time::time,
    day_rows.return_home_time::time,
    day_rows.evening_prep_start::time,
    day_rows.evening_prep_end::time,
    day_rows.max_active_cooking_minutes,
    day_rows.cooking_allowed
  from jsonb_to_recordset(
    p_days
  ) as day_rows(
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

  delete from public.meal_slot_preferences
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
    slot_rows.id,
    current_user_id,
    slot_rows.day_of_week,
    slot_rows.position,
    trim(slot_rows.name),
    slot_rows.recipe_category,
    slot_rows.eat_time::time,
    slot_rows.ready_time::time,
    slot_rows.preparation_mode
  from jsonb_to_recordset(
    p_slots
  ) as slot_rows(
    id uuid,
    day_of_week integer,
    position integer,
    name text,
    recipe_category text,
    eat_time text,
    ready_time text,
    preparation_mode text
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
