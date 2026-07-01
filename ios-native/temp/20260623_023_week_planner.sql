begin;

create table if not exists public.week_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  meal_date date not null,
  meal_slot_id uuid not null references public.meal_slot_preferences(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  servings numeric not null default 1 check (servings > 0),
  notes text not null default '',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists week_plan_entries_user_date_idx
  on public.week_plan_entries(user_id, meal_date);

alter table public.week_plan_entries enable row level security;

drop policy if exists "Users manage their weekly plans"
on public.week_plan_entries;

create policy "Users manage their weekly plans"
on public.week_plan_entries
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete
on public.week_plan_entries
to authenticated;

create or replace function public.set_week_plan_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists week_plan_entries_updated_at
on public.week_plan_entries;

create trigger week_plan_entries_updated_at
before update on public.week_plan_entries
for each row
execute function public.set_week_plan_updated_at();

commit;
