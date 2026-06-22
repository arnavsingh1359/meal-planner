"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { finalizeWeek } from "@/lib/week-sync";
import {
  dayKeyFromIndex,
  dayKeys,
  dayLabels,
  defaultUserSettings,
  mealCategoryLabels,
  normalizeUserSettings,
  resolveDaySettings,
  type MealCategory,
  type MealSlotSetting,
  type UserSettings,
} from "@/lib/user-settings";

const days = dayKeys.map((day) => dayLabels[day]);
const recipeTabs: Array<MealCategory | "all"> = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "all",
];

type Recipe = {
  id: string;
  name: string;
  description: string;
  meal_types: string[];
  default_servings: number;
  preparation_minutes: number;
  cooking_minutes: number;
};

type PlannedMealRecipe = {
  id: string;
  recipeId: string;
  servings: number;
  position: number;
};

type PlannedMeal = {
  id: string;
  dayIndex: number;
  slotId: string;
  slotName: string;
  category: MealCategory;
  mealTime: string;
  readyByTime: string;
  preparationMode: string;
  recipes: PlannedMealRecipe[];
};

type WeeklyPlan = Record<string, PlannedMeal>;

type SelectedSlot = {
  dayIndex: number;
  slot: MealSlotSetting;
} | null;

type WeeklyPlanRow = {
  id: string;
  week_start: string;
};

type PlannedMealRecipeRow = {
  id: string;
  recipe_id: string;
  servings: number;
  position: number;
};

type PlannedMealRow = {
  id: string;
  recipe_id: string | null;
  day_index: number;
  meal_type: string;
  servings: number | null;
  meal_slot_id: string | null;
  meal_slot_name: string | null;
  meal_category: string | null;
  meal_time: string | null;
  ready_by_time: string | null;
  preparation_mode: string | null;
  planned_meal_recipes: PlannedMealRecipeRow[] | null;
};

