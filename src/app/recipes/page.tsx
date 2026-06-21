"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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

type RecipeIngredientInput = {
  name: string;
  quantity: string;
  unit: string;
  preparationNote: string;
  isOptional: boolean;
};

type RecipeStepInput = {
  instruction: string;
  durationMinutes: string;
  stepType: "active" | "passive";
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
    step_type: "active" | "passive";
    position: number;
  }[];
};

const mealTypeOptions: MealType[] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
];

const emptyIngredient: RecipeIngredientInput = {
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

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editingRecipeId, setEditingRecipeId] = useState<
    string | null
  >(null);

  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [mealTypes, setMealTypes] = useState<MealType[]>([]);

  const [defaultServings, setDefaultServings] = useState("1");
  const [minimumBatchServings, setMinimumBatchServings] =
    useState("1");
  const [maximumBatchServings, setMaximumBatchServings] =
    useState("10");

  const [preparationMinutes, setPreparationMinutes] =
    useState("0");
  const [cookingMinutes, setCookingMinutes] = useState("0");
  const [cleanupMinutes, setCleanupMinutes] = useState("0");

  const [refrigeratorLifeDays, setRefrigeratorLifeDays] =
    useState("3");

  const [freezerAllowed, setFreezerAllowed] = useState(false);
  const [freezerLifeDays, setFreezerLifeDays] =
    useState("30");

  const [ingredients, setIngredients] = useState<
    RecipeIngredientInput[]
  >([{ ...emptyIngredient }]);

  const [steps, setSteps] = useState<RecipeStepInput[]>([
    { ...emptyStep },
  ]);

  useEffect(() => {
    void loadRecipes();
  }, []);

  async function loadRecipes() {
    setIsLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("recipes")
      .select(`
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
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Recipe loading error:", error);
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    const normalizedRecipes = (data ?? []).map((recipe) => ({
      ...recipe,

      recipe_ingredients: [
        ...(recipe.recipe_ingredients ?? []),
      ].sort(
        (first, second) =>
          first.position - second.position,
      ),

      recipe_steps: [...(recipe.recipe_steps ?? [])].sort(
        (first, second) =>
          first.position - second.position,
      ),
    })) as Recipe[];

    setRecipes(normalizedRecipes);
    setIsLoading(false);
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

    setDefaultServings(
      String(recipe.default_servings),
    );

    setMinimumBatchServings(
      String(recipe.minimum_batch_servings),
    );

    setMaximumBatchServings(
      String(recipe.maximum_batch_servings),
    );

    setPreparationMinutes(
      String(recipe.preparation_minutes),
    );

    setCookingMinutes(
      String(recipe.cooking_minutes),
    );

    setCleanupMinutes(
      String(recipe.cleanup_minutes),
    );

    setRefrigeratorLifeDays(
      String(recipe.refrigerator_life_days),
    );

    setFreezerAllowed(recipe.freezer_allowed);

    setFreezerLifeDays(
      String(recipe.freezer_life_days ?? 30),
    );

    setIngredients(
      recipe.recipe_ingredients.length > 0
        ? recipe.recipe_ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: String(ingredient.quantity),
            unit: ingredient.unit,
            preparationNote:
              ingredient.preparation_note,
            isOptional: ingredient.is_optional,
          }))
        : [{ ...emptyIngredient }],
    );

    setSteps(
      recipe.recipe_steps.length > 0
        ? recipe.recipe_steps.map((step) => ({
            instruction: step.instruction,
            durationMinutes: String(
              step.duration_minutes,
            ),
            stepType: step.step_type,
          }))
        : [{ ...emptyStep }],
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
    value: string | boolean,
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

  function addIngredient() {
    setIngredients((current) => [
      ...current,
      { ...emptyIngredient },
    ]);
  }

  function removeIngredient(index: number) {
    setIngredients((current) =>
      current.filter(
        (_, ingredientIndex) =>
          ingredientIndex !== index,
      ),
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
    setSteps((current) => [
      ...current,
      { ...emptyStep },
    ]);
  }

  function removeStep(index: number) {
    setSteps((current) =>
      current.filter(
        (_, stepIndex) => stepIndex !== index,
      ),
    );
  }

  function validateForm() {
    if (!name.trim()) {
      return "Enter a recipe name.";
    }

    if (mealTypes.length === 0) {
      return "Select at least one meal type.";
    }

    if (
      !defaultServings ||
      Number(defaultServings) < 1
    ) {
      return "Default servings must be at least 1.";
    }

    if (
      !minimumBatchServings ||
      Number(minimumBatchServings) < 1
    ) {
      return "Minimum batch servings must be at least 1.";
    }

    if (
      !maximumBatchServings ||
      Number(maximumBatchServings) < 1
    ) {
      return "Maximum batch servings must be at least 1.";
    }

    if (
      Number(maximumBatchServings) <
      Number(minimumBatchServings)
    ) {
      return "Maximum batch servings cannot be smaller than the minimum.";
    }

    if (
      !preparationMinutes ||
      Number(preparationMinutes) < 0
    ) {
      return "Preparation minutes cannot be negative.";
    }

    if (
      !cookingMinutes ||
      Number(cookingMinutes) < 0
    ) {
      return "Cooking minutes cannot be negative.";
    }

    if (
      !cleanupMinutes ||
      Number(cleanupMinutes) < 0
    ) {
      return "Cleanup minutes cannot be negative.";
    }

    if (
      !refrigeratorLifeDays ||
      Number(refrigeratorLifeDays) < 0
    ) {
      return "Refrigerator life cannot be negative.";
    }

    if (
      freezerAllowed &&
      (!freezerLifeDays ||
        Number(freezerLifeDays) < 0)
    ) {
      return "Enter a valid freezer life.";
    }

    const validIngredients = ingredients.filter(
      (ingredient) =>
        ingredient.name.trim() &&
        Number(ingredient.quantity) > 0 &&
        ingredient.unit.trim(),
    );

    if (validIngredients.length === 0) {
      return "Add at least one complete ingredient.";
    }

    const hasIncompleteIngredient =
      ingredients.some((ingredient) => {
        const hasAnyValue =
          ingredient.name.trim() ||
          ingredient.quantity.trim() ||
          ingredient.unit.trim() ||
          ingredient.preparationNote.trim();

        if (!hasAnyValue) {
          return false;
        }

        return (
          !ingredient.name.trim() ||
          Number(ingredient.quantity) <= 0 ||
          !ingredient.unit.trim()
        );
      });

    if (hasIncompleteIngredient) {
      return "Complete or remove each partially filled ingredient.";
    }

    const validSteps = steps.filter((step) =>
      step.instruction.trim(),
    );

    if (validSteps.length === 0) {
      return "Add at least one cooking step.";
    }

    return "";
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You are not signed in.");
      }

      const recipeValues = {
        user_id: user.id,

        name: name.trim(),
        description: description.trim(),
        meal_types: mealTypes,

        default_servings: Number(defaultServings),

        minimum_batch_servings: Number(
          minimumBatchServings,
        ),

        maximum_batch_servings: Number(
          maximumBatchServings,
        ),

        preparation_minutes:
          Number(preparationMinutes),

        cooking_minutes:
          Number(cookingMinutes),

        cleanup_minutes:
          Number(cleanupMinutes),

        refrigerator_life_days:
          Number(refrigeratorLifeDays),

        freezer_allowed: freezerAllowed,

        freezer_life_days: freezerAllowed
          ? Number(freezerLifeDays)
          : null,

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

        const {
          error: deleteIngredientsError,
        } = await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", recipeId);

        if (deleteIngredientsError) {
          throw deleteIngredientsError;
        }

        const { error: deleteStepsError } =
          await supabase
            .from("recipe_steps")
            .delete()
            .eq("recipe_id", recipeId);

        if (deleteStepsError) {
          throw deleteStepsError;
        }
      } else {
        const {
          data: insertedRecipe,
          error: recipeError,
        } = await supabase
          .from("recipes")
          .insert(recipeValues)
          .select("id")
          .single();

        if (recipeError) {
          throw recipeError;
        }

        recipeId = insertedRecipe.id;
      }

      const ingredientRows = ingredients
        .filter(
          (ingredient) =>
            ingredient.name.trim() &&
            Number(ingredient.quantity) > 0 &&
            ingredient.unit.trim(),
        )
        .map((ingredient, index) => ({
          recipe_id: recipeId,
          user_id: user.id,

          name: ingredient.name.trim(),

          quantity: Number(
            ingredient.quantity,
          ),

          unit: ingredient.unit.trim(),

          preparation_note:
            ingredient.preparationNote.trim(),

          is_optional:
            ingredient.isOptional,

          position: index,
        }));

      if (ingredientRows.length > 0) {
        const { error: ingredientError } =
          await supabase
            .from("recipe_ingredients")
            .insert(ingredientRows);

        if (ingredientError) {
          throw ingredientError;
        }
      }

      const stepRows = steps
        .filter((step) =>
          step.instruction.trim(),
        )
        .map((step, index) => ({
          recipe_id: recipeId,
          user_id: user.id,

          instruction:
            step.instruction.trim(),

          duration_minutes:
            Number(step.durationMinutes) || 0,

          step_type: step.stepType,

          position: index,
        }));

      if (stepRows.length > 0) {
        const { error: stepError } =
          await supabase
            .from("recipe_steps")
            .insert(stepRows);

        if (stepError) {
          throw stepError;
        }
      }

      closeForm();
      await loadRecipes();
    } catch (error) {
      console.error(
        "Recipe saving error:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the recipe.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecipe(
    recipeId: string,
  ) {
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
      console.error(
        "Recipe deletion error:",
        error,
      );

      setMessage(error.message);
      return;
    }

    await loadRecipes();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Recipe library
          </p>

          <h1>Recipes</h1>

          <p className="subtitle">
            Add ingredients, cooking steps,
            storage rules, and batch limits for
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

      <section className="recipe-library-grid">
        {isLoading ? (
          <article className="panel">
            <p>Loading recipes...</p>
          </article>
        ) : recipes.length === 0 ? (
          <article className="panel empty-state">
            <strong>No recipes yet</strong>

            <p>
              Add your first recipe to begin
              building your meal library.
            </p>
          </article>
        ) : (
          recipes.map((recipe) => (
            <article
              className="panel recipe-card"
              key={recipe.id}
            >
              <div className="recipe-card-heading">
                <div>
                  <p className="eyebrow">
                    {recipe.meal_types.join(" · ")}
                  </p>

                  <h2>{recipe.name}</h2>
                </div>

                <div className="recipe-card-actions">
                  <button
                    className="text-button"
                    onClick={() =>
                      openEditRecipe(recipe)
                    }
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="text-button danger-text"
                    onClick={() =>
                      deleteRecipe(recipe.id)
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {recipe.description ? (
                <p>{recipe.description}</p>
              ) : null}

              <div className="recipe-metadata">
                <span>
                  {recipe.default_servings} default
                  servings
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
                  {recipe.refrigerator_life_days} days
                  refrigerated
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
                  {recipe.recipe_ingredients.map(
                    (ingredient) => (
                      <li key={ingredient.id}>
                        {ingredient.quantity}{" "}
                        {ingredient.unit}{" "}
                        {ingredient.name}

                        {ingredient.preparation_note
                          ? `, ${ingredient.preparation_note}`
                          : ""}

                        {ingredient.is_optional
                          ? " (optional)"
                          : ""}
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="recipe-card-section">
                <strong>Steps</strong>

                <ol>
                  {recipe.recipe_steps.map(
                    (step) => (
                      <li key={step.id}>
                        {step.instruction}

                        {step.duration_minutes > 0
                          ? ` — ${step.duration_minutes} min`
                          : ""}

                        {` (${step.step_type})`}
                      </li>
                    ),
                  )}
                </ol>
              </div>
            </article>
          ))
        )}
      </section>

      {isFormOpen ? (
        <div
          aria-labelledby="recipe-form-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div className="modal-card recipe-form-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Recipe library
                </p>

                <h2 id="recipe-form-title">
                  {editingRecipeId
                    ? "Edit recipe"
                    : "Add recipe"}
                </h2>
              </div>

              <button
                aria-label="Close recipe editor"
                className="close-button"
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
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                    />
                  </label>

                  <label className="form-field">
                    <span>Description</span>

                    <textarea
                      rows={3}
                      value={description}
                      onChange={(event) =>
                        setDescription(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <fieldset className="meal-type-fieldset">
                    <legend>Meal types</legend>

                    <div className="meal-type-options">
                      {mealTypeOptions.map(
                        (mealType) => (
                          <label key={mealType}>
                            <input
                              checked={mealTypes.includes(
                                mealType,
                              )}
                              type="checkbox"
                              onChange={() =>
                                toggleMealType(
                                  mealType,
                                )
                              }
                            />

                            <span>{mealType}</span>
                          </label>
                        ),
                      )}
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
                          setDefaultServings(
                            event.target.value,
                          )
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
                        value={
                          minimumBatchServings
                        }
                        onChange={(event) =>
                          setMinimumBatchServings(
                            event.target.value,
                          )
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
                        value={
                          maximumBatchServings
                        }
                        onChange={(event) =>
                          setMaximumBatchServings(
                            event.target.value,
                          )
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
                          setPreparationMinutes(
                            event.target.value,
                          )
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Cooking minutes
                        <HelpTip text="The main cooking duration, including both active work and unattended cooking time." />
                      </span>

                      <input
                        min="0"
                        required
                        type="number"
                        value={cookingMinutes}
                        onChange={(event) =>
                          setCookingMinutes(
                            event.target.value,
                          )
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
                          setCleanupMinutes(
                            event.target.value,
                          )
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
                        value={
                          refrigeratorLifeDays
                        }
                        onChange={(event) =>
                          setRefrigeratorLifeDays(
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>

                  <label className="checkbox-field">
                    <input
                      checked={freezerAllowed}
                      type="checkbox"
                      onChange={(event) =>
                        setFreezerAllowed(
                          event.target.checked,
                        )
                      }
                    />

                    <span>
                      This recipe can be frozen
                    </span>
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
                          setFreezerLifeDays(
                            event.target.value,
                          )
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
                    {ingredients.map(
                      (ingredient, index) => (
                        <div
                          className="dynamic-row"
                          key={index}
                        >
                          <div className="ingredient-row-grid">
                            <label className="form-field">
                              <span>Name</span>

                              <input
                                value={
                                  ingredient.name
                                }
                                onChange={(event) =>
                                  updateIngredient(
                                    index,
                                    "name",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>

                            <label className="form-field">
                              <span>
                                Quantity
                                <HelpTip text="The amount required for the recipe's default serving quantity." />
                              </span>

                              <input
                                min="0"
                                step="any"
                                type="number"
                                value={
                                  ingredient.quantity
                                }
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
                                value={
                                  ingredient.unit
                                }
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

                          <label className="form-field">
                            <span>
                              Preparation note
                              <HelpTip text="Describe how the ingredient should be prepared, such as chopped, rinsed, thawed, or divided." />
                            </span>

                            <input
                              placeholder="Finely chopped, rinsed..."
                              value={
                                ingredient.preparationNote
                              }
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
                                checked={
                                  ingredient.isOptional
                                }
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

                            {ingredients.length >
                            1 ? (
                              <button
                                className="text-button danger-text"
                                onClick={() =>
                                  removeIngredient(
                                    index,
                                  )
                                }
                                type="button"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ),
                    )}
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
                      <div
                        className="dynamic-row"
                        key={index}
                      >
                        <label className="form-field">
                          <span>
                            Step {index + 1}
                          </span>

                          <textarea
                            rows={3}
                            value={
                              step.instruction
                            }
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
                              value={
                                step.durationMinutes
                              }
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
                              <option value="active">
                                Active
                              </option>

                              <option value="passive">
                                Passive
                              </option>
                            </select>
                          </label>
                        </div>

                        {steps.length > 1 ? (
                          <div className="dynamic-row-footer">
                            <span />

                            <button
                              className="text-button danger-text"
                              onClick={() =>
                                removeStep(index)
                              }
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

                {message ? (
                  <p
                    className="form-error"
                    role="alert"
                  >
                    {message}
                  </p>
                ) : null}
              </div>

              <div className="modal-actions">
                <span />

                <div className="modal-primary-actions">
                  <button
                    className="secondary-button"
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