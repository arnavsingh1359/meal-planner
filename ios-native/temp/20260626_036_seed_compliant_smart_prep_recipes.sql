-- Fully compliant test recipes for smart scheduling.
-- Safe to rerun: only recipes with the marker [SMART_PREP_SEED_V1] are replaced.
-- Change v_email only if you want to seed a different account.

begin;

do $seed$
declare
  v_email text := 'arnavsingh1359@gmail.com';
  v_user_id uuid;
  v_creator_name text;
  v_recipe_id uuid;
  v_ingredient_id uuid;
  v_recipe jsonb;
  v_item jsonb;
  v_pos integer;
  v_data jsonb := $json$
[
  {
    "name":"Smart Prep Chicken Rice Bowl",
    "meal_types":["lunch","dinner"],
    "servings":2,
    "fridge":4,
    "ingredients":[
      ["Chicken breast",400,"g","marinated","marinated"],
      ["Rice",1,"cup","cooked","cooked"],
      ["Onion",1,"unit","diced","diced"],
      ["Garlic",3,"clove","minced","minced"],
      ["Bell pepper",1,"unit","sliced","sliced"],
      ["Soy sauce",2,"tbsp","",null]
    ],
    "steps":[
      ["Dice the onion, mince the garlic, and slice the bell pepper.",12,"active"],
      ["Marinate the chicken with soy sauce and half of the minced garlic.",10,"active"],
      ["Refrigerate the chicken in the marinade.",60,"passive"],
      ["Cook the rice until tender.",25,"active"],
      ["Cook the marinated chicken until fully cooked.",18,"active"],
      ["Cook the onion and bell pepper until softened.",10,"active"],
      ["Assemble the chicken, rice, and vegetables into bowls.",5,"active"]
    ],
    "tasks":[
      ["Dice onion","Dice the onion.","preparation",4,0,180,true,"prep:dice:onion",[0],true,72],
      ["Mince garlic","Mince the garlic.","preparation",3,0,180,true,"prep:mince:garlic",[0],true,72],
      ["Slice bell pepper","Slice the bell pepper.","preparation",5,0,180,true,"prep:slice:bell_pepper",[0],true,72],
      ["Marinate chicken","Marinate and refrigerate the chicken.","marinating",10,60,120,false,"",[1,2],true,24],
      ["Cook rice","Cook the rice.","cooking",5,20,45,true,"prep:cook:rice",[3],true,72],
      ["Cook and assemble bowl","Cook the chicken and vegetables, then assemble.","cooking",33,0,35,false,"",[4,5,6],false,0]
    ],
    "ops":[
      [2,[0],"onion","Onion","dice","diced",1,"unit",72,"prep:dice:onion"],
      [3,[0],"garlic","Garlic","mince","minced",3,"clove",72,"prep:mince:garlic"],
      [4,[0],"bell pepper","Bell pepper","slice","sliced",1,"unit",72,"prep:slice:bell_pepper"],
      [0,[1,2],"chicken breast","Chicken breast","marinate","marinated",400,"g",24,"prep:marinate:chicken_breast"],
      [1,[3],"rice","Rice","cook","cooked",1,"cup",72,"prep:cook:rice"]
    ]
  },
  {
    "name":"Smart Prep Chickpea Curry",
    "meal_types":["lunch","dinner"],
    "servings":4,
    "fridge":5,
    "ingredients":[
      ["Chickpeas",2,"can","drained","drained"],
      ["Onion",1,"unit","diced","diced"],
      ["Garlic",3,"clove","minced","minced"],
      ["Tomato",2,"unit","diced","diced"],
      ["Ginger",1,"tbsp","grated","grated"],
      ["Rice",1.5,"cup","cooked","cooked"],
      ["Coconut milk",1,"can","",null]
    ],
    "steps":[
      ["Dice the onion and tomatoes, mince the garlic, and grate the ginger.",15,"active"],
      ["Drain and rinse the chickpeas.",3,"active"],
      ["Cook the rice until tender.",25,"active"],
      ["Cook the onion, garlic, ginger, and spices until fragrant.",8,"active"],
      ["Add the tomatoes, chickpeas, and coconut milk.",5,"active"],
      ["Simmer the curry until thickened.",20,"passive"],
      ["Serve the curry with rice.",3,"active"]
    ],
    "tasks":[
      ["Dice onion","Dice the onion.","preparation",4,0,180,true,"prep:dice:onion",[0],true,72],
      ["Mince garlic","Mince the garlic.","preparation",3,0,180,true,"prep:mince:garlic",[0],true,72],
      ["Dice tomato","Dice the tomatoes.","preparation",5,0,180,true,"prep:dice:tomato",[0],true,48],
      ["Grate ginger","Grate the ginger.","preparation",3,0,180,true,"prep:grate:ginger",[0],true,48],
      ["Cook rice","Cook the rice.","cooking",5,20,45,true,"prep:cook:rice",[2],true,72],
      ["Cook chickpea curry","Cook and simmer the curry.","cooking",16,20,40,false,"",[3,4,5,6],false,0]
    ],
    "ops":[
      [1,[0],"onion","Onion","dice","diced",1,"unit",72,"prep:dice:onion"],
      [2,[0],"garlic","Garlic","mince","minced",3,"clove",72,"prep:mince:garlic"],
      [3,[0],"tomato","Tomato","dice","diced",2,"unit",48,"prep:dice:tomato"],
      [4,[0],"ginger","Ginger","grate","grated",1,"tbsp",48,"prep:grate:ginger"],
      [5,[2],"rice","Rice","cook","cooked",1.5,"cup",72,"prep:cook:rice"]
    ]
  },
  {
    "name":"Smart Prep Pasta Primavera",
    "meal_types":["lunch","dinner"],
    "servings":4,
    "fridge":4,
    "ingredients":[
      ["Pasta",350,"g","",null],
      ["Onion",1,"unit","diced","diced"],
      ["Garlic",3,"clove","minced","minced"],
      ["Bell pepper",1,"unit","sliced","sliced"],
      ["Zucchini",1,"unit","sliced","sliced"],
      ["Cherry tomatoes",250,"g","halved","halved"]
    ],
    "steps":[
      ["Dice the onion, mince the garlic, slice the bell pepper and zucchini, and halve the cherry tomatoes.",15,"active"],
      ["Boil the pasta until al dente.",12,"active"],
      ["Cook the onion, garlic, bell pepper, and zucchini until tender.",12,"active"],
      ["Add the cherry tomatoes and cook briefly.",4,"active"],
      ["Combine the pasta and vegetables, then serve.",5,"active"]
    ],
    "tasks":[
      ["Dice onion","Dice the onion.","preparation",4,0,150,true,"prep:dice:onion",[0],true,72],
      ["Mince garlic","Mince the garlic.","preparation",3,0,150,true,"prep:mince:garlic",[0],true,72],
      ["Slice bell pepper","Slice the bell pepper.","preparation",4,0,150,true,"prep:slice:bell_pepper",[0],true,72],
      ["Slice zucchini","Slice the zucchini.","preparation",4,0,150,true,"prep:slice:zucchini",[0],true,48],
      ["Cook pasta primavera","Boil pasta and cook vegetables.","cooking",29,0,35,false,"",[1,2,3,4],false,0]
    ],
    "ops":[
      [1,[0],"onion","Onion","dice","diced",1,"unit",72,"prep:dice:onion"],
      [2,[0],"garlic","Garlic","mince","minced",3,"clove",72,"prep:mince:garlic"],
      [3,[0],"bell pepper","Bell pepper","slice","sliced",1,"unit",72,"prep:slice:bell_pepper"],
      [4,[0],"zucchini","Zucchini","slice","sliced",1,"unit",48,"prep:slice:zucchini"]
    ]
  },
  {
    "name":"Smart Prep Vegetable Omelette",
    "meal_types":["breakfast","lunch"],
    "servings":2,
    "fridge":1,
    "ingredients":[
      ["Eggs",4,"unit","",null],
      ["Onion",0.5,"unit","diced","diced"],
      ["Bell pepper",0.5,"unit","diced","diced"],
      ["Spinach",60,"g","washed","washed"],
      ["Cheddar cheese",40,"g","grated","grated"]
    ],
    "steps":[
      ["Dice the onion and bell pepper, wash the spinach, and grate the cheese.",10,"active"],
      ["Whisk the eggs.",3,"active"],
      ["Cook the onion, bell pepper, and spinach.",5,"active"],
      ["Add the eggs and cook until nearly set.",5,"active"],
      ["Add the grated cheese, fold the omelette, and serve.",3,"active"]
    ],
    "tasks":[
      ["Dice onion","Dice the onion.","preparation",3,0,90,true,"prep:dice:onion",[0],true,48],
      ["Dice bell pepper","Dice the bell pepper.","preparation",3,0,90,true,"prep:dice:bell_pepper",[0],true,48],
      ["Wash spinach","Wash the spinach.","preparation",2,0,90,true,"prep:wash:spinach",[0],true,24],
      ["Grate cheese","Grate the cheese.","preparation",2,0,90,true,"prep:grate:cheddar_cheese",[0],true,48],
      ["Cook omelette","Whisk and cook the omelette.","cooking",16,0,20,false,"",[1,2,3,4],false,0]
    ],
    "ops":[
      [1,[0],"onion","Onion","dice","diced",0.5,"unit",48,"prep:dice:onion"],
      [2,[0],"bell pepper","Bell pepper","dice","diced",0.5,"unit",48,"prep:dice:bell_pepper"],
      [3,[0],"spinach","Spinach","wash","washed",60,"g",24,"prep:wash:spinach"],
      [4,[0],"cheddar cheese","Cheddar cheese","grate","grated",40,"g",48,"prep:grate:cheddar_cheese"]
    ]
  },
  {
    "name":"Smart Prep Lentil Soup",
    "meal_types":["lunch","dinner"],
    "servings":6,
    "fridge":5,
    "ingredients":[
      ["Brown lentils",2,"cup","rinsed","rinsed"],
      ["Onion",1,"unit","diced","diced"],
      ["Garlic",3,"clove","minced","minced"],
      ["Carrot",2,"unit","diced","diced"],
      ["Celery",2,"stalk","sliced","sliced"],
      ["Vegetable stock",6,"cup","",null]
    ],
    "steps":[
      ["Dice the onion and carrots, mince the garlic, and slice the celery.",15,"active"],
      ["Rinse the lentils.",2,"active"],
      ["Cook the onion, carrot, celery, and garlic until softened.",10,"active"],
      ["Add the lentils and vegetable stock.",5,"active"],
      ["Simmer until the lentils are tender.",35,"passive"],
      ["Season the soup and serve.",3,"active"]
    ],
    "tasks":[
      ["Dice onion","Dice the onion.","preparation",4,0,180,true,"prep:dice:onion",[0],true,72],
      ["Mince garlic","Mince the garlic.","preparation",3,0,180,true,"prep:mince:garlic",[0],true,72],
      ["Dice carrot","Dice the carrots.","preparation",5,0,180,true,"prep:dice:carrot",[0],true,72],
      ["Slice celery","Slice the celery.","preparation",3,0,180,true,"prep:slice:celery",[0],true,72],
      ["Cook lentil soup","Cook and simmer the soup.","cooking",18,35,55,false,"",[1,2,3,4,5],false,0]
    ],
    "ops":[
      [1,[0],"onion","Onion","dice","diced",1,"unit",72,"prep:dice:onion"],
      [2,[0],"garlic","Garlic","mince","minced",3,"clove",72,"prep:mince:garlic"],
      [3,[0],"carrot","Carrot","dice","diced",2,"unit",72,"prep:dice:carrot"],
      [4,[0],"celery","Celery","slice","sliced",2,"stalk",72,"prep:slice:celery"]
    ]
  }
]
$json$::jsonb;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No auth user found for %', v_email;
  end if;

  select coalesce(nullif(trim(display_name), ''), split_part(v_email, '@', 1))
  into v_creator_name
  from public.profiles
  where user_id = v_user_id;

  v_creator_name := coalesce(v_creator_name, split_part(v_email, '@', 1));

  delete from public.recipes
  where user_id = v_user_id
    and description like '[SMART_PREP_SEED_V1]%';

  for v_recipe in select value from jsonb_array_elements(v_data)
  loop
    insert into public.recipes (
      user_id, name, description, meal_types,
      default_servings, minimum_batch_servings, maximum_batch_servings,
      preparation_minutes, cooking_minutes, cleanup_minutes,
      refrigerator_life_days, freezer_allowed, freezer_life_days,
      is_public, creator_name, analysis_status, analysis_version,
      compliance_score, last_analyzed_at
    )
    values (
      v_user_id,
      v_recipe->>'name',
      '[SMART_PREP_SEED_V1] Controlled compliant recipe for scheduler testing.',
      array(select jsonb_array_elements_text(v_recipe->'meal_types')),
      (v_recipe->>'servings')::numeric,
      greatest(1, (v_recipe->>'servings')::numeric / 2),
      least(10, greatest(4, (v_recipe->>'servings')::numeric * 2)),
      0, 0, 0,
      (v_recipe->>'fridge')::integer,
      false, null, true, v_creator_name,
      'compliant', 'prep-compliance-v1', 1, now()
    )
    returning id into v_recipe_id;

    v_pos := 0;
    for v_item in select value from jsonb_array_elements(v_recipe->'ingredients')
    loop
      select id into v_ingredient_id
      from public.ingredients
      where user_id = v_user_id
        and lower(trim(name)) = lower(trim(v_item->>0))
      order by created_at
      limit 1;

      if v_ingredient_id is null then
        insert into public.ingredients (
          user_id, name, category, default_unit, approximate_allowed
        ) values (
          v_user_id, v_item->>0, 'Other', v_item->>2, true
        ) returning id into v_ingredient_id;
      end if;

      insert into public.recipe_ingredients (
        recipe_id, user_id, ingredient_id, name, quantity, unit,
        preparation_note, is_optional, scaling_behavior,
        shopping_included, preparation_state, position
      ) values (
        v_recipe_id, v_user_id, v_ingredient_id, v_item->>0,
        (v_item->>1)::numeric, v_item->>2, coalesce(v_item->>3, ''),
        false, 'linear', true,
        case when jsonb_typeof(v_item->4) = 'null' then null else v_item->>4 end,
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;

    v_pos := 0;
    for v_item in select value from jsonb_array_elements(v_recipe->'steps')
    loop
      insert into public.recipe_steps (
        recipe_id, user_id, instruction, duration_minutes, step_type, position
      ) values (
        v_recipe_id, v_user_id, v_item->>0,
        (v_item->>1)::integer, v_item->>2, v_pos
      );
      v_pos := v_pos + 1;
    end loop;

    v_pos := 0;
    for v_item in select value from jsonb_array_elements(v_recipe->'tasks')
    loop
      insert into public.recipe_tasks (
        recipe_id, user_id, title, instructions, task_type,
        active_minutes, passive_minutes, day_offset,
        start_before_meal_minutes, can_batch, batch_key,
        unattended, blocks_active_work, source_step_positions,
        inference_source, inference_version, confidence, manually_edited,
        can_make_ahead, maximum_make_ahead_hours, storage_method, position
      ) values (
        v_recipe_id, v_user_id, v_item->>0, v_item->>1, v_item->>2,
        (v_item->>3)::integer, (v_item->>4)::integer, 0,
        (v_item->>5)::integer, (v_item->>6)::boolean, v_item->>7,
        ((v_item->>4)::integer > 0), true,
        array(select jsonb_array_elements_text(v_item->8)::integer),
        'seeded_compliant', 'prep-compliance-v1', 1, false,
        (v_item->>9)::boolean, (v_item->>10)::integer,
        case when (v_item->>9)::boolean then 'refrigerated' else 'none' end,
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;

    v_pos := 0;
    for v_item in select value from jsonb_array_elements(v_recipe->'ops')
    loop
      insert into public.recipe_prep_operations (
        recipe_id, user_id, ingredient_position, source_step_positions,
        canonical_ingredient_name, display_ingredient_name, action,
        preparation_state, quantity, unit, can_make_ahead,
        maximum_make_ahead_hours, storage_method, batch_key,
        confidence, manually_edited, analysis_version, position
      ) values (
        v_recipe_id, v_user_id, (v_item->>0)::integer,
        array(select jsonb_array_elements_text(v_item->1)::integer),
        v_item->>2, v_item->>3, v_item->>4, v_item->>5,
        (v_item->>6)::numeric, v_item->>7, true,
        (v_item->>8)::integer, 'refrigerated', v_item->>9,
        0.96, false, 'prep-compliance-v1', v_pos
      );
      v_pos := v_pos + 1;
    end loop;

    insert into public.user_recipe_favorites (user_id, recipe_id, created_at)
    values (v_user_id, v_recipe_id, now())
    on conflict do nothing;
  end loop;
end;
$seed$;

notify pgrst, 'reload schema';
commit;

select
  r.name,
  r.analysis_status,
  r.compliance_score,
  count(distinct o.id) as prep_operations,
  count(distinct i.id) as compliance_issues
from public.recipes r
left join public.recipe_prep_operations o on o.recipe_id = r.id
left join public.recipe_compliance_issues i on i.recipe_id = r.id
where r.description like '[SMART_PREP_SEED_V1]%'
group by r.id, r.name, r.analysis_status, r.compliance_score
order by r.name;
