begin;

alter table public.recipes
  add column if not exists
    analysis_status text
    not null default 'pending';

alter table public.recipes
  add column if not exists
    analysis_version text;

alter table public.recipes
  add column if not exists
    compliance_score numeric
    not null default 0;

alter table public.recipes
  add column if not exists
    last_analyzed_at timestamptz;

alter table public.recipes
  drop constraint if exists
    recipes_analysis_status_check;

alter table public.recipes
  add constraint
    recipes_analysis_status_check
  check (
    analysis_status in (
      'pending',
      'analyzing',
      'needs_review',
      'compliant',
      'failed'
    )
  );

alter table public.recipes
  drop constraint if exists
    recipes_compliance_score_check;

alter table public.recipes
  add constraint
    recipes_compliance_score_check
  check (
    compliance_score >= 0
    and compliance_score <= 1
  );

create table if not exists
  public.recipe_prep_operations (
    id uuid primary key
      default gen_random_uuid(),
    recipe_id uuid not null
      references public.recipes(id)
      on delete cascade,
    user_id uuid not null
      references auth.users(id)
      on delete cascade,
    ingredient_position integer not null,
    source_step_positions integer[]
      not null default '{}',
    canonical_ingredient_name text
      not null,
    display_ingredient_name text
      not null,
    action text not null,
    preparation_state text not null,
    quantity numeric not null,
    unit text not null,
    can_make_ahead boolean
      not null default false,
    maximum_make_ahead_hours integer
      not null default 0,
    storage_method text
      not null default 'none',
    batch_key text not null,
    confidence numeric
      not null default 1,
    manually_edited boolean
      not null default false,
    analysis_version text not null,
    position integer not null default 0,
    created_at timestamptz
      not null default now(),
    updated_at timestamptz
      not null default now(),
    constraint
      recipe_prep_operations_quantity_check
      check (quantity > 0),
    constraint
      recipe_prep_operations_make_ahead_check
      check (
        maximum_make_ahead_hours >= 0
      ),
    constraint
      recipe_prep_operations_confidence_check
      check (
        confidence >= 0
        and confidence <= 1
      )
  );

create unique index if not exists
  recipe_prep_operations_recipe_position_key
on public.recipe_prep_operations (
  recipe_id,
  position
);

create index if not exists
  recipe_prep_operations_batch_key_idx
on public.recipe_prep_operations (
  batch_key
);

create table if not exists
  public.recipe_compliance_issues (
    id uuid primary key
      default gen_random_uuid(),
    recipe_id uuid not null
      references public.recipes(id)
      on delete cascade,
    user_id uuid not null
      references auth.users(id)
      on delete cascade,
    code text not null,
    severity text not null,
    title text not null,
    message text not null,
    ingredient_position integer,
    step_position integer,
    created_at timestamptz
      not null default now(),
    constraint
      recipe_compliance_issues_severity_check
      check (
        severity in (
          'advisory',
          'review',
          'blocking'
        )
      )
  );

alter table
  public.recipe_prep_operations
enable row level security;

alter table
  public.recipe_compliance_issues
enable row level security;

drop policy if exists
  "Users can view recipe prep operations"
on public.recipe_prep_operations;

create policy
  "Users can view recipe prep operations"
on public.recipe_prep_operations
for select
to authenticated
using (
  exists (
    select 1
    from public.recipes
    where recipes.id =
      recipe_prep_operations.recipe_id
    and (
      recipes.is_public = true
      or recipes.user_id = auth.uid()
    )
  )
);

drop policy if exists
  "Owners can manage recipe prep operations"
on public.recipe_prep_operations;

create policy
  "Owners can manage recipe prep operations"
on public.recipe_prep_operations
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists
  "Owners can manage recipe compliance issues"
on public.recipe_compliance_issues;

create policy
  "Owners can manage recipe compliance issues"
on public.recipe_compliance_issues
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

notify pgrst, 'reload schema';

commit;
