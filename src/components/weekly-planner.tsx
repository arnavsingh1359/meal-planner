"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const mealTypes = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
] as const;

const cookingBlockTypes = [
  {
    value: "light",
    label: "Light preparation",
    description:
      "Assembly, chopping, reheating, or a very quick recipe.",
  },
  {
    value: "normal",
    label: "Normal cooking",
    description:
      "One or two regular recipes.",
  },
  {
    value: "batch",
    label: "Batch cooking",
    description:
      "A longer session intended to prepare several meals.",
  },
] as const;

type Day = (typeof days)[number];
type MealType = (typeof mealTypes)[number];

type CookingBlockType =
  (typeof cookingBlockTypes)[number]["value"];

type Recipe = {
  id: string;
  name: string;
  description: string;
  meal_types: string[];
  default_servings: number;
  preparation_minutes: number;
  cooking_minutes: number;
};

type MealSlotKey = `${number}-${MealType}`;

type PlannedMeal = {
  id: string;
  recipeId: string;
  servings: number;
};

type WeeklyPlan = Partial<
  Record<MealSlotKey, PlannedMeal>
>;

type SelectedSlot = {
  dayIndex: number;
  mealType: MealType;
} | null;

type CookingBlock = {
  id: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  type: CookingBlockType;
  notes: string;
};

type CookingBlockForm = Omit<
  CookingBlock,
  "id"
>;

type WeeklyPlanRow = {
  id: string;
  week_start: string;
};

type PlannedMealRow = {
  id: string;
  recipe_id: string;
  day_index: number;
  meal_type: MealType;
  servings: number;
};

type CookingBlockRow = {
  id: string;
  day_index: number;
  start_time: string;
  end_time: string;
  block_type: CookingBlockType;
  notes: string;
};

const emptyCookingBlockForm: CookingBlockForm = {
  dayIndex: 6,
  startTime: "16:00",
  endTime: "18:00",
  type: "batch",
  notes: "",
};

function makeSlotKey(
  dayIndex: number,
  mealType: MealType,
): MealSlotKey {
  return `${dayIndex}-${mealType}`;
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function toDateString(date: Date) {
  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join("-");
}

function fromDateString(value: string) {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day);
}

function getMonday(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  return result;
}

function addDays(date: Date, numberOfDays: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + numberOfDays);

  return result;
}

function addWeeks(date: Date, numberOfWeeks: number) {
  return addDays(date, numberOfWeeks * 7);
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);

  const startFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  );

  const endFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return `${startFormatter.format(
    weekStart,
  )} – ${endFormatter.format(weekEnd)}`;
}

function formatDayDate(
  weekStart: Date,
  dayIndex: number,
) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(addDays(weekStart, dayIndex));
}

function timeToMinutes(time: string) {
  if (!time || !time.includes(":")) {
    return Number.NaN;
  }

  const [hoursText, minutesText] =
    time.split(":");

  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}

function normalizeDatabaseTime(time: string) {
  if (!time) {
    return "";
  }

  return time.slice(0, 5);
}

function formatTime(time: string) {
  const normalized = normalizeDatabaseTime(time);

  if (!normalized.includes(":")) {
    return "Time not set";
  }

  const [hoursText, minutesText] =
    normalized.split(":");

  const hours = Number(hoursText);

  if (
    !Number.isInteger(hours) ||
    !minutesText
  ) {
    return "Time not set";
  }

  const displayHours = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";

  return `${displayHours}:${minutesText} ${period}`;
}

function getBlockDuration(
  startTime: string,
  endTime: string,
) {
  return (
    timeToMinutes(endTime) -
    timeToMinutes(startTime)
  );
}