function slotKey(dayIndex: number, slotId: string) {
  return `${dayIndex}::${slotId}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonday(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 6);
  const startText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(start);
  const endText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(end);
  return `${startText} – ${endText}`;
}

function formatDayDate(start: Date, dayIndex: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(addDays(start, dayIndex));
}

function formatTime(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeTime(value: string | null, fallback: string) {
  return value ? value.slice(0, 5) : fallback;
}

export default function WeeklyPlanner() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [weeklyPlanId, setWeeklyPlanId] = useState<string | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot>(null);
  const [selectedRecipes, setSelectedRecipes] = useState<Record<string, number>>({});
  const [activeRecipeTab, setActiveRecipeTab] = useState<MealCategory | "all">("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCopyingPrevious, setIsCopyingPrevious] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    void loadWeek(weekStart);
  }, [weekStart]);

  async function getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  }

  async function loadBaseData() {
    try {
      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      const [recipesResult, settingsResult] = await Promise.all([
        supabase
          .from("recipes")
          .select(`
            id,
            name,
            description,
            meal_types,
            default_servings,
            preparation_minutes,
            cooking_minutes
          `)
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("user_settings")
          .select(`
            conflict_grouping_minutes,
            preferred_batch_day,
            preferred_batch_days,
            preserve_manual_tasks,
            day_settings
          `)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (recipesResult.error) {
        throw recipesResult.error;
      }

      if (settingsResult.error) {
        throw settingsResult.error;
      }

      setRecipes((recipesResult.data ?? []) as Recipe[]);
      setSettings(
        settingsResult.data
          ? normalizeUserSettings(settingsResult.data)
          : defaultUserSettings,
      );
    } catch (error) {
      console.error("Could not load planner data:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load planner data.",
      );
    }
  }

  async function loadWeek(start: Date) {
    setIsLoading(true);
    setErrorMessage("");
    setMessage("");

    try {
      const user = await getCurrentUser();

      if (!user) {
        setWeeklyPlan({});
        setWeeklyPlanId(null);
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from("weekly_plans")
        .select("id, week_start")
        .eq("user_id", user.id)
        .eq("week_start", toDateString(start))
        .maybeSingle();

      if (planError) {
        throw planError;
      }

      if (!planData) {
        setWeeklyPlan({});
        setWeeklyPlanId(null);
        setMessage("No plan saved for this week.");
        return;
      }

      const plan = planData as WeeklyPlanRow;
      setWeeklyPlanId(plan.id);

      const { data, error } = await supabase
        .from("planned_meals")
        .select(`
          id,
          recipe_id,
          day_index,
          meal_type,
          servings,
          meal_slot_id,
          meal_slot_name,
          meal_category,
          meal_time,
          ready_by_time,
          preparation_mode,
          planned_meal_recipes (
            id,
            recipe_id,
            servings,
            position
          )
        `)
        .eq("weekly_plan_id", plan.id);

      if (error) {
        throw error;
      }

      const nextPlan: WeeklyPlan = {};

      for (const row of (data ?? []) as PlannedMealRow[]) {
        const fallbackCategory = row.meal_type.toLowerCase() as MealCategory;
        const joined = [...(row.planned_meal_recipes ?? [])].sort(
          (a, b) => a.position - b.position,
        );
        const normalizedRecipes =
          joined.length > 0
            ? joined.map((item) => ({
                id: item.id,
                recipeId: item.recipe_id,
                servings: item.servings,
                position: item.position,
              }))
            : row.recipe_id
              ? [
                  {
                    id: `legacy-${row.id}`,
                    recipeId: row.recipe_id,
                    servings: row.servings ?? 1,
                    position: 0,
                  },
                ]
              : [];

        const id = row.meal_slot_id ?? fallbackCategory;
        nextPlan[slotKey(row.day_index, id)] = {
          id: row.id,
          dayIndex: row.day_index,
          slotId: id,
          slotName: row.meal_slot_name ?? row.meal_type,
          category: (row.meal_category ?? fallbackCategory) as MealCategory,
          mealTime: normalizeTime(row.meal_time, "12:00"),
          readyByTime: normalizeTime(row.ready_by_time, "12:00"),
          preparationMode: row.preparation_mode ?? "fresh",
          recipes: normalizedRecipes,
        };
      }

      setWeeklyPlan(nextPlan);
      setMessage("Week loaded.");
    } catch (error) {
      console.error("Could not load week:", error);
      setWeeklyPlan({});
      setWeeklyPlanId(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load this week.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function ensureWeeklyPlan() {
    if (weeklyPlanId) {
      return weeklyPlanId;
    }

    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Please log in before editing the week.");
    }

    const { data, error } = await supabase
      .from("weekly_plans")
      .upsert(
        {
          user_id: user.id,
          week_start: toDateString(weekStart),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week_start" },
      )
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    setWeeklyPlanId(data.id);
    return data.id as string;
  }

  function openPicker(dayIndex: number, slot: MealSlotSetting) {
    const existing = weeklyPlan[slotKey(dayIndex, slot.id)];
    const selections: Record<string, number> = {};

    for (const plannedRecipe of existing?.recipes ?? []) {
      selections[plannedRecipe.recipeId] = plannedRecipe.servings;
    }

    setSelectedSlot({ dayIndex, slot });
    setSelectedRecipes(selections);
    setActiveRecipeTab(slot.meal_type === "any" ? "all" : slot.meal_type);
    setSearchQuery("");
    setErrorMessage("");
  }

  function closePicker() {
    if (isSaving) {
      return;
    }

    setSelectedSlot(null);
    setSelectedRecipes({});
    setSearchQuery("");
  }

  function toggleRecipe(recipe: Recipe) {
    setSelectedRecipes((current) => {
      if (current[recipe.id]) {
        const next = { ...current };
        delete next[recipe.id];
        return next;
      }

      return {
        ...current,
        [recipe.id]: Math.max(recipe.default_servings, 1),
      };
    });
  }

  function updateServings(recipeId: string, servings: number) {
    setSelectedRecipes((current) => ({
      ...current,
      [recipeId]: Math.max(1, servings),
    }));
  }

  const selectedEntries = useMemo(
    () =>
      Object.entries(selectedRecipes)
        .map(([recipeId, servings]) => {
          const recipe = recipes.find((item) => item.id === recipeId);
          return recipe ? { recipe, servings } : null;
        })
        .filter(
          (entry): entry is { recipe: Recipe; servings: number } => entry !== null,
        ),
    [recipes, selectedRecipes],
  );

  const visibleRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return recipes.filter((recipe) => {
      const matchesTab =
        activeRecipeTab === "all" ||
        recipe.meal_types.some(
          (type) => type.toLowerCase() === activeRecipeTab,
        );
      const matchesSearch =
        !query ||
        recipe.name.toLowerCase().includes(query) ||
        recipe.description.toLowerCase().includes(query);
      return matchesTab && matchesSearch;
    });
  }, [activeRecipeTab, recipes, searchQuery]);

  async function saveMeal() {
    if (!selectedSlot || selectedEntries.length === 0) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Please log in before saving a meal.");
      }

      const planId = await ensureWeeklyPlan();
      const key = slotKey(selectedSlot.dayIndex, selectedSlot.slot.id);
      const existing = weeklyPlan[key];
      const first = selectedEntries[0];
      const legacyMealType =
        selectedSlot.slot.meal_type === "any"
          ? "Snack"
          : mealCategoryLabels[selectedSlot.slot.meal_type];

      const payload = {
        recipe_id: first.recipe.id,
        servings: first.servings,
        meal_type: legacyMealType,
        meal_slot_id: selectedSlot.slot.id,
        meal_slot_name: selectedSlot.slot.name,
        meal_category: selectedSlot.slot.meal_type,
        meal_time: selectedSlot.slot.time,
        ready_by_time: selectedSlot.slot.ready_by_time,
        preparation_mode: selectedSlot.slot.preparation_mode,
        updated_at: new Date().toISOString(),
      };

      let plannedMealId = existing?.id ?? null;

      if (plannedMealId) {
        const { error } = await supabase
          .from("planned_meals")
          .update(payload)
          .eq("id", plannedMealId);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from("planned_meals")
          .insert({
            ...payload,
            weekly_plan_id: planId,
            user_id: user.id,
            day_index: selectedSlot.dayIndex,
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        plannedMealId = data.id;
      }

      const { error: deleteError } = await supabase
        .from("planned_meal_recipes")
        .delete()
        .eq("planned_meal_id", plannedMealId);

      if (deleteError) {
        throw deleteError;
      }

      const { data: links, error: insertError } = await supabase
        .from("planned_meal_recipes")
        .insert(
          selectedEntries.map((entry, position) => ({
            user_id: user.id,
            planned_meal_id: plannedMealId,
            recipe_id: entry.recipe.id,
            servings: entry.servings,
            position,
          })),
        )
        .select("id, recipe_id, servings, position");

      if (insertError) {
        throw insertError;
      }

      setWeeklyPlan((current) => ({
        ...current,
        [key]: {
          id: plannedMealId,
          dayIndex: selectedSlot.dayIndex,
          slotId: selectedSlot.slot.id,
          slotName: selectedSlot.slot.name,
          category: selectedSlot.slot.meal_type,
          mealTime: selectedSlot.slot.time,
          readyByTime: selectedSlot.slot.ready_by_time,
          preparationMode: selectedSlot.slot.preparation_mode,
          recipes: (links ?? []).map((item) => ({
            id: item.id,
            recipeId: item.recipe_id,
            servings: item.servings,
            position: item.position,
          })),
        },
      }));

      setMessage("Meal saved.");
      closePicker();
    } catch (error) {
      console.error("Could not save meal:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save meal.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function clearSelectedMeal() {
    if (!selectedSlot) {
      return;
    }

    const key = slotKey(selectedSlot.dayIndex, selectedSlot.slot.id);
    const existing = weeklyPlan[key];

    if (!existing) {
      closePicker();
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("planned_meals").delete().eq("id", existing.id);

      if (error) {
        throw error;
      }

      setWeeklyPlan((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage("Meal cleared.");
      closePicker();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not clear meal.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function useSameAsLastWeek() {
    if (isCopyingPrevious || isSaving || isFinalizing) {
      return;
    }

    if (
      Object.keys(weeklyPlan).length > 0 &&
      !window.confirm(
        "Replace this week's current menu with last week's menu?",
      )
    ) {
      return;
    }

    setIsCopyingPrevious(true);
    setErrorMessage("");
    setMessage("Copying last week's menu…");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Please log in before copying a menu.");
      }

      const previousWeekStart = addDays(weekStart, -7);
      const { data: previousPlan, error: previousPlanError } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start", toDateString(previousWeekStart))
        .maybeSingle();

      if (previousPlanError) {
        throw previousPlanError;
      }

      if (!previousPlan) {
        throw new Error("No saved menu exists for the previous week.");
      }

      const { data: previousMealsData, error: previousMealsError } =
        await supabase
          .from("planned_meals")
          .select(`
            id,
            recipe_id,
            day_index,
            meal_type,
            servings,
            meal_slot_id,
            meal_slot_name,
            meal_category,
            meal_time,
            ready_by_time,
            preparation_mode,
            planned_meal_recipes (
              id,
              recipe_id,
              servings,
              position
            )
          `)
          .eq("weekly_plan_id", previousPlan.id)
          .order("day_index");

      if (previousMealsError) {
        throw previousMealsError;
      }

      const previousMeals = (previousMealsData ?? []) as PlannedMealRow[];

      if (previousMeals.length === 0) {
        throw new Error("The previous week has no meals to copy.");
      }

      const targetPlanId = await ensureWeeklyPlan();
      const { error: clearError } = await supabase
        .from("planned_meals")
        .delete()
        .eq("weekly_plan_id", targetPlanId);

      if (clearError) {
        throw clearError;
      }

      for (const sourceMeal of previousMeals) {
        const { data: insertedMeal, error: insertMealError } = await supabase
          .from("planned_meals")
          .insert({
            user_id: user.id,
            weekly_plan_id: targetPlanId,
            recipe_id: sourceMeal.recipe_id,
            day_index: sourceMeal.day_index,
            meal_type: sourceMeal.meal_type,
            servings: sourceMeal.servings,
            meal_slot_id: sourceMeal.meal_slot_id,
            meal_slot_name: sourceMeal.meal_slot_name,
            meal_category: sourceMeal.meal_category,
            meal_time: sourceMeal.meal_time,
            ready_by_time: sourceMeal.ready_by_time,
            preparation_mode: sourceMeal.preparation_mode,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertMealError) {
          throw insertMealError;
        }

        const links = [...(sourceMeal.planned_meal_recipes ?? [])].sort(
          (first, second) => first.position - second.position,
        );

        if (links.length > 0) {
          const { error: linkError } = await supabase
            .from("planned_meal_recipes")
            .insert(
              links.map((link) => ({
                user_id: user.id,
                planned_meal_id: insertedMeal.id,
                recipe_id: link.recipe_id,
                servings: link.servings,
                position: link.position,
              })),
            );

          if (linkError) {
            throw linkError;
          }
        }
      }

      await loadWeek(weekStart);
      setMessage("Last week's menu copied. Review it, then update the week.");
    } catch (error) {
      console.error("Could not copy last week's menu:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not copy last week's menu.",
      );
    } finally {
      setIsCopyingPrevious(false);
    }
  }

  async function updateEntireWeek() {
    if (isFinalizing || isSaving || isCopyingPrevious) {
      return;
    }

    setIsFinalizing(true);
    setErrorMessage("");
    setMessage("Updating catalogue, pantry-aware shopping list, and schedule…");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Please log in before updating the week.");
      }

      const result = await finalizeWeek(supabase, user.id, weekStart);
      setMessage(
        `Week updated: ${result.catalogueIngredientCount} catalogue ingredients checked, ` +
          `${result.pantryItemCount} pantry items considered, ` +
          `${result.shoppingItemCount} shopping items, and ` +
          `${result.scheduledTaskCount} schedule tasks generated.`,
      );
    } catch (error) {
      console.error("Could not update the week:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update the week.",
      );
    } finally {
      setIsFinalizing(false);
    }
  }

  async function clearAllMeals() {
    if (!weeklyPlanId || Object.keys(weeklyPlan).length === 0) {
      return;
    }

    if (!window.confirm("Clear every meal from this week?")) {
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("planned_meals")
        .delete()
        .eq("weekly_plan_id", weeklyPlanId);

      if (error) {
        throw error;
      }

      setWeeklyPlan({});
      setMessage("All meals cleared.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not clear meals.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const plannedSlotCount = Object.keys(weeklyPlan).length;
  const plannedRecipeCount = Object.values(weeklyPlan).reduce(
    (total, meal) => total + meal.recipes.length,
    0,
  );
  const configuredSlotCount = dayKeys.reduce(
    (total, day) => total + resolveDaySettings(settings, day).meal_slots.length,
    0,
  );

  return (
    <>
      <section className="planner-summary">
        <div className="planner-summary-stats">
          <div>
            <span>Meal slots planned</span>
            <strong>{plannedSlotCount}</strong>
            <small>of {configuredSlotCount} configured slots</small>
          </div>
          <div>
            <span>Recipes planned</span>
            <strong>{plannedRecipeCount}</strong>
            <small>Multiple recipes can share a slot</small>
          </div>
          <div>
            <span>Recipes available</span>
            <strong>{recipes.length}</strong>
            <small>Loaded from your library</small>
          </div>
        </div>

        <div className="planner-summary-actions">
          <button
            className="primary-button"
            disabled={
              plannedSlotCount === 0 ||
              isSaving ||
              isFinalizing ||
              isCopyingPrevious
            }
            onClick={updateEntireWeek}
            type="button"
          >
            {isFinalizing ? "Updating week…" : "Update week"}
          </button>

          <button
            className="text-button danger-text"
            disabled={plannedSlotCount === 0 || isSaving || isFinalizing}
            onClick={clearAllMeals}
            type="button"
          >
            Clear meals
          </button>
        </div>
      </section>

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="panel week-panel flexible-week-panel">
        <div className="week-toolbar">
          <div>
            <p className="eyebrow">Weekly plan</p>
            <h2>{formatWeekRange(weekStart)}</h2>
            <p className="save-status">
              {isLoading ? "Loading week…" : isSaving ? "Saving…" : message}
            </p>
          </div>

          <div className="week-actions">
            <button
              className="secondary-button week-copy-button"
              disabled={
                isLoading ||
                isSaving ||
                isFinalizing ||
                isCopyingPrevious
              }
              onClick={useSameAsLastWeek}
              type="button"
            >
              {isCopyingPrevious ? "Copying…" : "Use same as last week"}
            </button>

            <button
              className="secondary-button"
              disabled={isLoading || isSaving || isFinalizing}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              type="button"
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={isLoading || isSaving || isFinalizing}
              onClick={() => setWeekStart(getMonday(new Date()))}
              type="button"
            >
              Current
            </button>
            <button
              className="secondary-button"
              disabled={isLoading || isSaving || isFinalizing}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        <div className="flexible-week-scroll">
          <div className="flexible-week-grid">
            {dayKeys.map((day, dayIndex) => {
              const daySettings = resolveDaySettings(settings, day);

              return (
                <section className="flexible-day-column" key={day}>
                  <div className="flexible-day-heading">
                    <strong>{dayLabels[day]}</strong>
                    <small>{formatDayDate(weekStart, dayIndex)}</small>
                  </div>

                  <div className="flexible-day-slots">
                    {daySettings.meal_slots.map((slot) => {
                      const meal = weeklyPlan[slotKey(dayIndex, slot.id)];
                      const plannedRecipes = (meal?.recipes ?? [])
                        .map((plannedRecipe) => {
                          const recipe = recipes.find(
                            (item) => item.id === plannedRecipe.recipeId,
                          );
                          return recipe ? { recipe, plannedRecipe } : null;
                        })
                        .filter(
                          (
                            item,
                          ): item is {
                            recipe: Recipe;
                            plannedRecipe: PlannedMealRecipe;
                          } => item !== null,
                        );

                      return (
                        <button
                          className={
                            plannedRecipes.length > 0
                              ? "flexible-meal-slot filled"
                              : "flexible-meal-slot"
                          }
                          disabled={isLoading || isSaving}
                          key={slot.id}
                          onClick={() => openPicker(dayIndex, slot)}
                          type="button"
                        >
                          <span className="flexible-meal-slot-heading">
                            <strong>{slot.name}</strong>
                            <small>{formatTime(slot.time)}</small>
                          </span>

                          {plannedRecipes.length > 0 ? (
                            <span className="meal-slot-recipe-list">
                              {plannedRecipes.map(({ recipe, plannedRecipe }) => (
                                <span className="flexible-recipe-pill" key={plannedRecipe.id}>
                                  {recipe.name}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="flexible-add-label">+ Add recipes</span>
                          )}

                          <small className="flexible-slot-mode">
                            {slot.preparation_mode.replaceAll("_", " ")}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {selectedSlot ? (
        <div className="modal-backdrop" onMouseDown={closePicker} role="presentation">
          <section
            aria-modal="true"
            className="modal-card recipe-picker-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">{days[selectedSlot.dayIndex]}</p>
                <h2>{selectedSlot.slot.name}</h2>
                <p>
                  {formatTime(selectedSlot.slot.time)} · Choose one or more recipes
                </p>
              </div>
              <button className="close-button" onClick={closePicker} type="button">
                ×
              </button>
            </div>

            <div className="multi-recipe-picker">
              {selectedEntries.length > 0 ? (
                <div className="selected-recipe-chips">
                  {selectedEntries.map(({ recipe }) => (
                    <button
                      className="selected-recipe-chip"
                      key={recipe.id}
                      onClick={() => toggleRecipe(recipe)}
                      type="button"
                    >
                      {recipe.name} <span>×</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="recipe-picker-hint">No recipes selected yet.</p>
              )}

              <div className="recipe-picker-tabs">
                {recipeTabs.map((tab) => (
                  <button
                    className={
                      activeRecipeTab === tab
                        ? "recipe-picker-tab active"
                        : "recipe-picker-tab"
                    }
                    key={tab}
                    onClick={() => setActiveRecipeTab(tab)}
                    type="button"
                  >
                    {tab === "all" ? "All" : mealCategoryLabels[tab]}
                  </button>
                ))}
              </div>

              <label className="recipe-picker-search">
                <span>Search recipes</span>
                <input
                  placeholder="Search by name or description"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>

              <div className="recipe-picker-list">
                {visibleRecipes.length === 0 ? (
                  <div className="empty-state">
                    <strong>No matching recipes</strong>
                    <p>Try another category or search term.</p>
                  </div>
                ) : (
                  visibleRecipes.map((recipe) => {
                    const selected = selectedRecipes[recipe.id] !== undefined;
                    return (
                      <article
                        className={selected ? "recipe-option selected" : "recipe-option"}
                        key={recipe.id}
                      >
                        <button
                          className="recipe-option-toggle"
                          onClick={() => toggleRecipe(recipe)}
                          type="button"
                        >
                          <span className="recipe-option-checkbox">{selected ? "✓" : ""}</span>
                          <span className="recipe-option-copy">
                            <strong>{recipe.name}</strong>
                            <small>{recipe.description || "No description"}</small>
                          </span>
                          <span className="recipe-option-duration">
                            {recipe.preparation_minutes + recipe.cooking_minutes} min
                          </span>
                        </button>

                        {selected ? (
                          <div className="recipe-option-servings">
                            <span>Servings</span>
                            <div className="stepper">
                              <button
                                onClick={() =>
                                  updateServings(recipe.id, selectedRecipes[recipe.id] - 1)
                                }
                                type="button"
                              >
                                −
                              </button>
                              <strong>{selectedRecipes[recipe.id]}</strong>
                              <button
                                onClick={() =>
                                  updateServings(recipe.id, selectedRecipes[recipe.id] + 1)
                                }
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="text-button danger-text"
                disabled={!weeklyPlan[slotKey(selectedSlot.dayIndex, selectedSlot.slot.id)]}
                onClick={clearSelectedMeal}
                type="button"
              >
                Clear slot
              </button>

              <div className="modal-primary-actions">
                <button className="secondary-button" onClick={closePicker} type="button">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={selectedEntries.length === 0 || isSaving}
                  onClick={saveMeal}
                  type="button"
                >
                  {isSaving
                    ? "Saving…"
                    : `Save ${selectedEntries.length} ${
                        selectedEntries.length === 1 ? "recipe" : "recipes"
                      }`}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
