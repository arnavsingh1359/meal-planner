begin;

create table if not exists public.profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null default '',
  avatar_url text,
  bio text,

  public_profile_enabled boolean
    not null default true,

  show_avatar_publicly boolean
    not null default true,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists bio text;

alter table public.profiles
  add column if not exists
    public_profile_enabled boolean
    not null default true;

alter table public.profiles
  add column if not exists
    show_avatar_publicly boolean
    not null default true;

alter table public.profiles
  drop constraint if exists
    profiles_display_name_not_blank;

alter table public.profiles
  add constraint
    profiles_display_name_not_blank
  check (
    length(trim(display_name)) > 0
  );

alter table public.profiles
  drop constraint if exists
    profiles_display_name_length;

alter table public.profiles
  add constraint
    profiles_display_name_length
  check (
    length(display_name) <= 80
  );

alter table public.profiles
  drop constraint if exists
    profiles_bio_length;

alter table public.profiles
  add constraint
    profiles_bio_length
  check (
    bio is null
    or length(bio) <= 300
  );

alter table public.profiles
  enable row level security;

drop policy if exists
  "Public profiles are readable"
on public.profiles;

drop policy if exists
  "Users can read their profile"
on public.profiles;

drop policy if exists
  "Users can insert their profile"
on public.profiles;

drop policy if exists
  "Users can update their profile"
on public.profiles;

drop policy if exists
  "Users can insert their own profile"
on public.profiles;

drop policy if exists
  "Users can update their own profile"
on public.profiles;

create policy
  "Public profiles are readable"
on public.profiles
for select
to authenticated
using (
  public_profile_enabled = true
  or user_id = auth.uid()
);

create policy
  "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy
  "Users can update their own profile"
on public.profiles
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create table if not exists
  public.account_preferences (
    user_id uuid primary key
      references auth.users(id)
      on delete cascade,

    time_format text
      not null default '12h'
      check (
        time_format in (
          '12h',
          '24h'
        )
      ),

    measurement_system text
      not null default 'metric'
      check (
        measurement_system in (
          'metric',
          'us'
        )
      ),

    week_starts_on text
      not null default 'monday'
      check (
        week_starts_on in (
          'monday',
          'sunday'
        )
      ),

    default_recipe_tab text
      not null default 'discover'
      check (
        default_recipe_tab in (
          'discover',
          'favorites',
          'mine'
        )
      ),

    created_at timestamptz
      not null default now(),

    updated_at timestamptz
      not null default now()
  );

alter table public.account_preferences
  enable row level security;

drop policy if exists
  "Users can read their own account preferences"
on public.account_preferences;

drop policy if exists
  "Users can insert their own account preferences"
on public.account_preferences;

drop policy if exists
  "Users can update their own account preferences"
on public.account_preferences;

create policy
  "Users can read their own account preferences"
on public.account_preferences
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy
  "Users can insert their own account preferences"
on public.account_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy
  "Users can update their own account preferences"
on public.account_preferences
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create or replace function
  public.set_profile_updated_at()
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
  profiles_set_updated_at
on public.profiles;

create trigger
  profiles_set_updated_at
before update
on public.profiles
for each row
execute function
  public.set_profile_updated_at();

create or replace function
  public.set_account_preferences_updated_at()
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
  account_preferences_set_updated_at
on public.account_preferences;

create trigger
  account_preferences_set_updated_at
before update
on public.account_preferences
for each row
execute function
  public.set_account_preferences_updated_at();

insert into public.profiles (
  user_id,
  display_name,
  avatar_url,
  bio,
  public_profile_enabled,
  show_avatar_publicly,
  created_at,
  updated_at
)
select
  users.id,

  coalesce(
    nullif(
      trim(
        users.raw_user_meta_data
          ->> 'display_name'
      ),
      ''
    ),
    nullif(
      trim(
        users.raw_user_meta_data
          ->> 'full_name'
      ),
      ''
    ),
    nullif(
      split_part(
        coalesce(users.email, ''),
        '@',
        1
      ),
      ''
    ),
    'Meal Planner User'
  ),

  nullif(
    trim(
      users.raw_user_meta_data
        ->> 'avatar_url'
    ),
    ''
  ),

  null,

  true,
  true,

  coalesce(
    users.created_at,
    now()
  ),

  now()
from auth.users as users
on conflict (user_id)
do nothing;

insert into public.account_preferences (
  user_id
)
select id
from auth.users
on conflict (user_id)
do nothing;

create or replace function
  public.create_account_records_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists
  create_profile_after_signup
on auth.users;

drop trigger if exists
  create_account_records_after_signup
on auth.users;

create trigger
  create_account_records_after_signup
after insert
on auth.users
for each row
execute function
  public.create_account_records_for_new_user();

create or replace function
  public.sync_recipe_creator_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists
  profiles_sync_recipe_creator_name
on public.profiles;

create trigger
  profiles_sync_recipe_creator_name
after update of display_name
on public.profiles
for each row
execute function
  public.sync_recipe_creator_name_from_profile();

update public.recipes as recipes
set creator_name =
  profiles.display_name
from public.profiles as profiles
where recipes.user_id =
  profiles.user_id
  and recipes.creator_name
    is distinct from
      profiles.display_name;

create or replace function
  public.delete_current_user()
returns void
language plpgsql
security definer
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

  delete from auth.users
  where id = current_user_id;

  if not found then
    raise exception
      'Account not found';
  end if;
end;
$function$;

revoke all
on function
  public.delete_current_user()
from public;

grant execute
on function
  public.delete_current_user()
to authenticated;

commit;
