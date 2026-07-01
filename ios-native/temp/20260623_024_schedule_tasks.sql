begin;

create table if not exists
  public.schedule_tasks (
    id uuid primary key
      default gen_random_uuid(),

    user_id uuid not null
      references auth.users(id)
      on delete cascade,

    week_start date not null,
    task_date date not null,

    week_plan_entry_id uuid not null
      references public.week_plan_entries(id)
      on delete cascade,

    recipe_id uuid not null
      references public.recipes(id)
      on delete restrict,

    recipe_task_id uuid
      references public.recipe_tasks(id)
      on delete set null,

    title text not null,
    instructions text,

    scheduled_start timestamptz not null,
    scheduled_end timestamptz not null,

    active_minutes integer
      not null default 0
      check (active_minutes >= 0),

    passive_minutes integer
      not null default 0
      check (passive_minutes >= 0),

    is_completed boolean
      not null default false,

    is_manually_adjusted boolean
      not null default false,

    has_conflict boolean
      not null default false,

    warning_message text,

    position integer
      not null default 0
      check (position >= 0),

    created_at timestamptz
      not null default now(),

    updated_at timestamptz
      not null default now()
  );

create index if not exists
  schedule_tasks_user_date_idx
on public.schedule_tasks(
  user_id,
  task_date,
  scheduled_start
);

create index if not exists
  schedule_tasks_week_entry_idx
on public.schedule_tasks(
  week_plan_entry_id
);

alter table public.schedule_tasks
  enable row level security;

drop policy if exists
  "Users manage their schedule tasks"
on public.schedule_tasks;

create policy
  "Users manage their schedule tasks"
on public.schedule_tasks
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

grant select, insert, update, delete
on public.schedule_tasks
to authenticated;

create or replace function
  public.set_schedule_task_updated_at()
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
  schedule_tasks_updated_at
on public.schedule_tasks;

create trigger
  schedule_tasks_updated_at
before update
on public.schedule_tasks
for each row
execute function
  public.set_schedule_task_updated_at();

commit;
