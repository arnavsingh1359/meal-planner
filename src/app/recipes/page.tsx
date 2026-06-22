"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  formatIngredientName,
  inferIngredientCategory,
} from "@/lib/ingredient-utils";
import {
  inferTaskType,
  recipeTaskTypeDescriptions,
  recipeTaskTypeLabels,
  recipeTaskTypes,
  type RecipeTaskType,
} from "@/lib/scheduler-types";

type HelpTipProps = {
  text: string;
};

function HelpTip({ text }: HelpTipProps) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      ?
      <span className="help-tip-content" role="tooltip">
        {text}
      </span>
    </span>
  );
}

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

type StepType = "active" | "passive";

type CatalogueIngredient = {
  id: string;
  name: string;
  category: string;
  default_unit: string;
  approximate_allowed: boolean;
};

type RecipeIngredientInput = {
  ingredientId: string | null;
  name: string;
  quantity: string;
  unit: string;
  preparationNote: string;
  isOptional: boolean;
};

type RecipeStepInput = {
  instruction: string;
  durationMinutes: string;
  stepType: StepType;
};

type RecipeTaskInput = {
  title: string;
  instructions: string;
  taskType: RecipeTaskType;
  activeMinutes: string;
  passiveMinutes: string;
  dayOffset: string;
  startBeforeMealMinutes: string;
  canBatch: boolean;
  batchKey: string;
  unattended: boolean;
  blocksActiveWork: boolean;
};

type Recipe = {
  id: string;
  name: string;
  description: string;
  meal_types: string[];

  default_servings: number;
  minimum_batch_servings: number;
  maximum_batch_servings: number;

  preparation_minutes: number;
  cooking_minutes: number;
  cleanup_minutes: number;

  refrigerator_life_days: number;
  freezer_allowed: boolean;
  freezer_life_days: number | null;

  recipe_ingredients: {
    id: string;
    ingredient_id: string | null;
    name: string;
    quantity: number;
    unit: string;
    preparation_note: string;
    is_optional: boolean;
    position: number;
  }[];

  recipe_steps: {
    id: string;
    instruction: string;
    duration_minutes: number;
    step_type: StepType;
    position: number;
  }[];

  recipe_tasks: {
    id: string;
    title: string;
    instructions: string;
    task_type: RecipeTaskType;
    active_minutes: number;
    passive_minutes: number;
    day_offset: number;
    start_before_meal_minutes: number;
    can_batch: boolean;
    batch_key: string;
    unattended: boolean;
    blocks_active_work: boolean;
    position: number;
  }[];
};

const mealTypeOptions: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const emptyIngredient: RecipeIngredientInput = {
  ingredientId: null,
  name: "",
  quantity: "",
  unit: "",
  preparationNote: "",
  isOptional: false,
};

const emptyStep: RecipeStepInput = {
  instruction: "",
  durationMinutes: "",
  stepType: "active",
};

const emptyRecipeTask: RecipeTaskInput = {
  title: "",
  instructions: "",
  taskType: "preparation",
  activeMinutes: "0",
  passiveMinutes: "0",
  dayOffset: "0",
  startBeforeMealMinutes: "60",
  canBatch: false,
  batchKey: "",
  unattended: false,
  blocksActiveWork: true,
};

