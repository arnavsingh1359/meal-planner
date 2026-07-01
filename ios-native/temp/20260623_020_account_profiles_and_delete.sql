begin;

create table if not exists public.profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null default '',

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

alter table public.profiles
  add column if not exists display_name
    text not null default '';

alter table public.profiles
  add column if not exists created_at
    timestamptz not null default now();

alter table public.profiles
  add column if not exists updated_at
    timestamptz not null default now();

create unique index if not exists
  profiles_user_id_unique
on public.profiles(user_id);

alter table public.profiles
  enable row level security;

drop policy if exists
  "Users can read their profile"
on public.profiles;

create policy
  "Users can read their profile"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists
  "Users can insert their profile"
on public.profiles;

create policy
  "Users can insert their profile"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists
  "Users can update their profile"
on public.profiles;

create policy
  "Users can update their profile"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
  public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists
  create_profile_after_signup
on auth.users;

create trigger
  create_profile_after_signup
after insert
on auth.users
for each row
execute function
  public.create_profile_for_new_user();

insert into public.profiles (
  user_id,
  display_name,
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
      split_part(
        coalesce(users.email, ''),
        '@',
        1
      ),
      ''
    ),
    'Meal Planner User'
  ),
  coalesce(users.created_at, now()),
  now()
from auth.users as users
on conflict (user_id)
do nothing;

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
    raise exception 'Authentication required';
  end if;

  delete from auth.users
  where id = current_user_id;

  if not found then
    raise exception 'Account not found';
  end if;
end;
$function$;

revoke all
on function public.delete_current_user()
from public;

grant execute
on function public.delete_current_user()
to authenticated;

commit;
