-- =========================================================
-- USER SETTINGS + FLEXIBLE DAILY MEAL SLOTS
-- Run this once in the Supabase SQL editor.
-- =========================================================

create table if not exists public.user_settings (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  conflict_grouping_minutes integer not null default 60
    check (conflict_grouping_minutes between 15 and 180),

  preferred_batch_day text not null default 'sunday'
    check (
      preferred_batch_day in (
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      )
    ),

  preserve_manual_tasks boolean not null default true,
  day_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings
  enable row level security;

drop policy if exists
  "Users can view their own settings"
on public.user_settings;

drop policy if exists
  "Users can create their own settings"
on public.user_settings;

drop policy if exists
  "Users can update their own settings"
on public.user_settings;

drop policy if exists
  "Users can delete their own settings"
on public.user_settings;

create policy
  "Users can view their own settings"
on public.user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy
  "Users can create their own settings"
on public.user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy
  "Users can update their own settings"
on public.user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy
  "Users can delete their own settings"
on public.user_settings
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function
public.set_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
  user_settings_updated_at_trigger
on public.user_settings;

create trigger
  user_settings_updated_at_trigger
before update
on public.user_settings
for each row
execute function public.set_user_settings_updated_at();

-- =========================================================
-- PLANNED MEAL SLOT METADATA
-- =========================================================

alter table public.planned_meals
  add column if not exists meal_slot_id text;

alter table public.planned_meals
  add column if not exists meal_slot_name text;

alter table public.planned_meals
  add column if not exists meal_category text;

alter table public.planned_meals
  add column if not exists meal_time time;

alter table public.planned_meals
  add column if not exists ready_by_time time;

alter table public.planned_meals
  add column if not exists preparation_mode text;

update public.planned_meals
set
  meal_slot_id = coalesce(
    meal_slot_id,
    lower(regexp_replace(trim(meal_type::text), '[^a-zA-Z0-9]+', '-', 'g'))
  ),
  meal_slot_name = coalesce(meal_slot_name, meal_type::text),
  meal_category = coalesce(meal_category, lower(meal_type::text)),
  meal_time = coalesce(
    meal_time,
    case lower(meal_type::text)
      when 'breakfast' then '08:00'::time
      when 'lunch' then '12:30'::time
      when 'snack' then '17:00'::time
      when 'dinner' then '19:30'::time
      else '12:00'::time
    end
  ),
  ready_by_time = coalesce(
    ready_by_time,
    case lower(meal_type::text)
      when 'lunch' then '08:10'::time
      when 'snack' then '08:15'::time
      else meal_time
    end
  ),
  preparation_mode = coalesce(
    preparation_mode,
    case lower(meal_type::text)
      when 'lunch' then 'packed'
      when 'snack' then 'packed'
      else 'fresh'
    end
  );

alter table public.planned_meals
  alter column meal_slot_id set not null;

alter table public.planned_meals
  alter column meal_slot_name set not null;

alter table public.planned_meals
  alter column meal_category set not null;

alter table public.planned_meals
  alter column meal_time set not null;

alter table public.planned_meals
  alter column ready_by_time set not null;

alter table public.planned_meals
  alter column preparation_mode set not null;

-- Remove the old uniqueness rule that allowed only one row per
-- day + fixed meal type. The exact generated constraint name can
-- vary, so this block finds it by its participating columns.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel
      on rel.oid = con.conrelid
    join pg_namespace nsp
      on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'planned_meals'
      and con.contype = 'u'
      and (
        select array_agg(att.attname order by key_columns.ordinality)
        from unnest(con.conkey) with ordinality as key_columns(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = rel.oid
         and att.attnum = key_columns.attnum
      ) = array['weekly_plan_id', 'day_index', 'meal_type']
  loop
    execute format(
      'alter table public.planned_meals drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

create unique index if not exists
  planned_meals_week_day_slot_unique
on public.planned_meals (
  weekly_plan_id,
  day_index,
  meal_slot_id
);

create index if not exists
  planned_meals_slot_lookup_index
on public.planned_meals (
  weekly_plan_id,
  day_index,
  meal_slot_id
);

-- The old cooking_blocks table is intentionally left in place so
-- no historical data is destroyed. The updated Week page and
-- scheduler no longer read from it.
