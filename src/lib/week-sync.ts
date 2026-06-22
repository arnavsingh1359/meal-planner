import type { SupabaseClient } from "@supabase/supabase-js";
import {
  areUnitsCompatible,
  normalizeMeasurement,
} from "@/lib/unit-utils";
import {
  formatIngredientName,
  inferIngredientCategory,
} from "@/lib/ingredient-utils";
import {
  generateTasksForMeal,
  toLocalDateString,
  type PlannedMealForScheduler,
} from "@/lib/scheduler-utils";
import type { RecipeTask } from "@/lib/scheduler-types";
import {
  defaultUserSettings,
  normalizeUserSettings,
  type PreparationMode,
} from "@/lib/user-settings";

type RecipeIngredientRow = {
  ingredient_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  is_optional: boolean;
  ingredients:
    | { id: string; name: string; category: string }
    | Array<{ id: string; name: string; category: string }>
    | null;
};

type RecipeWithIngredients = {
  id: string;
  name: string;
  default_servings: number;
  recipe_ingredients: RecipeIngredientRow[] | null;
};

type PlannedMealRecipeWithIngredients = {
  recipe_id: string;
  servings: number;
  position: number;
  recipes: RecipeWithIngredients | RecipeWithIngredients[] | null;
};

type PlannedMealForShopping = {
  id: string;
  recipe_id: string | null;
  servings: number | null;
  recipes: RecipeWithIngredients | RecipeWithIngredients[] | null;
  planned_meal_recipes: PlannedMealRecipeWithIngredients[] | null;
};

type PantryItemRow = {
  ingredient_id: string;
  tracking_mode: "exact" | "approximate";
  quantity: number | null;
  unit: string | null;
  stock_status: "out" | "low" | "enough" | "plenty";
};

type RecipeNameRow = { id: string; name: string };

type PlannedMealRecipeForSchedule = {
  recipe_id: string;
  servings: number;
  position: number;
  recipes: RecipeNameRow | RecipeNameRow[] | null;
};

type PlannedMealForSchedule = {
  id: string;
  recipe_id: string | null;
  day_index: number;
  meal_type: string;
  servings: number | null;
  meal_slot_name: string | null;
  meal_category: string | null;
  meal_time: string | null;
  ready_by_time: string | null;
  preparation_mode: string | null;
  recipes: RecipeNameRow | RecipeNameRow[] | null;
  planned_meal_recipes: PlannedMealRecipeForSchedule[] | null;
};

type AggregateEntry = {
  ingredientId: string | null;
  name: string;
  category: string;
  requiredQuantity: number;
  unit: string;
  sourceRecipes: Set<string>;
};

export type FinalizeWeekResult = {
  shoppingItemCount: number;
  scheduledTaskCount: number;
  catalogueIngredientCount: number;
  pantryItemCount: number;
};

function single<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function aggregateKey(
  ingredientId: string | null,
  name: string,
  unit: string,
) {
  return `${ingredientId ?? formatIngredientName(name).toLowerCase()}::${unit}`;
}

async function getPlanId(
  supabase: SupabaseClient,
  userId: string,
  weekStart: Date,
) {
  const { data, error } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", toLocalDateString(weekStart))
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Save at least one meal before updating the week.");
  return data.id as string;
}