function formatDuration(totalMinutes: number) {
  if (
    !Number.isFinite(totalMinutes) ||
    totalMinutes <= 0
  ) {
    return "0 min";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function sortCookingBlocks(
  blocks: CookingBlock[],
) {
  return [...blocks].sort((first, second) => {
    if (first.dayIndex !== second.dayIndex) {
      return first.dayIndex - second.dayIndex;
    }

    return (
      timeToMinutes(first.startTime) -
      timeToMinutes(second.startTime)
    );
  });
}

export default function WeeklyPlanner() {
  const [recipes, setRecipes] =
    useState<Recipe[]>([]);

  const [recipesLoading, setRecipesLoading] =
    useState(true);

  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlan>({});

  const [cookingBlocks, setCookingBlocks] =
    useState<CookingBlock[]>([]);

  const [weekStart, setWeekStart] =
    useState<Date>(() => getMonday(new Date()));

  const [weeklyPlanId, setWeeklyPlanId] =
    useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] =
    useState<SelectedSlot>(null);

  const [
    selectedRecipeId,
    setSelectedRecipeId,
  ] = useState("");

  const [servings, setServings] =
    useState(1);

  const [
    isCookingBlockModalOpen,
    setIsCookingBlockModalOpen,
  ] = useState(false);

  const [
    editingCookingBlockId,
    setEditingCookingBlockId,
  ] = useState<string | null>(null);

  const [
    cookingBlockForm,
    setCookingBlockForm,
  ] = useState<CookingBlockForm>({
    ...emptyCookingBlockForm,
  });

  const [
    cookingBlockError,
    setCookingBlockError,
  ] = useState("");

  const [isLoadingWeek, setIsLoadingWeek] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    void loadRecipes();
  }, []);

  useEffect(() => {
    void loadWeek(weekStart);
  }, [weekStart]);

  async function getCurrentUser() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return null;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    return user;
  }

  async function loadRecipes() {
    setRecipesLoading(true);

    const { data, error } = await supabase
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
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Could not load recipes:",
        error,
      );

      setErrorMessage(error.message);
      setRecipesLoading(false);
      return;
    }

    setRecipes((data ?? []) as Recipe[]);
    setRecipesLoading(false);
  }

  async function loadWeek(
    requestedWeekStart: Date,
  ) {
    setIsLoadingWeek(true);
    setErrorMessage("");
    setStatusMessage("Loading week…");

    try {
      const user = await getCurrentUser();

      if (!user) {
        setWeeklyPlanId(null);
        setWeeklyPlan({});
        setCookingBlocks([]);
        setStatusMessage("");
        return;
      }

      const weekStartString =
        toDateString(requestedWeekStart);

      const {
        data: planData,
        error: planError,
      } = await supabase
        .from("weekly_plans")
        .select("id, week_start")
        .eq("user_id", user.id)
        .eq("week_start", weekStartString)
        .maybeSingle();

      if (planError) {
        throw planError;
      }

      if (!planData) {
        setWeeklyPlanId(null);
        setWeeklyPlan({});
        setCookingBlocks([]);
        setStatusMessage(
          "No plan saved for this week.",
        );
        return;
      }

      const plan = planData as WeeklyPlanRow;

      setWeeklyPlanId(plan.id);

      const [
        plannedMealsResult,
        cookingBlocksResult,
      ] = await Promise.all([
        supabase
          .from("planned_meals")
          .select(`
            id,
            recipe_id,
            day_index,
            meal_type,
            servings
          `)
          .eq("weekly_plan_id", plan.id),

        supabase
          .from("cooking_blocks")
          .select(`
            id,
            day_index,
            start_time,
            end_time,
            block_type,
            notes
          `)
          .eq("weekly_plan_id", plan.id)
          .order("day_index", {
            ascending: true,
          })
          .order("start_time", {
            ascending: true,
          }),
      ]);

      if (plannedMealsResult.error) {
        throw plannedMealsResult.error;
      }

      if (cookingBlocksResult.error) {
        throw cookingBlocksResult.error;
      }

      const meals: WeeklyPlan = {};

      (
        (plannedMealsResult.data ??
          []) as PlannedMealRow[]
      ).forEach((meal) => {
        meals[
          makeSlotKey(
            meal.day_index,
            meal.meal_type,
          )
        ] = {
          id: meal.id,
          recipeId: meal.recipe_id,
          servings: meal.servings,
        };
      });

      const blocks = (
        (cookingBlocksResult.data ??
          []) as CookingBlockRow[]
      ).map((block) => ({
        id: block.id,
        dayIndex: block.day_index,
        startTime: normalizeDatabaseTime(
          block.start_time,
        ),
        endTime: normalizeDatabaseTime(
          block.end_time,
        ),
        type: block.block_type,
        notes: block.notes,
      }));

      setWeeklyPlan(meals);
      setCookingBlocks(
        sortCookingBlocks(blocks),
      );

      setStatusMessage(
        "Week loaded from Supabase.",
      );
    } catch (error) {
      console.error(
        "Could not load week:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load this week.",
      );

      setWeeklyPlanId(null);
      setWeeklyPlan({});
      setCookingBlocks([]);
    } finally {
      setIsLoadingWeek(false);
    }
  }
  async function ensureWeeklyPlan() {
    if (weeklyPlanId) {
      return weeklyPlanId;
    }

    const user = await getCurrentUser();
    if (!user) {

    throw new Error(

      "Please log in before saving a weekly plan.",

    );

  }

  const weekStartString =
    toDateString(weekStart);

    const {
      data: existingPlan,
      error: existingPlanError,
    } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", weekStartString)
      .maybeSingle();

    if (existingPlanError) {
      throw existingPlanError;
    }

    if (existingPlan) {
      setWeeklyPlanId(existingPlan.id);
      return existingPlan.id;
    }

    const {
      data: insertedPlan,
      error: insertError,
    } = await supabase
      .from("weekly_plans")
      .insert({
        user_id: user.id,
        week_start: weekStartString,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    setWeeklyPlanId(insertedPlan.id);

    return insertedPlan.id;
  }

  const compatibleRecipes = useMemo(() => {
    if (!selectedSlot) {
      return [];
    }

    return recipes.filter((recipe) =>
      recipe.meal_types.includes(
        selectedSlot.mealType,
      ),
    );
  }, [recipes, selectedSlot]);

  const selectedRecipe = recipes.find(
    (recipe) =>
      recipe.id === selectedRecipeId,
  );

  const numberOfPlannedMeals =
    Object.keys(weeklyPlan).length;

  const totalCookingMinutes =
    cookingBlocks.reduce((total, block) => {
      const duration = getBlockDuration(
        block.startTime,
        block.endTime,
      );

      return (
        total +
        (Number.isFinite(duration)
          ? Math.max(0, duration)
          : 0)
      );
    }, 0);

  function openMealPicker(
    dayIndex: number,
    mealType: MealType,
  ) {
    const slotKey = makeSlotKey(
      dayIndex,
      mealType,
    );

    const currentMeal =
      weeklyPlan[slotKey];

    setSelectedSlot({
      dayIndex,
      mealType,
    });

    if (currentMeal) {
      setSelectedRecipeId(
        currentMeal.recipeId,
      );

      setServings(
        currentMeal.servings,
      );

      return;
    }

    const firstCompatibleRecipe =
      recipes.find((recipe) =>
        recipe.meal_types.includes(mealType),
      );

    setSelectedRecipeId(
      firstCompatibleRecipe?.id ?? "",
    );

    setServings(
      firstCompatibleRecipe?.default_servings ??
        1,
    );
  }

  function closeMealPicker() {
    setSelectedSlot(null);
    setSelectedRecipeId("");
    setServings(1);
  }

  function chooseRecipe(recipe: Recipe) {
    setSelectedRecipeId(recipe.id);
    setServings(recipe.default_servings);
  }

  async function saveMeal() {
    if (
      !selectedSlot ||
      !selectedRecipeId ||
      servings < 1
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("Saving meal…");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error(
          "Please log in before saving a meal.",
        );
      }
      const planId =
        await ensureWeeklyPlan();

      const slotKey = makeSlotKey(
        selectedSlot.dayIndex,
        selectedSlot.mealType,
      );

      const existingMeal =
        weeklyPlan[slotKey];

      if (existingMeal) {
        const {
          data: updatedMeal,
          error,
        } = await supabase
          .from("planned_meals")
          .update({
            recipe_id:
              selectedRecipeId,
            servings,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", existingMeal.id)
          .select(`
            id,
            recipe_id,
            servings
          `)
          .single();

        if (error) {
          throw error;
        }

        setWeeklyPlan((current) => ({
          ...current,
          [slotKey]: {
            id: updatedMeal.id,
            recipeId:
              updatedMeal.recipe_id,
            servings:
              updatedMeal.servings,
          },
        }));
      } else {
        const {
          data: insertedMeal,
          error,
        } = await supabase
          .from("planned_meals")
          .insert({
            weekly_plan_id: planId,
            user_id: user.id,
            recipe_id:
              selectedRecipeId,
            day_index:
              selectedSlot.dayIndex,
            meal_type:
              selectedSlot.mealType,
            servings,
          })
          .select(`
            id,
            recipe_id,
            servings
          `)
          .single();

        if (error) {
          throw error;
        }

        setWeeklyPlan((current) => ({
          ...current,
          [slotKey]: {
            id: insertedMeal.id,
            recipeId:
              insertedMeal.recipe_id,
            servings:
              insertedMeal.servings,
          },
        }));
      }

      setStatusMessage(
        "Meal saved online.",
      );

      closeMealPicker();
    } catch (error) {
      console.error(
        "Could not save meal:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save the meal.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeMeal() {
    if (!selectedSlot) {
      return;
    }

    const slotKey = makeSlotKey(
      selectedSlot.dayIndex,
      selectedSlot.mealType,
    );

    const existingMeal =
      weeklyPlan[slotKey];

    if (!existingMeal) {
      closeMealPicker();
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("planned_meals")
        .delete()
        .eq("id", existingMeal.id);

      if (error) {
        throw error;
      }

      setWeeklyPlan((current) => {
        const updated = {
          ...current,
        };

        delete updated[slotKey];

        return updated;
      });

      setStatusMessage(
        "Meal removed.",
      );

      closeMealPicker();
    } catch (error) {
      console.error(
        "Could not remove meal:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not remove the meal.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function clearMeals() {
    if (!weeklyPlanId) {
      return;
    }

    const shouldClear = window.confirm(
      "Remove all meals from this week?",
    );

    if (!shouldClear) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("planned_meals")
        .delete()
        .eq(
          "weekly_plan_id",
          weeklyPlanId,
        );

      if (error) {
        throw error;
      }

      setWeeklyPlan({});

      setStatusMessage(
        "All meals removed.",
      );
    } catch (error) {
      console.error(
        "Could not clear meals:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not clear the meals.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openNewCookingBlock() {
    setEditingCookingBlockId(null);

    setCookingBlockForm({
      ...emptyCookingBlockForm,
    });

    setCookingBlockError("");
    setIsCookingBlockModalOpen(true);
  }

  function openEditCookingBlock(
    block: CookingBlock,
  ) {
    setEditingCookingBlockId(block.id);

    setCookingBlockForm({
      dayIndex: block.dayIndex,
      startTime: block.startTime,
      endTime: block.endTime,
      type: block.type,
      notes: block.notes,
    });

    setCookingBlockError("");
    setIsCookingBlockModalOpen(true);
  }

  function closeCookingBlockModal() {
    setIsCookingBlockModalOpen(false);
    setEditingCookingBlockId(null);
    setCookingBlockError("");
  }

  function updateCookingBlockForm<
    Key extends keyof CookingBlockForm,
  >(
    field: Key,
    value: CookingBlockForm[Key],
  ) {
    setCookingBlockForm((current) => ({
      ...current,
      [field]: value,
    }));

    setCookingBlockError("");
  }

  function hasCookingBlockOverlap(
    candidate: CookingBlockForm,
  ) {
    const candidateStart = timeToMinutes(
      candidate.startTime,
    );

    const candidateEnd = timeToMinutes(
      candidate.endTime,
    );

    return cookingBlocks.some((block) => {
      if (
        block.id === editingCookingBlockId ||
        block.dayIndex !==
          candidate.dayIndex
      ) {
        return false;
      }

      const existingStart = timeToMinutes(
        block.startTime,
      );

      const existingEnd = timeToMinutes(
        block.endTime,
      );

      return (
        candidateStart < existingEnd &&
        candidateEnd > existingStart
      );
    });
  }

  async function saveCookingBlock() {
    if (
      !cookingBlockForm.startTime ||
      !cookingBlockForm.endTime
    ) {
      setCookingBlockError(
        "Please enter both a start time and an end time.",
      );

      return;
    }

    const startMinutes = timeToMinutes(
      cookingBlockForm.startTime,
    );

    const endMinutes = timeToMinutes(
      cookingBlockForm.endTime,
    );

    if (
      !Number.isFinite(startMinutes) ||
      !Number.isFinite(endMinutes)
    ) {
      setCookingBlockError(
        "Please enter valid start and end times.",
      );

      return;
    }

    if (endMinutes <= startMinutes) {
      setCookingBlockError(
        "The end time must be later than the start time.",
      );

      return;
    }

    if (endMinutes - startMinutes < 15) {
      setCookingBlockError(
        "A cooking block must be at least 15 minutes long.",
      );

      return;
    }

    if (
      hasCookingBlockOverlap(
        cookingBlockForm,
      )
    ) {
      setCookingBlockError(
        "This cooking block overlaps another block on the same day.",
      );

      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error(
          "Please log in before saving a cooking block.",
        );
      }
      const planId =
        await ensureWeeklyPlan();

      if (editingCookingBlockId) {
        const {
          data: updatedBlock,
          error,
        } = await supabase
          .from("cooking_blocks")
          .update({
            day_index:
              cookingBlockForm.dayIndex,
            start_time:
              cookingBlockForm.startTime,
            end_time:
              cookingBlockForm.endTime,
            block_type:
              cookingBlockForm.type,
            notes:
              cookingBlockForm.notes.trim(),
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            editingCookingBlockId,
          )
          .select(`
            id,
            day_index,
            start_time,
            end_time,
            block_type,
            notes
          `)
          .single();

        if (error) {
          throw error;
        }

        const normalizedBlock: CookingBlock =
          {
            id: updatedBlock.id,
            dayIndex:
              updatedBlock.day_index,
            startTime:
              normalizeDatabaseTime(
                updatedBlock.start_time,
              ),
            endTime:
              normalizeDatabaseTime(
                updatedBlock.end_time,
              ),
            type:
              updatedBlock.block_type,
            notes: updatedBlock.notes,
          };

        setCookingBlocks((current) =>
          sortCookingBlocks(
            current.map((block) =>
              block.id ===
              editingCookingBlockId
                ? normalizedBlock
                : block,
            ),
          ),
        );
      } else {
        const {
          data: insertedBlock,
          error,
        } = await supabase
          .from("cooking_blocks")
          .insert({
            weekly_plan_id: planId,
            user_id: user.id,
            day_index:
              cookingBlockForm.dayIndex,
            start_time:
              cookingBlockForm.startTime,
            end_time:
              cookingBlockForm.endTime,
            block_type:
              cookingBlockForm.type,
            notes:
              cookingBlockForm.notes.trim(),
          })
          .select(`
            id,
            day_index,
            start_time,
            end_time,
            block_type,
            notes
          `)
          .single();

        if (error) {
          throw error;
        }

        const normalizedBlock: CookingBlock =
          {
            id: insertedBlock.id,
            dayIndex:
              insertedBlock.day_index,
            startTime:
              normalizeDatabaseTime(
                insertedBlock.start_time,
              ),
            endTime:
              normalizeDatabaseTime(
                insertedBlock.end_time,
              ),
            type:
              insertedBlock.block_type,
            notes: insertedBlock.notes,
          };

        setCookingBlocks((current) =>
          sortCookingBlocks([
            ...current,
            normalizedBlock,
          ]),
        );
      }

      setStatusMessage(
        "Cooking block saved online.",
      );

      closeCookingBlockModal();
    } catch (error) {
      console.error(
        "Could not save cooking block:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save the cooking block.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCookingBlock(
    blockId: string,
  ) {
    const shouldDelete = window.confirm(
      "Delete this cooking block?",
    );

    if (!shouldDelete) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("cooking_blocks")
        .delete()
        .eq("id", blockId);

      if (error) {
        throw error;
      }

      setCookingBlocks((current) =>
        current.filter(
          (block) => block.id !== blockId,
        ),
      );

      setStatusMessage(
        "Cooking block deleted.",
      );
    } catch (error) {
      console.error(
        "Could not delete cooking block:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not delete the cooking block.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function getBlockTypeLabel(
    type: CookingBlockType,
  ) {
    return (
      cookingBlockTypes.find(
        (option) =>
          option.value === type,
      )?.label ?? type
    );
  }

  function goToPreviousWeek() {
    setWeekStart((current) =>
      addWeeks(current, -1),
    );
  }

  function goToNextWeek() {
    setWeekStart((current) =>
      addWeeks(current, 1),
    );
  }

  function goToCurrentWeek() {
    setWeekStart(
      getMonday(new Date()),
    );
  }

  return (
    <>
      <section className="planner-summary">
        <div className="planner-summary-stats">
          <div>
            <span>Meals selected</span>

            <strong>
              {numberOfPlannedMeals}
            </strong>

            <small>
              of{" "}
              {days.length *
                mealTypes.length}{" "}
              slots
            </small>
          </div>

          <div>
            <span>Cooking blocks</span>

            <strong>
              {cookingBlocks.length}
            </strong>

            <small>
              {formatDuration(
                totalCookingMinutes,
              )}{" "}
              available
            </small>
          </div>

          <div>
            <span>Recipes available</span>

            <strong>{recipes.length}</strong>

            <small>
              Loaded from Supabase
            </small>
          </div>
        </div>

        <button
          className="text-button danger-text"
          disabled={
            numberOfPlannedMeals === 0 ||
            isSaving
          }
          onClick={clearMeals}
          type="button"
        >
          Clear meals
        </button>
      </section>

      {errorMessage ? (
        <p
          className="form-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <section className="panel week-panel">
        <div className="week-toolbar">
          <div>
            <p className="eyebrow">
              Weekly plan
            </p>

            <h2>
              {formatWeekRange(weekStart)}
            </h2>

            <p className="save-status">
              {isLoadingWeek
                ? "Loading week…"
                : isSaving
                  ? "Saving…"
                  : statusMessage}
            </p>
          </div>

          <div className="week-actions">
            <button
              className="secondary-button"
              disabled={
                isLoadingWeek || isSaving
              }
              onClick={goToPreviousWeek}
              type="button"
            >
              Previous
            </button>

            <button
              className="secondary-button"
              disabled={
                isLoadingWeek || isSaving
              }
              onClick={goToCurrentWeek}
              type="button"
            >
              Current
            </button>

            <button
              className="secondary-button"
              disabled={
                isLoadingWeek || isSaving
              }
              onClick={goToNextWeek}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        <div className="week-grid-scroll">
          <div className="week-grid">
            <div className="week-grid-corner">
              Meal
            </div>

            {days.map(
              (day, dayIndex) => (
                <div
                  className="week-day-heading"
                  key={day}
                >
                  <strong>{day}</strong>
                  <small>
                    {formatDayDate(
                      weekStart,
                      dayIndex,
                    )}
                  </small>
                </div>
              ),
            )}

            {mealTypes.map((mealType) => (
              <div
                className="week-row"
                key={mealType}
              >
                <div className="meal-type-heading">
                  {mealType}
                </div>

                {days.map(
                  (day, dayIndex) => {
                    const slotKey =
                      makeSlotKey(
                        dayIndex,
                        mealType,
                      );

                    const plannedMeal =
                      weeklyPlan[slotKey];

                    const recipe =
                      plannedMeal
                        ? recipes.find(
                            (item) =>
                              item.id ===
                              plannedMeal.recipeId,
                          )
                        : undefined;

                    return (
                      <button
                        className={
                          recipe
                            ? "meal-slot meal-slot-filled"
                            : "meal-slot"
                        }
                        disabled={
                          recipesLoading ||
                          isLoadingWeek ||
                          isSaving
                        }
                        key={`${day}-${mealType}`}
                        onClick={() =>
                          openMealPicker(
                            dayIndex,
                            mealType,
                          )
                        }
                        type="button"
                      >
                        {recipesLoading ||
                        isLoadingWeek ? (
                          <small>
                            Loading…
                          </small>
                        ) : recipe &&
                          plannedMeal ? (
                          <>
                            <strong>
                              {recipe.name}
                            </strong>

                            <small>
                              {
                                plannedMeal.servings
                              }{" "}
                              {plannedMeal.servings ===
                              1
                                ? "serving"
                                : "servings"}
                            </small>

                            <span className="edit-label">
                              Edit
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="add-symbol">
                              +
                            </span>

                            <small>
                              Add meal
                            </small>
                          </>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel cooking-block-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Availability
            </p>

            <h2>Cooking blocks</h2>
          </div>

          <button
            className="primary-button"
            disabled={
              isLoadingWeek || isSaving
            }
            onClick={openNewCookingBlock}
            type="button"
          >
            Add cooking block
          </button>
        </div>

        {cookingBlocks.length === 0 ? (
          <div className="empty-state">
            <strong>
              No cooking blocks yet
            </strong>

            <p>
              Add the periods during the week
              when you are available to prepare
              or cook food.
            </p>

            <button
              className="secondary-button"
              disabled={
                isLoadingWeek || isSaving
              }
              onClick={openNewCookingBlock}
              type="button"
            >
              Add first cooking block
            </button>
          </div>
        ) : (
          <div className="cooking-block-list">
            {cookingBlocks.map((block) => {
              const duration =
                getBlockDuration(
                  block.startTime,
                  block.endTime,
                );

              return (
                <article
                  className={`cooking-block-card cooking-block-${block.type}`}
                  key={block.id}
                >
                  <div className="cooking-block-time">
                    <strong>
                      {days[block.dayIndex]}
                    </strong>

                    <span>
                      {formatTime(
                        block.startTime,
                      )}
                      –
                      {formatTime(
                        block.endTime,
                      )}
                    </span>

                    <small>
                      {formatDuration(duration)}
                    </small>
                  </div>

                  <div className="cooking-block-details">
                    <span className="block-type-badge">
                      {getBlockTypeLabel(
                        block.type,
                      )}
                    </span>

                    {block.notes ? (
                      <p>{block.notes}</p>
                    ) : (
                      <p className="muted-placeholder">
                        No notes
                      </p>
                    )}
                  </div>

                  <div className="cooking-block-actions">
                    <button
                      className="text-button"
                      disabled={isSaving}
                      onClick={() =>
                        openEditCookingBlock(
                          block,
                        )
                      }
                      type="button"
                    >
                      Edit
                    </button>

                    <button
                      className="text-button danger-text"
                      disabled={isSaving}
                      onClick={() =>
                        deleteCookingBlock(
                          block.id,
                        )
                      }
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedSlot ? (
        <div
          aria-labelledby="meal-picker-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMealPicker();
            }
          }}
        >
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  {days[
                    selectedSlot.dayIndex
                  ]}{" "}
                  ·{" "}
                  {formatDayDate(
                    weekStart,
                    selectedSlot.dayIndex,
                  )}
                </p>

                <h2 id="meal-picker-title">
                  Choose{" "}
                  {selectedSlot.mealType.toLowerCase()}
                </h2>
              </div>

              <button
                aria-label="Close meal picker"
                className="close-button"
                disabled={isSaving}
                onClick={closeMealPicker}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="recipe-picker-list">
              {compatibleRecipes.length ===
              0 ? (
                <div className="empty-state">
                  <strong>
                    No compatible recipes
                  </strong>

                  <p>
                    Add a recipe assigned to{" "}
                    {selectedSlot.mealType} on
                    the Recipes page.
                  </p>
                </div>
              ) : (
                compatibleRecipes.map(
                  (recipe) => {
                    const isSelected =
                      recipe.id ===
                      selectedRecipeId;

                    return (
                      <button
                        className={
                          isSelected
                            ? "recipe-option selected"
                            : "recipe-option"
                        }
                        disabled={isSaving}
                        key={recipe.id}
                        onClick={() =>
                          chooseRecipe(recipe)
                        }
                        type="button"
                      >
                        <div>
                          <strong>
                            {recipe.name}
                          </strong>

                          <p>
                            {recipe.description ||
                              "No description"}
                          </p>
                        </div>

                        <span>
                          {recipe.preparation_minutes +
                            recipe.cooking_minutes}{" "}
                          min
                        </span>
                      </button>
                    );
                  },
                )
              )}
            </div>

            {selectedRecipe ? (
              <div className="serving-control">
                <div>
                  <strong>Servings</strong>

                  <p>
                    How many servings are needed
                    for this meal?
                  </p>
                </div>

                <div className="stepper">
                  <button
                    aria-label="Decrease servings"
                    disabled={
                      servings <= 1 ||
                      isSaving
                    }
                    onClick={() =>
                      setServings((current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                      )
                    }
                    type="button"
                  >
                    −
                  </button>

                  <strong>{servings}</strong>

                  <button
                    aria-label="Increase servings"
                    disabled={isSaving}
                    onClick={() =>
                      setServings(
                        (current) =>
                          current + 1,
                      )
                    }
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}

            <div className="modal-actions">
              {weeklyPlan[
                makeSlotKey(
                  selectedSlot.dayIndex,
                  selectedSlot.mealType,
                )
              ] ? (
                <button
                  className="danger-button"
                  disabled={isSaving}
                  onClick={removeMeal}
                  type="button"
                >
                  Remove meal
                </button>
              ) : (
                <span />
              )}

              <div className="modal-primary-actions">
                <button
                  className="secondary-button"
                  disabled={isSaving}
                  onClick={closeMealPicker}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  disabled={
                    !selectedRecipeId ||
                    isSaving
                  }
                  onClick={saveMeal}
                  type="button"
                >
                  {isSaving
                    ? "Saving..."
                    : "Save meal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCookingBlockModalOpen ? (
        <div
          aria-labelledby="cooking-block-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCookingBlockModal();
            }
          }}
        >
          <div className="modal-card cooking-block-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  {formatWeekRange(
                    weekStart,
                  )}
                </p>

                <h2 id="cooking-block-title">
                  {editingCookingBlockId
                    ? "Edit cooking block"
                    : "Add cooking block"}
                </h2>
              </div>

              <button
                aria-label="Close cooking block editor"
                className="close-button"
                disabled={isSaving}
                onClick={
                  closeCookingBlockModal
                }
                type="button"
              >
                ×
              </button>
            </div>

            <div className="cooking-block-form">
              <label className="form-field">
                <span>Day</span>

                <select
                  value={
                    cookingBlockForm.dayIndex
                  }
                  onChange={(event) =>
                    updateCookingBlockForm(
                      "dayIndex",
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                >
                  {days.map(
                    (day, dayIndex) => (
                      <option
                        key={day}
                        value={dayIndex}
                      >
                        {day} ·{" "}
                        {formatDayDate(
                          weekStart,
                          dayIndex,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="time-field-grid">
                <label className="form-field">
                  <span>Start time</span>

                  <input
                    required
                    type="time"
                    value={
                      cookingBlockForm.startTime
                    }
                    onChange={(event) =>
                      updateCookingBlockForm(
                        "startTime",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>End time</span>

                  <input
                    required
                    type="time"
                    value={
                      cookingBlockForm.endTime
                    }
                    onChange={(event) =>
                      updateCookingBlockForm(
                        "endTime",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <fieldset className="block-type-fieldset">
                <legend>Block type</legend>

                <div className="block-type-options">
                  {cookingBlockTypes.map(
                    (option) => (
                      <label
                        className={
                          cookingBlockForm.type ===
                          option.value
                            ? "block-type-option selected"
                            : "block-type-option"
                        }
                        key={option.value}
                      >
                        <input
                          checked={
                            cookingBlockForm.type ===
                            option.value
                          }
                          name="cooking-block-type"
                          type="radio"
                          value={option.value}
                          onChange={() =>
                            updateCookingBlockForm(
                              "type",
                              option.value,
                            )
                          }
                        />

                        <span>
                          <strong>
                            {option.label}
                          </strong>

                          <small>
                            {
                              option.description
                            }
                          </small>
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              <label className="form-field">
                <span>Notes</span>

                <textarea
                  placeholder="For example: stovetop only, no oven, meal prep..."
                  rows={3}
                  value={
                    cookingBlockForm.notes
                  }
                  onChange={(event) =>
                    updateCookingBlockForm(
                      "notes",
                      event.target.value,
                    )
                  }
                />
              </label>

              {cookingBlockError ? (
                <p
                  className="form-error"
                  role="alert"
                >
                  {cookingBlockError}
                </p>
              ) : null}
            </div>

            <div className="modal-actions">
              <span />

              <div className="modal-primary-actions">
                <button
                  className="secondary-button"
                  disabled={isSaving}
                  onClick={
                    closeCookingBlockModal
                  }
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  disabled={isSaving}
                  onClick={saveCookingBlock}
                  type="button"
                >
                  {isSaving
                    ? "Saving..."
                    : editingCookingBlockId
                      ? "Save changes"
                      : "Add block"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}