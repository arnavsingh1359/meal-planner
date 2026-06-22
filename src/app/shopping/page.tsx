"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  areUnitsCompatible,
  formatMeasurement,
  normalizeMeasurement,
  type MeasurementSystem,
} from "@/lib/unit-utils";

import {
  formatIngredientName,
  inferIngredientCategory,
} from "@/lib/ingredient-utils";

import { supabase } from "@/lib/supabase/client";

type ShoppingItem = {
  id: string;
  shopping_list_id: string;
  ingredient_id: string | null;

  name: string;
  category: string;

  required_quantity: number | null;
  pantry_quantity: number | null;
  quantity_to_buy: number | null;

  unit: string;

  is_manual: boolean;
  is_purchased: boolean;

  source_recipes: string[];
  notes: string;
};

type IngredientRow = {
  id: string;
  name: string;
  category: string;
};

type RecipeIngredientRow = {
  ingredient_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  is_optional: boolean;

  ingredients:
    | IngredientRow
    | IngredientRow[]
    | null;
};

type RecipeRow = {
  id: string;
  name: string;
  default_servings: number;

  recipe_ingredients:
    | RecipeIngredientRow[]
    | null;
};

type PlannedMealRecipeRow = {
  recipe_id: string;
  servings: number;
  position: number;

  recipes:
    | RecipeRow
    | RecipeRow[]
    | null;
};

type PlannedMealRow = {
  id: string;
  recipe_id: string | null;
  servings: number | null;

  recipes:
    | RecipeRow
    | RecipeRow[]
    | null;

  planned_meal_recipes:
    | PlannedMealRecipeRow[]
    | null;
};

type PantryIngredientRow = {
  id: string;
  name: string;
  category: string;
};

type PantryItemRow = {
  ingredient_id: string;
  tracking_mode:
    | "exact"
    | "approximate";

  quantity: number | null;
  unit: string | null;

  stock_status:
    | "out"
    | "low"
    | "enough"
    | "plenty";

  ingredients:
    | PantryIngredientRow
    | PantryIngredientRow[]
    | null;
};

type GeneratedItem = {
  ingredientId: string | null;
  name: string;
  category: string;

  requiredQuantity: number;
  pantryQuantity: number;
  quantityToBuy: number;

  unit: string;
  sourceRecipes: string[];
};

type AggregateEntry = {
  ingredientId: string | null;
  name: string;
  category: string;

  requiredQuantity: number;
  unit: string;

  sourceRecipes: Set<string>;
};

const categoryOrder = [
  "Produce",
  "Dairy",
  "Meat",
  "Seafood",
  "Grains",
  "Pasta",
  "Legumes",
  "Spices",
  "Condiments",
  "Baking",
  "Frozen",
  "Snacks",
  "Beverages",
  "Other",
];

const manualUnitOptions = [
  "",
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "cup",
  "fl oz",
  "pint",
  "quart",
  "gallon",
  "whole",
  "piece",
  "clove",
  "can",
  "packet",
  "bottle",
  "box",
  "dozen",
];

function getMonday(date: Date) {
  const copy = new Date(date);

  copy.setHours(0, 0, 0, 0);

  const day = copy.getDay();
  const difference =
    day === 0 ? -6 : 1 - day;

  copy.setDate(
    copy.getDate() + difference,
  );

  return copy;
}

function addDays(
  date: Date,
  amount: number,
) {
  const copy = new Date(date);

  copy.setDate(copy.getDate() + amount);

  return copy;
}