async function generateShopping(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  weekStart: Date,
) {
  const [plannedResult, pantryResult] = await Promise.all([
    supabase
      .from("planned_meals")
      .select(`
        id,
        recipe_id,
        servings,
        recipes (
          id,
          name,
          default_servings,
          recipe_ingredients (
            ingredient_id,
            name,
            quantity,
            unit,
            is_optional,
            ingredients (id, name, category)
          )
        ),
        planned_meal_recipes (
          recipe_id,
          servings,
          position,
          recipes (
            id,
            name,
            default_servings,
            recipe_ingredients (
              ingredient_id,
              name,
              quantity,
              unit,
              is_optional,
              ingredients (id, name, category)
            )
          )
        )
      `)
      .eq("weekly_plan_id", planId),
    supabase
      .from("pantry_items")
      .select("ingredient_id, tracking_mode, quantity, unit, stock_status")
      .eq("user_id", userId),
  ]);

  if (plannedResult.error) throw plannedResult.error;
  if (pantryResult.error) throw pantryResult.error;

  const meals = (plannedResult.data ?? []) as PlannedMealForShopping[];
  if (meals.length === 0) throw new Error("This week has no planned meals.");

  const pantryItems = (pantryResult.data ?? []) as PantryItemRow[];
  const aggregates = new Map<string, AggregateEntry>();
  const catalogueIds = new Set<string>();

  for (const meal of meals) {
    const linked = meal.planned_meal_recipes ?? [];
    const selections: PlannedMealRecipeWithIngredients[] =
      linked.length > 0
        ? [...linked].sort((a, b) => a.position - b.position)
        : meal.recipe_id
          ? [{
              recipe_id: meal.recipe_id,
              servings: Math.max(Number(meal.servings ?? 1), 1),
              position: 0,
              recipes: meal.recipes,
            }]
          : [];

    for (const selection of selections) {
      const recipe = single(selection.recipes);
      if (!recipe) continue;
      const scale =
        Math.max(Number(selection.servings), 1) /
        Math.max(Number(recipe.default_servings), 1);

      for (const ingredient of recipe.recipe_ingredients ?? []) {
        if (ingredient.is_optional) continue;
        const catalogue = single(ingredient.ingredients);
        const ingredientId = ingredient.ingredient_id ?? catalogue?.id ?? null;
        if (ingredientId) catalogueIds.add(ingredientId);
        const name = catalogue?.name ?? formatIngredientName(ingredient.name);
        const category = catalogue?.category ?? inferIngredientCategory(name);
        const normalized = normalizeMeasurement(
          Number(ingredient.quantity) * scale,
          ingredient.unit,
        );
        const key = aggregateKey(ingredientId, name, normalized.unit);
        const existing = aggregates.get(key);
        if (existing) {
          existing.requiredQuantity += normalized.quantity;
          existing.sourceRecipes.add(recipe.name);
        } else {
          aggregates.set(key, {
            ingredientId,
            name,
            category,
            requiredQuantity: normalized.quantity,
            unit: normalized.unit,
            sourceRecipes: new Set([recipe.name]),
          });
        }
      }
    }
  }

  const generated = Array.from(aggregates.values()).map((aggregate) => {
    const pantry = pantryItems.find(
      (item) => item.ingredient_id === aggregate.ingredientId,
    );
    let pantryQuantity = 0;
    let quantityToBuy = aggregate.requiredQuantity;

    if (pantry) {
      if (pantry.tracking_mode === "approximate") {
        if (pantry.stock_status === "enough" || pantry.stock_status === "plenty") {
          pantryQuantity = aggregate.requiredQuantity;
          quantityToBuy = 0;
        }
      } else if (
        pantry.quantity !== null &&
        pantry.unit &&
        areUnitsCompatible(pantry.unit, aggregate.unit)
      ) {
        pantryQuantity = normalizeMeasurement(
          Number(pantry.quantity),
          pantry.unit,
        ).quantity;
        quantityToBuy = Math.max(aggregate.requiredQuantity - pantryQuantity, 0);
      }
    }

    return {
      ...aggregate,
      pantryQuantity,
      quantityToBuy,
      sourceRecipes: Array.from(aggregate.sourceRecipes).sort(),
    };
  });

  const weekStartString = toLocalDateString(weekStart);
  const { data: existingList, error: listLookupError } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStartString)
    .maybeSingle();
  if (listLookupError) throw listLookupError;

  let listId = existingList?.id as string | undefined;
  if (!listId) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: userId, week_start: weekStartString })
      .select("id")
      .single();
    if (error) throw error;
    listId = data.id as string;
  }

  const { data: previous, error: previousError } = await supabase
    .from("shopping_items")
    .select("ingredient_id, name, unit, is_purchased")
    .eq("shopping_list_id", listId)
    .eq("is_manual", false);
  if (previousError) throw previousError;

  const purchased = new Map<string, boolean>();
  for (const item of previous ?? []) {
    purchased.set(
      aggregateKey(item.ingredient_id, item.name, item.unit),
      item.is_purchased,
    );
  }

  const { error: deleteError } = await supabase
    .from("shopping_items")
    .delete()
    .eq("shopping_list_id", listId)
    .eq("is_manual", false);
  if (deleteError) throw deleteError;

  if (generated.length > 0) {
    const { error } = await supabase.from("shopping_items").insert(
      generated.map((item) => ({
        shopping_list_id: listId,
        user_id: userId,
        ingredient_id: item.ingredientId,
        name: item.name,
        category: item.category,
        required_quantity: item.requiredQuantity,
        pantry_quantity: item.pantryQuantity,
        quantity_to_buy: item.quantityToBuy,
        unit: item.unit,
        is_manual: false,
        is_purchased:
          purchased.get(aggregateKey(item.ingredientId, item.name, item.unit)) ?? false,
        source_recipes: item.sourceRecipes,
        notes: "",
      })),
    );
    if (error) throw error;
  }

  const { error: updateError } = await supabase
    .from("shopping_lists")
    .update({
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId);
  if (updateError) throw updateError;

  return {
    shoppingItemCount: generated.filter((item) => item.quantityToBuy > 0).length,
    catalogueIngredientCount: catalogueIds.size,
    pantryItemCount: pantryItems.length,
  };
}