function normalizeIngredientName(value: string) {
  return formatIngredientName(value);
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [catalogueIngredients, setCatalogueIngredients] = useState<
    CatalogueIngredient[]
  >([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [mealTypes, setMealTypes] = useState<MealType[]>([]);

  const [defaultServings, setDefaultServings] = useState("1");
  const [minimumBatchServings, setMinimumBatchServings] = useState("1");
  const [maximumBatchServings, setMaximumBatchServings] = useState("10");

  const [preparationMinutes, setPreparationMinutes] = useState("0");

  const [cookingMinutes, setCookingMinutes] = useState("0");
  const [cleanupMinutes, setCleanupMinutes] = useState("0");

  const [refrigeratorLifeDays, setRefrigeratorLifeDays] = useState("3");

  const [freezerAllowed, setFreezerAllowed] = useState(false);
  const [freezerLifeDays, setFreezerLifeDays] = useState("30");

  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>([
    { ...emptyIngredient },
  ]);

  const [steps, setSteps] = useState<RecipeStepInput[]>([{ ...emptyStep }]);
  const [recipeTasks, setRecipeTasks] = useState<RecipeTaskInput[]>([
    { ...emptyRecipeTask },
  ]);

  useEffect(() => {
    void loadInitialData();
  }, []);

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

  async function loadInitialData() {
    setIsLoading(true);
    setMessage("");

    try {
      await Promise.all([loadRecipes(), loadCatalogueIngredients()]);
    } catch (error) {
      console.error("Could not load recipe data:", error);

      setMessage(
        error instanceof Error ? error.message : "Could not load recipes.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCatalogueIngredients() {
    const user = await getCurrentUser();

    if (!user) {
      setCatalogueIngredients([]);
      return;
    }

    const { data, error } = await supabase
      .from("ingredients")
      .select(
        `
        id,
        name,
        category,
        default_unit,
        approximate_allowed
      `,
      )
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    setCatalogueIngredients((data ?? []) as CatalogueIngredient[]);
  }

  async function loadRecipes() {
    const { data, error } = await supabase
      .from("recipes")
      .select(
        `
        id,
        name,
        description,
        meal_types,
        default_servings,
        minimum_batch_servings,
        maximum_batch_servings,
        preparation_minutes,
        cooking_minutes,
        cleanup_minutes,
        refrigerator_life_days,
        freezer_allowed,
        freezer_life_days,
        recipe_ingredients (
          id,
          ingredient_id,
          name,
          quantity,
          unit,
          preparation_note,
          is_optional,
          position
        ),
        recipe_steps (
          id,
          instruction,
          duration_minutes,
          step_type,
          position
        ),
        recipe_tasks (
          id,
          title,
          instructions,
          task_type,
          active_minutes,
          passive_minutes,
          day_offset,
          start_before_meal_minutes,
          can_batch,
          batch_key,
          unattended,
          blocks_active_work,
          position
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const normalizedRecipes = (data ?? []).map((recipe) => ({
      ...recipe,

      recipe_ingredients: [...(recipe.recipe_ingredients ?? [])].sort(
        (first, second) => first.position - second.position,
      ),

      recipe_steps: [...(recipe.recipe_steps ?? [])].sort(
        (first, second) => first.position - second.position,
      ),

      recipe_tasks: [...(recipe.recipe_tasks ?? [])].sort(
        (first, second) => first.position - second.position,
      ),
    })) as Recipe[];

    setRecipes(normalizedRecipes);
  }

  function resetForm() {
    setEditingRecipeId(null);

    setName("");
    setDescription("");
    setMealTypes([]);

    setDefaultServings("1");
    setMinimumBatchServings("1");
    setMaximumBatchServings("10");

    setPreparationMinutes("0");
    setCookingMinutes("0");
    setCleanupMinutes("0");

    setRefrigeratorLifeDays("3");

    setFreezerAllowed(false);
    setFreezerLifeDays("30");

    setIngredients([{ ...emptyIngredient }]);
    setSteps([{ ...emptyStep }]);
    setRecipeTasks([{ ...emptyRecipeTask }]);

    setMessage("");
  }

  function openNewRecipe() {
    resetForm();
    setIsFormOpen(true);
  }

  function openEditRecipe(recipe: Recipe) {
    setEditingRecipeId(recipe.id);

    setName(recipe.name);
    setDescription(recipe.description);

    setMealTypes(recipe.meal_types as MealType[]);

    setDefaultServings(String(recipe.default_servings));

    setMinimumBatchServings(String(recipe.minimum_batch_servings));

    setMaximumBatchServings(String(recipe.maximum_batch_servings));

    setPreparationMinutes(String(recipe.preparation_minutes));

    setCookingMinutes(String(recipe.cooking_minutes));
    setCleanupMinutes(String(recipe.cleanup_minutes));

    setRefrigeratorLifeDays(String(recipe.refrigerator_life_days));

    setFreezerAllowed(recipe.freezer_allowed);

    setFreezerLifeDays(String(recipe.freezer_life_days ?? 30));

    setIngredients(
      recipe.recipe_ingredients.length > 0
        ? recipe.recipe_ingredients.map((ingredient) => ({
            ingredientId: ingredient.ingredient_id,
            name: ingredient.name,
            quantity: String(ingredient.quantity),
            unit: ingredient.unit,
            preparationNote: ingredient.preparation_note,
            isOptional: ingredient.is_optional,
          }))
        : [{ ...emptyIngredient }],
    );

    setSteps(
      recipe.recipe_steps.length > 0
        ? recipe.recipe_steps.map((step) => ({
            instruction: step.instruction,
            durationMinutes: String(step.duration_minutes),
            stepType: step.step_type,
          }))
        : [{ ...emptyStep }],
    );

    setRecipeTasks(
      recipe.recipe_tasks.length > 0
        ? recipe.recipe_tasks.map((task) => ({
            title: task.title,
            instructions: task.instructions,
            taskType: task.task_type,
            activeMinutes: String(task.active_minutes),
            passiveMinutes: String(task.passive_minutes),
            dayOffset: String(task.day_offset),
            startBeforeMealMinutes: String(task.start_before_meal_minutes),
            canBatch: task.can_batch,
            batchKey: task.batch_key,
            unattended: task.unattended,
            blocksActiveWork: task.blocks_active_work,
          }))
        : [{ ...emptyRecipeTask }],
    );

    setMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  function toggleMealType(mealType: MealType) {
    setMealTypes((current) =>
      current.includes(mealType)
        ? current.filter((item) => item !== mealType)
        : [...current, mealType],
    );
  }

  function updateIngredient(
    index: number,
    field: keyof RecipeIngredientInput,
    value: string | boolean | null,
  ) {
    setIngredients((current) =>
      current.map((ingredient, ingredientIndex) =>
        ingredientIndex === index
          ? {
              ...ingredient,
              [field]: value,
            }
          : ingredient,
      ),
    );
  }

  function handleIngredientNameChange(index: number, value: string) {
    const normalizedValue = normalizeIngredientName(value);

    const matchingIngredient = catalogueIngredients.find(
      (ingredient) =>
        ingredient.name.toLowerCase() === normalizedValue.toLowerCase(),
    );

    setIngredients((current) =>
      current.map((ingredient, ingredientIndex) => {
        if (ingredientIndex !== index) {
          return ingredient;
        }

        if (matchingIngredient) {
          return {
            ...ingredient,
            ingredientId: matchingIngredient.id,
            name: value,
            unit: ingredient.unit || matchingIngredient.default_unit,
          };
        }

        return {
          ...ingredient,
          ingredientId: null,
          name: value,
        };
      }),
    );
  }

  function addIngredient() {
    setIngredients((current) => [...current, { ...emptyIngredient }]);
  }

  function removeIngredient(index: number) {
    setIngredients((current) =>
      current.filter((_, ingredientIndex) => ingredientIndex !== index),
    );
  }

  function updateStep(
    index: number,
    field: keyof RecipeStepInput,
    value: string,
  ) {
    setSteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index
          ? {
              ...step,
              [field]: value,
            }
          : step,
      ),
    );
  }

  function addStep() {
    setSteps((current) => [...current, { ...emptyStep }]);
  }

  function removeStep(index: number) {
    setSteps((current) =>
      current.filter((_, stepIndex) => stepIndex !== index),
    );
  }

  function updateRecipeTask(
    index: number,
    field: keyof RecipeTaskInput,
    value: string | boolean,
  ) {
    setRecipeTasks((current) =>
      current.map((task, taskIndex) =>
        taskIndex === index
          ? {
              ...task,
              [field]: value,
            }
          : task,
      ),
    );
  }

  function addRecipeTask() {
    setRecipeTasks((current) => [...current, { ...emptyRecipeTask }]);
  }

  function removeRecipeTask(index: number) {
    setRecipeTasks((current) =>
      current.filter((_, taskIndex) => taskIndex !== index),
    );
  }

  function inferRecipeTaskFromText(index: number) {
    setRecipeTasks((current) =>
      current.map((task, taskIndex) => {
        if (taskIndex !== index) {
          return task;
        }

        const inferredType = inferTaskType(
          `${task.title} ${task.instructions}`,
        );

        return {
          ...task,
          taskType: inferredType,
          unattended:
            task.unattended ||
            ["marinating", "soaking", "thawing", "resting", "cooling"].includes(
              inferredType,
            ),
        };
      }),
    );
  }

  function validateForm() {
    if (!name.trim()) {
      return "Enter a recipe name.";
    }

    if (mealTypes.length === 0) {
      return "Select at least one meal type.";
    }

    if (!defaultServings || Number(defaultServings) < 1) {
      return "Default servings must be at least 1.";
    }

    if (!minimumBatchServings || Number(minimumBatchServings) < 1) {
      return "Minimum batch servings must be at least 1.";
    }

    if (!maximumBatchServings || Number(maximumBatchServings) < 1) {
      return "Maximum batch servings must be at least 1.";
    }

    if (Number(maximumBatchServings) < Number(minimumBatchServings)) {
      return "Maximum batch servings cannot be smaller than the minimum.";
    }

    if (
      Number(preparationMinutes) < 0 ||
      Number(cookingMinutes) < 0 ||
      Number(cleanupMinutes) < 0
    ) {
      return "Recipe times cannot be negative.";
    }

    if (Number(refrigeratorLifeDays) < 0) {
      return "Refrigerator life cannot be negative.";
    }

    if (freezerAllowed && Number(freezerLifeDays) < 0) {
      return "Freezer life cannot be negative.";
    }

    if (ingredients.length === 0) {
      return "Add at least one ingredient.";
    }

    for (const ingredient of ingredients) {
      if (!ingredient.name.trim()) {
        return "Every ingredient needs a name.";
      }

      if (!ingredient.quantity.trim() || Number(ingredient.quantity) <= 0) {
        return `Enter a valid quantity for ${ingredient.name || "each ingredient"}.`;
      }

      if (!ingredient.unit.trim()) {
        return `Enter a unit for ${ingredient.name}.`;
      }
    }

    if (!steps.some((step) => step.instruction.trim())) {
      return "Add at least one cooking step.";
    }

    for (const task of recipeTasks) {
      if (!task.title.trim()) {
        return "Every schedule task needs a title.";
      }

      const numericFields = [
        Number(task.activeMinutes),
        Number(task.passiveMinutes),
        Number(task.startBeforeMealMinutes),
      ];

      if (numericFields.some((value) => !Number.isFinite(value) || value < 0)) {
        return `Enter valid non-negative timing values for ${task.title}.`;
      }

      const dayOffset = Number(task.dayOffset);

      if (!Number.isInteger(dayOffset) || dayOffset < -14 || dayOffset > 14) {
        return `Day offset for ${task.title} must be a whole number from -14 to 14.`;
      }

      if (task.canBatch && !task.batchKey.trim()) {
        return `Add a batch key for ${task.title}, or turn off batching.`;
      }
    }

    return "";
  }

  async function findOrCreateCatalogueIngredient(
    userId: string,
    ingredientInput: RecipeIngredientInput,
  ) {
    if (ingredientInput.ingredientId) {
      const matchingIngredient = catalogueIngredients.find(
        (ingredient) => ingredient.id === ingredientInput.ingredientId,
      );

      if (matchingIngredient) {
        return matchingIngredient;
      }
    }

    const normalizedName = normalizeIngredientName(ingredientInput.name);

    const locallyMatchingIngredient = catalogueIngredients.find(
      (ingredient) =>
        ingredient.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (locallyMatchingIngredient) {
      return locallyMatchingIngredient;
    }

    const { data: existingIngredients, error: existingError } = await supabase
      .from("ingredients")
      .select(
        `
        id,
        name,
        category,
        default_unit,
        approximate_allowed
      `,
      )
      .eq("user_id", userId)
      .ilike("name", normalizedName)
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const existingIngredient = existingIngredients?.[0] as
      | CatalogueIngredient
      | undefined;

    if (existingIngredient) {
      return existingIngredient;
    }

    const { data, error } = await supabase
      .from("ingredients")
      .insert({
        user_id: userId,
        name: normalizedName,
        category: inferIngredientCategory(normalizedName),
        default_unit: ingredientInput.unit.trim(),
        approximate_allowed: true,
      })
      .select(
        `
        id,
        name,
        category,
        default_unit,
        approximate_allowed
      `,
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: duplicateIngredients, error: duplicateError } =
          await supabase
            .from("ingredients")
            .select(
              `
            id,
            name,
            category,
            default_unit,
            approximate_allowed
          `,
            )
            .eq("user_id", userId)
            .ilike("name", normalizedName)
            .limit(1);

        if (duplicateError) {
          throw duplicateError;
        }

        const duplicateIngredient = duplicateIngredients?.[0] as
          | CatalogueIngredient
          | undefined;

        if (duplicateIngredient) {
          return duplicateIngredient;
        }
      }

      throw error;
    }

    return data as CatalogueIngredient;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Please log in before saving a recipe.");
      }

      const recipeValues = {
        user_id: user.id,

        name: name.trim(),
        description: description.trim(),
        meal_types: mealTypes,

        default_servings: Number(defaultServings),

        minimum_batch_servings: Number(minimumBatchServings),

        maximum_batch_servings: Number(maximumBatchServings),

        preparation_minutes: Number(preparationMinutes),

        cooking_minutes: Number(cookingMinutes),

        cleanup_minutes: Number(cleanupMinutes),

        refrigerator_life_days: Number(refrigeratorLifeDays),

        freezer_allowed: freezerAllowed,

        freezer_life_days: freezerAllowed ? Number(freezerLifeDays) : null,

        updated_at: new Date().toISOString(),
      };

      let recipeId: string;

      if (editingRecipeId) {
        const { error: updateError } = await supabase
          .from("recipes")
          .update(recipeValues)
          .eq("id", editingRecipeId);

        if (updateError) {
          throw updateError;
        }

        recipeId = editingRecipeId;

        const { error: deleteIngredientsError } = await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", recipeId);

        if (deleteIngredientsError) {
          throw deleteIngredientsError;
        }

        const { error: deleteStepsError } = await supabase
          .from("recipe_steps")
          .delete()
          .eq("recipe_id", recipeId);

        if (deleteStepsError) {
          throw deleteStepsError;
        }

        const { error: deleteTasksError } = await supabase
          .from("recipe_tasks")
          .delete()
          .eq("recipe_id", recipeId);

        if (deleteTasksError) {
          throw deleteTasksError;
        }
      } else {
        const { data: insertedRecipe, error: recipeError } = await supabase
          .from("recipes")
          .insert(recipeValues)
          .select("id")
          .single();

        if (recipeError) {
          throw recipeError;
        }

        recipeId = insertedRecipe.id;
      }

      const resolvedCatalogueIngredients = await Promise.all(
        ingredients.map((ingredient) =>
          findOrCreateCatalogueIngredient(user.id, ingredient),
        ),
      );

      const ingredientRows = ingredients.map((ingredient, index) => ({
        recipe_id: recipeId,
        user_id: user.id,

        ingredient_id: resolvedCatalogueIngredients[index].id,

        name: resolvedCatalogueIngredients[index].name,

        quantity: Number(ingredient.quantity),

        unit: ingredient.unit.trim(),

        preparation_note: ingredient.preparationNote.trim(),

        is_optional: ingredient.isOptional,

        position: index,
      }));

      const { error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows);

      if (ingredientError) {
        throw ingredientError;
      }

      const stepRows = steps
        .filter((step) => step.instruction.trim())
        .map((step, index) => ({
          recipe_id: recipeId,
          user_id: user.id,

          instruction: step.instruction.trim(),

          duration_minutes: Number(step.durationMinutes) || 0,

          step_type: step.stepType,

          position: index,
        }));

      const { error: stepError } = await supabase
        .from("recipe_steps")
        .insert(stepRows);

      if (stepError) {
        throw stepError;
      }

      const recipeTaskRows = recipeTasks.map((task, index) => ({
        recipe_id: recipeId,
        user_id: user.id,
        title: task.title.trim(),
        instructions: task.instructions.trim(),
        task_type: task.taskType,
        active_minutes: Number(task.activeMinutes) || 0,
        passive_minutes: Number(task.passiveMinutes) || 0,
        day_offset: Number(task.dayOffset) || 0,
        start_before_meal_minutes:
          Number(task.startBeforeMealMinutes) || 0,
        can_batch: task.canBatch,
        batch_key: task.canBatch ? task.batchKey.trim() : "",
        unattended: task.unattended,
        blocks_active_work: task.blocksActiveWork,
        position: index,
      }));

      const { error: recipeTaskError } = await supabase
        .from("recipe_tasks")
        .insert(recipeTaskRows);

      if (recipeTaskError) {
        throw recipeTaskError;
      }

      closeForm();

      await Promise.all([loadRecipes(), loadCatalogueIngredients()]);
    } catch (error) {
      console.error("Recipe saving error:", error);

      setMessage(
        error instanceof Error ? error.message : "Could not save the recipe.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecipe(recipeId: string) {
    const shouldDelete = window.confirm(
      "Delete this recipe and all of its ingredients and steps?",
    );

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId);

    if (error) {
      console.error("Recipe deletion error:", error);

      setMessage(error.message);
      return;
    }

    await loadRecipes();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Recipe library</p>

          <h1>Recipes</h1>

          <p className="subtitle">
            Add ingredients, cooking steps, storage rules, and batch limits for
            each dish.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openNewRecipe}
          type="button"
        >
          Add recipe
        </button>
      </header>

      {message && !isFormOpen ? (
        <p className="form-error" role="alert">
          {message}
        </p>
      ) : null}

      <section
        aria-label="Recipes grouped by meal type"
        style={{
          display: "grid",
          gap: "14px",
        }}
      >
        {isLoading ? (
          <article className="panel">
            <p>Loading recipes...</p>
          </article>
        ) : recipes.length === 0 ? (
          <article className="panel empty-state">
            <strong>No recipes yet</strong>

            <p>Add your first recipe to begin building your meal library.</p>
          </article>
        ) : (
          mealTypeOptions.map((mealType) => {
            const mealRecipes = recipes
              .filter((recipe) => recipe.meal_types.includes(mealType))
              .sort((first, second) => first.name.localeCompare(second.name));

            return (
              <details
                className="panel"
                key={mealType}
                style={{
                  padding: 0,
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    padding: "18px 20px",
                    cursor: "pointer",
                    listStyle: "none",
                    userSelect: "none",
                  }}
                >
                  <div>
                    <p className="eyebrow" style={{ marginBottom: "4px" }}>
                      Meal type
                    </p>

                    <h2 style={{ margin: 0 }}>{mealType}</h2>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      minWidth: "36px",
                      height: "36px",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "999px",
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                      fontWeight: 800,
                    }}
                  >
                    {mealRecipes.length}
                  </span>
                </summary>

                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    padding: "0 16px 16px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  {mealRecipes.length === 0 ? (
                    <div className="empty-state">
                      <strong>No {mealType.toLowerCase()} recipes</strong>

                      <p>Add or edit a recipe and assign it to {mealType}.</p>
                    </div>
                  ) : (
                    mealRecipes.map((recipe) => (
                      <details
                        key={`${mealType}-${recipe.id}`}
                        style={{
                          marginTop: "12px",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          background: "var(--surface-soft)",
                          overflow: "hidden",
                        }}
                      >
                        <summary
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            padding: "15px 16px",
                            cursor: "pointer",
                            listStyle: "none",
                            userSelect: "none",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <h3
                              style={{
                                margin: 0,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {recipe.name}
                            </h3>

                            <p
                              style={{
                                margin: "5px 0 0",
                                color: "var(--muted)",
                                fontSize: "0.8rem",
                              }}
                            >
                              {recipe.default_servings} servings ·{" "}
                              {recipe.preparation_minutes +
                                recipe.cooking_minutes +
                                recipe.cleanup_minutes}{" "}
                              min
                            </p>
                          </div>

                          <span
                            aria-hidden="true"
                            style={{
                              color: "var(--primary)",
                              fontSize: "1.25rem",
                              fontWeight: 800,
                            }}
                          >
                            ⌄
                          </span>
                        </summary>

                        <div
                          style={{
                            display: "grid",
                            gap: "18px",
                            padding: "0 16px 18px",
                            borderTop: "1px solid var(--border)",
                          }}
                        >
                          <div
                            className="recipe-card-heading"
                            style={{ paddingTop: "16px" }}
                          >
                            <div>
                              <p className="eyebrow">
                                {recipe.meal_types.join(" · ")}
                              </p>

                              <h2>{recipe.name}</h2>
                            </div>

                            <div className="recipe-card-actions">
                              <button
                                className="text-button"
                                onClick={() => openEditRecipe(recipe)}
                                type="button"
                              >
                                Edit
                              </button>

                              <button
                                className="text-button danger-text"
                                onClick={() => deleteRecipe(recipe.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {recipe.description ? (
                            <p style={{ margin: 0 }}>{recipe.description}</p>
                          ) : null}

                          <div className="recipe-metadata">
                            <span>
                              {recipe.default_servings} default servings
                            </span>

                            <span>
                              Batch {recipe.minimum_batch_servings}–
                              {recipe.maximum_batch_servings}
                            </span>

                            <span>
                              {recipe.preparation_minutes +
                                recipe.cooking_minutes +
                                recipe.cleanup_minutes}{" "}
                              min total
                            </span>

                            <span>
                              {recipe.refrigerator_life_days} days refrigerated
                            </span>

                            <span>
                              {recipe.freezer_allowed
                                ? `Freezer friendly${
                                    recipe.freezer_life_days !== null
                                      ? ` · ${recipe.freezer_life_days} days`
                                      : ""
                                  }`
                                : "Do not freeze"}
                            </span>
                          </div>

                          <div className="recipe-card-section">
                            <strong>Ingredients</strong>

                            <ul>
                              {recipe.recipe_ingredients.map((ingredient) => (
                                <li key={ingredient.id}>
                                  {ingredient.quantity} {ingredient.unit}{" "}
                                  {ingredient.name}
                                  {ingredient.preparation_note
                                    ? `, ${ingredient.preparation_note}`
                                    : ""}
                                  {ingredient.is_optional ? " (optional)" : ""}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="recipe-card-section">
                            <strong>Steps</strong>

                            <ol>
                              {recipe.recipe_steps.map((step) => (
                                <li key={step.id}>
                                  {step.instruction}

                                  {step.duration_minutes > 0
                                    ? ` — ${step.duration_minutes} min`
                                    : ""}

                                  {` (${step.step_type})`}
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div className="recipe-card-section">
                            <strong>Schedule tasks</strong>

                            {recipe.recipe_tasks.length === 0 ? (
                              <p>No scheduler tasks configured.</p>
                            ) : (
                              <ol>
                                {recipe.recipe_tasks.map((task) => (
                                  <li key={task.id}>
                                    <strong>{task.title}</strong> — {
                                      recipeTaskTypeLabels[task.task_type]
                                    }
                                    {task.day_offset !== 0
                                      ? ` · day ${task.day_offset > 0 ? "+" : ""}${task.day_offset}`
                                      : " · same day"}
                                    {task.start_before_meal_minutes > 0
                                      ? ` · ${task.start_before_meal_minutes} min before meal`
                                      : ""}
                                    {task.active_minutes > 0
                                      ? ` · ${task.active_minutes} min active`
                                      : ""}
                                    {task.passive_minutes > 0
                                      ? ` · ${task.passive_minutes} min passive`
                                      : ""}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </div>
                      </details>
                    ))
                  )}
                </div>
              </details>
            );
          })
        )}
      </section>

      {isFormOpen ? (
        <div
          aria-labelledby="recipe-form-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeForm();
            }
          }}
        >
          <div className="modal-card recipe-form-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Recipe library</p>

                <h2 id="recipe-form-title">
                  {editingRecipeId ? "Edit recipe" : "Add recipe"}
                </h2>
              </div>

              <button
                aria-label="Close recipe editor"
                className="close-button"
                disabled={isSaving}
                onClick={closeForm}
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="recipe-form-content">
                <section className="recipe-form-section">
                  <h3>Basic details</h3>

                  <label className="form-field">
                    <span>Name</span>

                    <input
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>

                  <label className="form-field">
                    <span>Description</span>

                    <textarea
                      rows={3}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>

                  <fieldset className="meal-type-fieldset">
                    <legend>Meal types</legend>

                    <div className="meal-type-options">
                      {mealTypeOptions.map((mealType) => (
                        <label key={mealType}>
                          <input
                            checked={mealTypes.includes(mealType)}
                            type="checkbox"
                            onChange={() => toggleMealType(mealType)}
                          />

                          <span>{mealType}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </section>

                <section className="recipe-form-section">
                  <h3>Servings and timing</h3>

                  <div className="recipe-field-grid">
                    <label className="form-field">
                      <span>
                        Default servings
                        <HelpTip text="The normal number of portions produced when you make this recipe once." />
                      </span>

                      <input
                        min="1"
                        required
                        type="number"
                        value={defaultServings}
                        onChange={(event) =>
                          setDefaultServings(event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Minimum batch
                        <HelpTip text="The smallest practical number of servings worth making at one time." />
                      </span>

                      <input
                        min="1"
                        required
                        type="number"
                        value={minimumBatchServings}
                        onChange={(event) =>
                          setMinimumBatchServings(event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Maximum batch
                        <HelpTip text="The largest number of servings you can comfortably make in one cooking batch." />
                      </span>

                      <input
                        min="1"
                        required
                        type="number"
                        value={maximumBatchServings}
                        onChange={(event) =>
                          setMaximumBatchServings(event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Preparation minutes
                        <HelpTip text="Hands-on work before cooking starts, such as washing, chopping, measuring, or mixing." />
                      </span>

                      <input
                        min="0"
                        required
                        type="number"
                        value={preparationMinutes}
                        onChange={(event) =>
                          setPreparationMinutes(event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Cooking minutes
                        <HelpTip text="The main cooking duration, including active work and unattended cooking time." />
                      </span>

                      <input
                        min="0"
                        required
                        type="number"
                        value={cookingMinutes}
                        onChange={(event) =>
                          setCookingMinutes(event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Cleanup minutes
                        <HelpTip text="Estimated time needed to wash cookware, wipe surfaces, and put ingredients away." />
                      </span>

                      <input
                        min="0"
                        required
                        type="number"
                        value={cleanupMinutes}
                        onChange={(event) =>
                          setCleanupMinutes(event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Refrigerator life in days
                        <HelpTip text="How many days the cooked dish can stay refrigerated before it should be eaten, frozen, or discarded." />
                      </span>

                      <input
                        min="0"
                        required
                        type="number"
                        value={refrigeratorLifeDays}
                        onChange={(event) =>
                          setRefrigeratorLifeDays(event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <label className="checkbox-field">
                    <input
                      checked={freezerAllowed}
                      type="checkbox"
                      onChange={(event) =>
                        setFreezerAllowed(event.target.checked)
                      }
                    />

                    <span>This recipe can be frozen</span>
                  </label>

                  {freezerAllowed ? (
                    <label className="form-field">
                      <span>
                        Freezer life in days
                        <HelpTip text="How many days the dish should be considered usable while frozen." />
                      </span>

                      <input
                        min="0"
                        required
                        type="number"
                        value={freezerLifeDays}
                        onChange={(event) =>
                          setFreezerLifeDays(event.target.value)
                        }
                      />
                    </label>
                  ) : null}
                </section>

                <section className="recipe-form-section">
                  <div className="recipe-section-heading">
                    <h3>Ingredients</h3>

                    <button
                      className="secondary-button"
                      onClick={addIngredient}
                      type="button"
                    >
                      Add ingredient
                    </button>
                  </div>

                  <div className="dynamic-list">
                    {ingredients.map((ingredient, index) => {
                      const selectedCatalogueIngredient =
                        catalogueIngredients.find(
                          (catalogueIngredient) =>
                            catalogueIngredient.id === ingredient.ingredientId,
                        );

                      return (
                        <div className="dynamic-row" key={index}>
                          <div className="ingredient-row-grid">
                            <label className="form-field">
                              <span>
                                Ingredient
                                <HelpTip text="Choose an existing pantry ingredient or type a new ingredient name. New names are added to the ingredient catalogue automatically." />
                              </span>

                              <input
                                list="ingredient-catalogue-options"
                                placeholder="Start typing an ingredient"
                                required
                                value={ingredient.name}
                                onChange={(event) =>
                                  handleIngredientNameChange(
                                    index,
                                    event.target.value,
                                  )
                                }
                              />

                              <datalist id="ingredient-catalogue-options">
                                {catalogueIngredients.map(
                                  (catalogueIngredient) => (
                                    <option
                                      key={catalogueIngredient.id}
                                      value={catalogueIngredient.name}
                                    >
                                      {catalogueIngredient.category}
                                    </option>
                                  ),
                                )}
                              </datalist>
                            </label>

                            <label className="form-field">
                              <span>
                                Quantity
                                <HelpTip text="The amount required for the recipe's default serving quantity." />
                              </span>

                              <input
                                min="0"
                                required
                                step="any"
                                type="number"
                                value={ingredient.quantity}
                                onChange={(event) =>
                                  updateIngredient(
                                    index,
                                    "quantity",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>

                            <label className="form-field">
                              <span>
                                Unit
                                <HelpTip text="Use a consistent measurement such as g, kg, ml, cup, tsp, tbsp, or whole." />
                              </span>

                              <input
                                placeholder="g, ml, whole..."
                                required
                                value={ingredient.unit}
                                onChange={(event) =>
                                  updateIngredient(
                                    index,
                                    "unit",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>

                          {selectedCatalogueIngredient ? (
                            <p className="ingredient-catalogue-match">
                              Linked to catalogue:{" "}
                              <strong>
                                {selectedCatalogueIngredient.name}
                              </strong>{" "}
                              · {selectedCatalogueIngredient.category}
                            </p>
                          ) : ingredient.name.trim() ? (
                            <p className="ingredient-catalogue-new">
                              This will create a new ingredient catalogue entry.
                            </p>
                          ) : null}

                          <label className="form-field">
                            <span>
                              Preparation note
                              <HelpTip text="Describe how the ingredient should be prepared, such as chopped, rinsed, thawed, or divided." />
                            </span>

                            <input
                              placeholder="Finely chopped, rinsed..."
                              value={ingredient.preparationNote}
                              onChange={(event) =>
                                updateIngredient(
                                  index,
                                  "preparationNote",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <div className="dynamic-row-footer">
                            <label className="checkbox-field">
                              <input
                                checked={ingredient.isOptional}
                                type="checkbox"
                                onChange={(event) =>
                                  updateIngredient(
                                    index,
                                    "isOptional",
                                    event.target.checked,
                                  )
                                }
                              />

                              <span>Optional</span>
                            </label>

                            {ingredients.length > 1 ? (
                              <button
                                className="text-button danger-text"
                                onClick={() => removeIngredient(index)}
                                type="button"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="recipe-form-section">
                  <div className="recipe-section-heading">
                    <h3>Cooking steps</h3>

                    <button
                      className="secondary-button"
                      onClick={addStep}
                      type="button"
                    >
                      Add step
                    </button>
                  </div>

                  <div className="dynamic-list">
                    {steps.map((step, index) => (
                      <div className="dynamic-row" key={index}>
                        <label className="form-field">
                          <span>Step {index + 1}</span>

                          <textarea
                            required
                            rows={3}
                            value={step.instruction}
                            onChange={(event) =>
                              updateStep(
                                index,
                                "instruction",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <div className="step-row-grid">
                          <label className="form-field">
                            <span>
                              Duration in minutes
                              <HelpTip text="Estimated elapsed time for this individual step." />
                            </span>

                            <input
                              min="0"
                              type="number"
                              value={step.durationMinutes}
                              onChange={(event) =>
                                updateStep(
                                  index,
                                  "durationMinutes",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="form-field">
                            <span>
                              Step type
                              <HelpTip text="Active means you must work continuously. Passive means the food can rest, bake, simmer, soak, or cool with little attention." />
                            </span>

                            <select
                              value={step.stepType}
                              onChange={(event) =>
                                updateStep(
                                  index,
                                  "stepType",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="active">Active</option>

                              <option value="passive">Passive</option>
                            </select>
                          </label>
                        </div>

                        {steps.length > 1 ? (
                          <div className="dynamic-row-footer">
                            <span />

                            <button
                              className="text-button danger-text"
                              onClick={() => removeStep(index)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="recipe-form-section">
                  <div className="recipe-section-heading">
                    <div>
                      <h3>Scheduler tasks</h3>
                      <p className="subtitle">
                        Define every prep, thawing, marinating, cooking, cooling,
                        storage, and cleanup task that should appear in the daily
                        schedule.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={addRecipeTask}
                      type="button"
                    >
                      Add schedule task
                    </button>
                  </div>

                  <div className="dynamic-list">
                    {recipeTasks.map((task, index) => (
                      <div className="dynamic-row" key={index}>
                        <div className="recipe-section-heading">
                          <strong>Task {index + 1}</strong>

                          {recipeTasks.length > 1 ? (
                            <button
                              className="text-button danger-text"
                              onClick={() => removeRecipeTask(index)}
                              type="button"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>

                        <label className="form-field">
                          <span>Task title</span>
                          <input
                            placeholder="Marinate chicken"
                            required
                            value={task.title}
                            onBlur={() => inferRecipeTaskFromText(index)}
                            onChange={(event) =>
                              updateRecipeTask(index, "title", event.target.value)
                            }
                          />
                        </label>

                        <label className="form-field">
                          <span>Instructions</span>
                          <textarea
                            placeholder="Combine the chicken and marinade, cover, and refrigerate."
                            rows={3}
                            value={task.instructions}
                            onBlur={() => inferRecipeTaskFromText(index)}
                            onChange={(event) =>
                              updateRecipeTask(
                                index,
                                "instructions",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <div className="recipe-field-grid">
                          <label className="form-field">
                            <span>Task type</span>
                            <select
                              value={task.taskType}
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "taskType",
                                  event.target.value as RecipeTaskType,
                                )
                              }
                            >
                              {recipeTaskTypes.map((taskType) => (
                                <option key={taskType} value={taskType}>
                                  {recipeTaskTypeLabels[taskType]}
                                </option>
                              ))}
                            </select>
                            <small>{recipeTaskTypeDescriptions[task.taskType]}</small>
                          </label>

                          <label className="form-field">
                            <span>Active minutes</span>
                            <input
                              min="0"
                              required
                              type="number"
                              value={task.activeMinutes}
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "activeMinutes",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="form-field">
                            <span>Passive minutes</span>
                            <input
                              min="0"
                              required
                              type="number"
                              value={task.passiveMinutes}
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "passiveMinutes",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="form-field">
                            <span>Day offset</span>
                            <input
                              max="14"
                              min="-14"
                              required
                              type="number"
                              value={task.dayOffset}
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "dayOffset",
                                  event.target.value,
                                )
                              }
                            />
                            <small>-1 means the previous day; 0 means meal day.</small>
                          </label>

                          <label className="form-field">
                            <span>Start before meal (minutes)</span>
                            <input
                              min="0"
                              required
                              type="number"
                              value={task.startBeforeMealMinutes}
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "startBeforeMealMinutes",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="form-field">
                            <span>Batch key</span>
                            <input
                              disabled={!task.canBatch}
                              placeholder="chop-onions"
                              value={task.batchKey}
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "batchKey",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>

                        <div className="meal-type-options">
                          <label>
                            <input
                              checked={task.unattended}
                              type="checkbox"
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "unattended",
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Can run unattended</span>
                          </label>

                          <label>
                            <input
                              checked={task.blocksActiveWork}
                              type="checkbox"
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "blocksActiveWork",
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Blocks active work time</span>
                          </label>

                          <label>
                            <input
                              checked={task.canBatch}
                              type="checkbox"
                              onChange={(event) =>
                                updateRecipeTask(
                                  index,
                                  "canBatch",
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Can batch with matching tasks</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {message ? (
                  <p className="form-error" role="alert">
                    {message}
                  </p>
                ) : null}
              </div>

              <div className="modal-actions">
                <span />

                <div className="modal-primary-actions">
                  <button
                    className="secondary-button"
                    disabled={isSaving}
                    onClick={closeForm}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-button"
                    disabled={isSaving}
                    type="submit"
                  >
                    {isSaving
                      ? "Saving..."
                      : editingRecipeId
                        ? "Save changes"
                        : "Save recipe"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