function toDateString(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWeekRange(
  weekStart: Date,
) {
  const weekEnd = addDays(
    weekStart,
    6,
  );

  const startText =
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(weekStart);

  const endText =
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(weekEnd);

  return `${startText} – ${endText}`;
}

function normalizeNestedSingle<T>(
  value: T | T[] | null,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getAggregateKey(
  ingredientId: string | null,
  name: string,
  unit: string,
) {
  return [
    ingredientId ??
      formatIngredientName(name)
        .toLowerCase(),

    unit,
  ].join("::");
}

export default function ShoppingPage() {
  const [weekStart, setWeekStart] =
    useState(() =>
      getMonday(new Date()),
    );

  const [
    measurementSystem,
    setMeasurementSystem,
  ] = useState<MeasurementSystem>(
    "metric",
  );

  const [shoppingListId, setShoppingListId] =
    useState<string | null>(null);

  const [items, setItems] = useState<
    ShoppingItem[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [isSavingManual, setIsSavingManual] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [manualName, setManualName] =
    useState("");

  const [manualQuantity, setManualQuantity] =
    useState("");

  const [manualUnit, setManualUnit] =
    useState("");

  const [manualNotes, setManualNotes] =
    useState("");

  useEffect(() => {
    const savedSystem =
      window.localStorage.getItem(
        "shopping-measurement-system",
      );

    if (
      savedSystem === "metric" ||
      savedSystem === "imperial"
    ) {
      setMeasurementSystem(
        savedSystem,
      );
    }
  }, []);

  useEffect(() => {
    void loadShoppingList();
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

  function changeMeasurementSystem(
    system: MeasurementSystem,
  ) {
    setMeasurementSystem(system);

    window.localStorage.setItem(
      "shopping-measurement-system",
      system,
    );
  }

  async function loadShoppingList() {
    setIsLoading(true);
    setMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        setShoppingListId(null);
        setItems([]);
        return;
      }

      const weekStartString =
        toDateString(weekStart);

      const {
        data: listData,
        error: listError,
      } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("user_id", user.id)
        .eq(
          "week_start",
          weekStartString,
        )
        .maybeSingle();

      if (listError) {
        throw listError;
      }

      if (!listData) {
        setShoppingListId(null);
        setItems([]);
        return;
      }

      setShoppingListId(listData.id);

      const {
        data: itemData,
        error: itemError,
      } = await supabase
        .from("shopping_items")
        .select(`
          id,
          shopping_list_id,
          ingredient_id,
          name,
          category,
          required_quantity,
          pantry_quantity,
          quantity_to_buy,
          unit,
          is_manual,
          is_purchased,
          source_recipes,
          notes
        `)
        .eq(
          "shopping_list_id",
          listData.id,
        )
        .order("category", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        });

      if (itemError) {
        throw itemError;
      }

      setItems(
        (itemData ?? []) as ShoppingItem[],
      );
    } catch (error) {
      console.error(
        "Could not load shopping list:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the shopping list.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function ensureShoppingList(
    userId: string,
  ) {
    const weekStartString =
      toDateString(weekStart);

    const {
      data: existingList,
      error: existingError,
    } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("user_id", userId)
      .eq(
        "week_start",
        weekStartString,
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingList) {
      return existingList.id as string;
    }

    const {
      data: insertedList,
      error: insertError,
    } = await supabase
      .from("shopping_lists")
      .insert({
        user_id: userId,
        week_start:
          weekStartString,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return insertedList.id as string;
  }

  async function generateShoppingList() {
    setIsGenerating(true);
    setMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in before generating a shopping list.",
        );
      }

      const weekStartString =
        toDateString(weekStart);

      const {
        data: weeklyPlan,
        error: weeklyPlanError,
      } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq(
          "week_start",
          weekStartString,
        )
        .maybeSingle();

      if (weeklyPlanError) {
        throw weeklyPlanError;
      }

      if (!weeklyPlan) {
        throw new Error(
          "No weekly meal plan exists for this week.",
        );
      }

      const [
        plannedMealsResult,
        pantryResult,
      ] = await Promise.all([
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
                ingredients (
                  id,
                  name,
                  category
                )
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
                  ingredients (
                    id,
                    name,
                    category
                  )
                )
              )
            )
          `)
          .eq(
            "weekly_plan_id",
            weeklyPlan.id,
          ),

        supabase
          .from("pantry_items")
          .select(`
            ingredient_id,
            tracking_mode,
            quantity,
            unit,
            stock_status,
            ingredients (
              id,
              name,
              category
            )
          `)
          .eq("user_id", user.id),
      ]);

      if (plannedMealsResult.error) {
        throw plannedMealsResult.error;
      }

      if (pantryResult.error) {
        throw pantryResult.error;
      }

      const plannedMeals =
        (plannedMealsResult.data ??
          []) as PlannedMealRow[];

      if (plannedMeals.length === 0) {
        throw new Error(
          "This week has no planned meals.",
        );
      }

      const pantryItems =
        (pantryResult.data ??
          []) as PantryItemRow[];

      const aggregates =
        new Map<string, AggregateEntry>();

      for (const meal of plannedMeals) {
        const joinedSelections =
          meal.planned_meal_recipes ?? [];

        const selections: PlannedMealRecipeRow[] =
          joinedSelections.length > 0
            ? [...joinedSelections].sort(
                (first, second) =>
                  first.position - second.position,
              )
            : meal.recipe_id
              ? [
                  {
                    recipe_id: meal.recipe_id,
                    servings: Math.max(
                      Number(meal.servings ?? 1),
                      1,
                    ),
                    position: 0,
                    recipes: meal.recipes,
                  },
                ]
              : [];

        for (const selection of selections) {
          const recipe = normalizeNestedSingle(
            selection.recipes,
          );

          if (!recipe) {
            continue;
          }

          const servingScale =
            Math.max(Number(selection.servings), 1) /
            Math.max(Number(recipe.default_servings), 1);

          for (
            const recipeIngredient of
            recipe.recipe_ingredients ?? []
          ) {
            if (recipeIngredient.is_optional) {
              continue;
            }

            const catalogueIngredient =
              normalizeNestedSingle(
                recipeIngredient.ingredients,
              );

            const ingredientId =
              recipeIngredient.ingredient_id ??
              catalogueIngredient?.id ??
              null;

            const ingredientName =
              catalogueIngredient?.name ??
              formatIngredientName(
                recipeIngredient.name,
              );

            const category =
              catalogueIngredient?.category ??
              inferIngredientCategory(ingredientName);

            const scaledQuantity =
              Number(recipeIngredient.quantity) *
              servingScale;

            const normalized = normalizeMeasurement(
              scaledQuantity,
              recipeIngredient.unit,
            );

            const key = getAggregateKey(
              ingredientId,
              ingredientName,
              normalized.unit,
            );

            const existing = aggregates.get(key);

            if (existing) {
              existing.requiredQuantity +=
                normalized.quantity;
              existing.sourceRecipes.add(recipe.name);
            } else {
              aggregates.set(key, {
                ingredientId,
                name: ingredientName,
                category,
                requiredQuantity: normalized.quantity,
                unit: normalized.unit,
                sourceRecipes: new Set([recipe.name]),
              });
            }
          }
        }
      }

      const generatedItems: GeneratedItem[] =
        [];

      for (const aggregate of aggregates.values()) {
        const matchingPantry =
          pantryItems.find(
            (pantryItem) =>
              pantryItem.ingredient_id ===
              aggregate.ingredientId,
          );

        let pantryQuantity = 0;
        let quantityToBuy =
          aggregate.requiredQuantity;

        if (matchingPantry) {
          if (
            matchingPantry.tracking_mode ===
            "approximate"
          ) {
            if (
              matchingPantry.stock_status ===
                "enough" ||
              matchingPantry.stock_status ===
                "plenty"
            ) {
              pantryQuantity =
                aggregate.requiredQuantity;

              quantityToBuy = 0;
            }
          } else if (
            matchingPantry.quantity !==
              null &&
            matchingPantry.unit &&
            areUnitsCompatible(
              matchingPantry.unit,
              aggregate.unit,
            )
          ) {
            const normalizedPantry =
              normalizeMeasurement(
                Number(
                  matchingPantry.quantity,
                ),
                matchingPantry.unit,
              );

            pantryQuantity =
              normalizedPantry.quantity;

            quantityToBuy = Math.max(
              aggregate.requiredQuantity -
                pantryQuantity,
              0,
            );
          }
        }

        generatedItems.push({
          ingredientId:
            aggregate.ingredientId,

          name: aggregate.name,
          category:
            aggregate.category,

          requiredQuantity:
            aggregate.requiredQuantity,

          pantryQuantity,

          quantityToBuy,

          unit: aggregate.unit,

          sourceRecipes: Array.from(
            aggregate.sourceRecipes,
          ).sort(),
        });
      }

      const listId =
        await ensureShoppingList(
          user.id,
        );

      const {
        data: previousGeneratedItems,
        error:
          previousGeneratedItemsError,
      } = await supabase
        .from("shopping_items")
        .select(`
          ingredient_id,
          name,
          unit,
          is_purchased
        `)
        .eq(
          "shopping_list_id",
          listId,
        )
        .eq("is_manual", false);

      if (
        previousGeneratedItemsError
      ) {
        throw previousGeneratedItemsError;
      }

      const purchasedState =
        new Map<string, boolean>();

      for (
        const previousItem of
        previousGeneratedItems ?? []
      ) {
        const key = getAggregateKey(
          previousItem.ingredient_id,
          previousItem.name,
          previousItem.unit,
        );

        purchasedState.set(
          key,
          previousItem.is_purchased,
        );
      }

      const {
        error: deleteError,
      } = await supabase
        .from("shopping_items")
        .delete()
        .eq(
          "shopping_list_id",
          listId,
        )
        .eq("is_manual", false);

      if (deleteError) {
        throw deleteError;
      }

      if (
        generatedItems.length > 0
      ) {
        const rows =
          generatedItems.map(
            (item) => {
              const key =
                getAggregateKey(
                  item.ingredientId,
                  item.name,
                  item.unit,
                );

              return {
                shopping_list_id:
                  listId,

                user_id: user.id,

                ingredient_id:
                  item.ingredientId,

                name: item.name,
                category:
                  item.category,

                required_quantity:
                  item.requiredQuantity,

                pantry_quantity:
                  item.pantryQuantity,

                quantity_to_buy:
                  item.quantityToBuy,

                unit: item.unit,

                is_manual: false,

                is_purchased:
                  purchasedState.get(
                    key,
                  ) ?? false,

                source_recipes:
                  item.sourceRecipes,

                notes: "",
              };
            },
          );

        const {
          error: insertError,
        } = await supabase
          .from("shopping_items")
          .insert(rows);

        if (insertError) {
          throw insertError;
        }
      }

      const {
        error: listUpdateError,
      } = await supabase
        .from("shopping_lists")
        .update({
          generated_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", listId);

      if (listUpdateError) {
        throw listUpdateError;
      }

      setShoppingListId(listId);

      await loadShoppingList();

      setMessage(
        "Shopping list generated from the weekly meal plan.",
      );
    } catch (error) {
      console.error(
        "Could not generate shopping list:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not generate the shopping list.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function addManualItem(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formattedName =
      formatIngredientName(
        manualName,
      );

    if (!formattedName) {
      setMessage(
        "Enter an item name.",
      );
      return;
    }

    if (
      manualQuantity &&
      (!Number.isFinite(
        Number(manualQuantity),
      ) ||
        Number(manualQuantity) < 0)
    ) {
      setMessage(
        "Enter a valid quantity.",
      );
      return;
    }

    setIsSavingManual(true);
    setMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in before adding shopping items.",
        );
      }

      const listId =
        shoppingListId ??
        (await ensureShoppingList(
          user.id,
        ));

      let normalizedQuantity:
        | number
        | null = null;

      let normalizedUnit =
        manualUnit.trim();

      if (
        manualQuantity &&
        manualUnit.trim()
      ) {
        const normalized =
          normalizeMeasurement(
            Number(manualQuantity),
            manualUnit,
          );

        normalizedQuantity =
          normalized.quantity;

        normalizedUnit =
          normalized.unit;
      } else if (manualQuantity) {
        normalizedQuantity =
          Number(manualQuantity);
      }

      const { error } = await supabase
        .from("shopping_items")
        .insert({
          shopping_list_id:
            listId,

          user_id: user.id,

          ingredient_id: null,

          name: formattedName,

          category:
            inferIngredientCategory(
              formattedName,
            ),

          required_quantity:
            normalizedQuantity,

          pantry_quantity: 0,

          quantity_to_buy:
            normalizedQuantity,

          unit: normalizedUnit,

          is_manual: true,
          is_purchased: false,

          source_recipes: [],

          notes:
            manualNotes.trim(),
        });

      if (error) {
        throw error;
      }

      setManualName("");
      setManualQuantity("");
      setManualUnit("");
      setManualNotes("");

      setShoppingListId(listId);

      await loadShoppingList();
    } catch (error) {
      console.error(
        "Could not add manual item:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add the manual item.",
      );
    } finally {
      setIsSavingManual(false);
    }
  }

  async function togglePurchased(
    item: ShoppingItem,
  ) {
    const newValue =
      !item.is_purchased;

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              is_purchased:
                newValue,
            }
          : currentItem,
      ),
    );

    const { error } = await supabase
      .from("shopping_items")
      .update({
        is_purchased: newValue,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      setItems((current) =>
        current.map(
          (currentItem) =>
            currentItem.id ===
            item.id
              ? {
                  ...currentItem,

                  is_purchased:
                    item.is_purchased,
                }
              : currentItem,
        ),
      );

      setMessage(error.message);
    }
  }

  async function deleteItem(
    item: ShoppingItem,
  ) {
    const shouldDelete =
      window.confirm(
        `Remove ${item.name} from this shopping list?`,
      );

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((current) =>
      current.filter(
        (currentItem) =>
          currentItem.id !== item.id,
      ),
    );
  }

  async function clearPurchasedItems() {
    if (!shoppingListId) {
      return;
    }

    const purchasedCount =
      items.filter(
        (item) =>
          item.is_purchased,
      ).length;

    if (purchasedCount === 0) {
      setMessage(
        "There are no purchased items to clear.",
      );
      return;
    }

    const shouldClear =
      window.confirm(
        `Remove ${purchasedCount} purchased items from this shopping list?`,
      );

    if (!shouldClear) {
      return;
    }

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq(
        "shopping_list_id",
        shoppingListId,
      )
      .eq("is_purchased", true);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadShoppingList();
  }

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.is_manual ||
          item.quantity_to_buy ===
            null ||
          Number(
            item.quantity_to_buy,
          ) > 0,
      ),
    [items],
  );

  const groupedItems = useMemo(() => {
    const groups =
      new Map<
        string,
        ShoppingItem[]
      >();

    for (const item of visibleItems) {
      const category =
        item.category || "Other";

      const current =
        groups.get(category) ?? [];

      current.push(item);

      groups.set(
        category,
        current,
      );
    }

    return Array.from(groups.entries())
      .sort(
        ([firstCategory], [
          secondCategory,
        ]) => {
          const firstIndex =
            categoryOrder.indexOf(
              firstCategory,
            );

          const secondIndex =
            categoryOrder.indexOf(
              secondCategory,
            );

          const safeFirst =
            firstIndex === -1
              ? categoryOrder.length
              : firstIndex;

          const safeSecond =
            secondIndex === -1
              ? categoryOrder.length
              : secondIndex;

          return (
            safeFirst - safeSecond
          );
        },
      )
      .map(
        ([category, categoryItems]) => ({
          category,

          items: categoryItems.sort(
            (first, second) =>
              first.name.localeCompare(
                second.name,
              ),
          ),
        }),
      );
  }, [visibleItems]);

  const purchasedCount =
    visibleItems.filter(
      (item) =>
        item.is_purchased,
    ).length;

  const remainingCount =
    visibleItems.length -
    purchasedCount;

  const coveredByPantryCount =
    items.filter(
      (item) =>
        !item.is_manual &&
        Number(
          item.quantity_to_buy,
        ) === 0,
    ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Weekly shopping
          </p>

          <h1>Shopping list</h1>

          <p className="subtitle">
            Generate a pantry-aware list
            from your weekly meal plan and
            display quantities in metric or
            imperial units.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={isGenerating}
          onClick={
            generateShoppingList
          }
          type="button"
        >
          {isGenerating
            ? "Generating…"
            : "Generate from week"}
        </button>
      </header>

      <section className="shopping-week-toolbar">
        <button
          className="secondary-button"
          onClick={() =>
            setWeekStart(
              addDays(
                weekStart,
                -7,
              ),
            )
          }
          type="button"
        >
          ← Previous
        </button>

        <div className="shopping-week-title">
          <span>
            Selected week
          </span>

          <strong>
            {formatWeekRange(
              weekStart,
            )}
          </strong>
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            setWeekStart(
              getMonday(
                new Date(),
              ),
            )
          }
          type="button"
        >
          Current week
        </button>

        <button
          className="secondary-button"
          onClick={() =>
            setWeekStart(
              addDays(
                weekStart,
                7,
              ),
            )
          }
          type="button"
        >
          Next →
        </button>
      </section>

      <section className="shopping-summary-grid">
        <article className="shopping-summary-card">
          <span>
            Remaining
          </span>

          <strong>
            {remainingCount}
          </strong>

          <small>
            Items still to purchase
          </small>
        </article>

        <article className="shopping-summary-card">
          <span>
            Purchased
          </span>

          <strong>
            {purchasedCount}
          </strong>

          <small>
            Completed shopping items
          </small>
        </article>

        <article className="shopping-summary-card">
          <span>
            Covered by pantry
          </span>

          <strong>
            {coveredByPantryCount}
          </strong>

          <small>
            Hidden from the buy list
          </small>
        </article>
      </section>

      <section className="panel shopping-settings-panel">
        <div>
          <p className="eyebrow">
            Unit display
          </p>

          <h2>
            Measurement system
          </h2>

          <p>
            Stored quantities use neutral
            base units. You can switch the
            display at any time.
          </p>
        </div>

        <div className="measurement-toggle">
          <button
            className={
              measurementSystem ===
              "metric"
                ? "measurement-toggle-button active"
                : "measurement-toggle-button"
            }
            onClick={() =>
              changeMeasurementSystem(
                "metric",
              )
            }
            type="button"
          >
            Metric
          </button>

          <button
            className={
              measurementSystem ===
              "imperial"
                ? "measurement-toggle-button active"
                : "measurement-toggle-button"
            }
            onClick={() =>
              changeMeasurementSystem(
                "imperial",
              )
            }
            type="button"
          >
            Imperial
          </button>
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

      <section className="shopping-layout">
        <div className="shopping-list-column">
          {isLoading ? (
            <article className="panel empty-state">
              <strong>
                Loading shopping list…
              </strong>
            </article>
          ) : groupedItems.length ===
            0 ? (
            <article className="panel empty-state">
              <strong>
                No shopping items yet
              </strong>

              <p>
                Generate the list from
                your weekly plan or add a
                manual item.
              </p>
            </article>
          ) : (
            groupedItems.map(
              (group) => (
                <section
                  className="panel shopping-category-panel"
                  key={
                    group.category
                  }
                >
                  <div className="shopping-category-heading">
                    <h2>
                      {group.category}
                    </h2>

                    <span>
                      {
                        group.items
                          .length
                      }
                    </span>
                  </div>

                  <div className="shopping-item-list">
                    {group.items.map(
                      (item) => (
                        <article
                          className={
                            item.is_purchased
                              ? "shopping-item purchased"
                              : "shopping-item"
                          }
                          key={
                            item.id
                          }
                        >
                          <label className="shopping-item-check">
                            <input
                              checked={
                                item.is_purchased
                              }
                              onChange={() =>
                                togglePurchased(
                                  item,
                                )
                              }
                              type="checkbox"
                            />

                            <span />
                          </label>

                          <div className="shopping-item-main">
                            <div className="shopping-item-title">
                              <strong>
                                {
                                  item.name
                                }
                              </strong>

                              {item.is_manual ? (
                                <span className="shopping-manual-badge">
                                  Manual
                                </span>
                              ) : null}
                            </div>

                            <div className="shopping-item-quantity">
                              {formatMeasurement(
                                item.quantity_to_buy,
                                item.unit,
                                measurementSystem,
                              )}
                            </div>

                            {!item.is_manual ? (
                              <div className="shopping-item-breakdown">
                                <span>
                                  Required:{" "}
                                  {formatMeasurement(
                                    item.required_quantity,
                                    item.unit,
                                    measurementSystem,
                                  )}
                                </span>

                                <span>
                                  Pantry:{" "}
                                  {formatMeasurement(
                                    item.pantry_quantity,
                                    item.unit,
                                    measurementSystem,
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {item.source_recipes
                              .length >
                            0 ? (
                              <p className="shopping-source-recipes">
                                For:{" "}
                                {item.source_recipes.join(
                                  ", ",
                                )}
                              </p>
                            ) : null}

                            {item.notes ? (
                              <p className="shopping-item-notes">
                                {
                                  item.notes
                                }
                              </p>
                            ) : null}
                          </div>

                          <button
                            aria-label={`Remove ${item.name}`}
                            className="text-button danger-text"
                            onClick={() =>
                              deleteItem(
                                item,
                              )
                            }
                            type="button"
                          >
                            Remove
                          </button>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              ),
            )
          )}

          {purchasedCount > 0 ? (
            <button
              className="secondary-button"
              onClick={
                clearPurchasedItems
              }
              type="button"
            >
              Clear purchased items
            </button>
          ) : null}
        </div>

        <aside className="panel shopping-manual-panel">
          <p className="eyebrow">
            Manual item
          </p>

          <h2>
            Add something else
          </h2>

          <form
            onSubmit={addManualItem}
          >
            <label className="form-field">
              <span>Item name</span>

              <input
                placeholder="Paper towels"
                required
                value={manualName}
                onChange={(event) =>
                  setManualName(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="shopping-manual-quantity-grid">
              <label className="form-field">
                <span>Quantity</span>

                <input
                  min="0"
                  step="any"
                  type="number"
                  value={
                    manualQuantity
                  }
                  onChange={(event) =>
                    setManualQuantity(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="form-field">
                <span>Unit</span>

                <input
                  list="shopping-unit-options"
                  placeholder="piece"
                  value={manualUnit}
                  onChange={(event) =>
                    setManualUnit(
                      event.target
                        .value,
                    )
                  }
                />

                <datalist id="shopping-unit-options">
                  {manualUnitOptions.map(
                    (option) => (
                      <option
                        key={option}
                        value={option}
                      />
                    ),
                  )}
                </datalist>
              </label>
            </div>

            <label className="form-field">
              <span>Notes</span>

              <textarea
                placeholder="Brand, size, store..."
                rows={3}
                value={manualNotes}
                onChange={(event) =>
                  setManualNotes(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <button
              className="primary-button"
              disabled={
                isSavingManual
              }
              type="submit"
            >
              {isSavingManual
                ? "Adding…"
                : "Add item"}
            </button>
          </form>
        </aside>
      </section>
    </>
  );
}