async function generateSchedule(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  weekStart: Date,
) {
  const [settingsResult, mealsResult] = await Promise.all([
    supabase
      .from("user_settings")
      .select(`
        conflict_grouping_minutes,
        preferred_batch_day,
        preferred_batch_days,
        preserve_manual_tasks,
        day_settings
      `)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("planned_meals")
      .select(`
        id,
        recipe_id,
        day_index,
        meal_type,
        servings,
        meal_slot_name,
        meal_category,
        meal_time,
        ready_by_time,
        preparation_mode,
        recipes (id, name),
        planned_meal_recipes (
          recipe_id,
          servings,
          position,
          recipes (id, name)
        )
      `)
      .eq("weekly_plan_id", planId)
      .order("day_index"),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (mealsResult.error) throw mealsResult.error;

  const settings = settingsResult.data
    ? normalizeUserSettings(settingsResult.data)
    : defaultUserSettings;
  const meals = (mealsResult.data ?? []) as PlannedMealForSchedule[];
  if (meals.length === 0) throw new Error("This week has no planned meals.");

  const selections = meals.flatMap((meal) => {
    const linked = meal.planned_meal_recipes ?? [];
    if (linked.length > 0) {
      return [...linked]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          plannedMealId: meal.id,
          dayIndex: meal.day_index,
          mealType: meal.meal_category ?? meal.meal_type,
          mealSlotName: meal.meal_slot_name ?? meal.meal_type,
          mealTime: meal.meal_time?.slice(0, 5) ?? "12:00",
          readyByTime: meal.ready_by_time?.slice(0, 5) ?? "12:00",
          preparationMode: (meal.preparation_mode ?? "fresh") as PreparationMode,
          recipeId: item.recipe_id,
          servings: Math.max(Number(item.servings), 1),
          recipe: single(item.recipes),
        }));
    }
    if (!meal.recipe_id) return [];
    return [{
      plannedMealId: meal.id,
      dayIndex: meal.day_index,
      mealType: meal.meal_category ?? meal.meal_type,
      mealSlotName: meal.meal_slot_name ?? meal.meal_type,
      mealTime: meal.meal_time?.slice(0, 5) ?? "12:00",
      readyByTime: meal.ready_by_time?.slice(0, 5) ?? "12:00",
      preparationMode: (meal.preparation_mode ?? "fresh") as PreparationMode,
      recipeId: meal.recipe_id,
      servings: Math.max(Number(meal.servings ?? 1), 1),
      recipe: single(meal.recipes),
    }];
  });

  const recipeIds = Array.from(new Set(selections.map((item) => item.recipeId)));
  const { data: taskData, error: taskError } = await supabase
    .from("recipe_tasks")
    .select(`
      id, user_id, recipe_id, title, instructions, task_type,
      active_minutes, passive_minutes, day_offset,
      start_before_meal_minutes, batch_key, can_batch,
      unattended, blocks_active_work, depends_on_task_id, position
    `)
    .in("recipe_id", recipeIds)
    .order("position");
  if (taskError) throw taskError;

  const recipeTasks = (taskData ?? []) as RecipeTask[];
  if (recipeTasks.length === 0) {
    throw new Error("None of the planned recipes have scheduler tasks.");
  }

  const schedulerMeals = selections
    .filter((selection) => selection.recipe)
    .map((selection): PlannedMealForScheduler => ({
      id: selection.plannedMealId,
      recipe_id: selection.recipeId,
      day_index: selection.dayIndex,
      meal_type: selection.mealType,
      meal_slot_name: selection.mealSlotName,
      meal_time: selection.mealTime,
      ready_by_time: selection.readyByTime,
      preparation_mode: selection.preparationMode,
      servings: selection.servings,
      recipeName: selection.recipe!.name,
    }));

  const generated = schedulerMeals.flatMap((meal) =>
    generateTasksForMeal(
      weekStart,
      meal,
      recipeTasks.filter((task) => task.recipe_id === meal.recipe_id),
      settings,
    ),
  );

  let preserved: Array<{
    planned_meal_id: string | null;
    recipe_id: string | null;
    recipe_task_id: string | null;
  }> = [];
  if (settings.preserve_manual_tasks) {
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .select("planned_meal_id, recipe_id, recipe_task_id")
      .eq("weekly_plan_id", planId)
      .eq("manually_adjusted", true);
    if (error) throw error;
    preserved = data ?? [];
  }

  const preservedKeys = new Set(
    preserved.map((task) =>
      [task.planned_meal_id ?? "", task.recipe_id ?? "", task.recipe_task_id ?? ""].join("::"),
    ),
  );

  const { error: deleteError } = await supabase
    .from("scheduled_tasks")
    .delete()
    .eq("weekly_plan_id", planId)
    .eq("is_generated", true)
    .eq("manually_adjusted", false);
  if (deleteError) throw deleteError;

  const rows = generated
    .filter((task) =>
      !preservedKeys.has(
        [task.plannedMealId, task.recipeId, task.recipeTaskId].join("::"),
      ),
    )
    .map((task) => ({
      user_id: userId,
      weekly_plan_id: planId,
      planned_meal_id: task.plannedMealId,
      recipe_id: task.recipeId,
      recipe_task_id: task.recipeTaskId,
      title: task.title,
      instructions: task.instructions,
      task_type: task.taskType,
      scheduled_date: task.scheduledDate,
      scheduled_start: task.scheduledStart,
      scheduled_end: task.scheduledEnd,
      active_minutes: task.activeMinutes,
      passive_minutes: task.passiveMinutes,
      unattended: task.unattended,
      blocks_active_work: task.blocksActiveWork,
      status: "pending",
      is_generated: true,
      manually_adjusted: false,
      batch_key: task.batchKey,
      source_recipe_name: task.sourceRecipeName,
      source_meal_type: task.sourceMealType,
      notes: task.unscheduledReason
        ? `Unscheduled: ${task.unscheduledReason}`
        : "",
      position: task.position,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("scheduled_tasks").insert(rows);
    if (error) throw error;
  }

  return rows.length;
}

export async function finalizeWeek(
  supabase: SupabaseClient,
  userId: string,
  weekStart: Date,
): Promise<FinalizeWeekResult> {
  const planId = await getPlanId(supabase, userId, weekStart);
  const shopping = await generateShopping(supabase, userId, planId, weekStart);
  const scheduledTaskCount = await generateSchedule(
    supabase,
    userId,
    planId,
    weekStart,
  );

  return {
    ...shopping,
    scheduledTaskCount,
  };
}
