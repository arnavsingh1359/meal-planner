"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  formatIngredientName,
  inferIngredientCategory,
  ingredientCategories,
  type IngredientCategory,
} from "@/lib/ingredient-utils";

import { supabase } from "@/lib/supabase/client";

type TrackingMode = "exact" | "approximate";

type StockStatus =
  | "out"
  | "low"
  | "enough"
  | "plenty";

type Ingredient = {
  id: string;
  name: string;
  category: string;
  default_unit: string;
  approximate_allowed: boolean;
};

type PantryItem = {
  id: string;
  ingredient_id: string;
  tracking_mode: TrackingMode;
  quantity: number | null;
  unit: string | null;
  stock_status: StockStatus;
  expiry_date: string | null;
  notes: string;
  ingredients: Ingredient;
};

const categories = ingredientCategories;

const units = [
  "",
  "g",
  "kg",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "cup",
  "piece",
  "whole",
  "packet",
  "can",
  "bottle",
  "box",
] as const;

const stockStatusOptions: {
  value: StockStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "out",
    label: "Out",
    description: "None available.",
  },
  {
    value: "low",
    label: "Low",
    description:
      "Likely needs to be purchased soon.",
  },
  {
    value: "enough",
    label: "Enough",
    description:
      "Enough for normal planned use.",
  },
  {
    value: "plenty",
    label: "Plenty",
    description:
      "More than enough is available.",
  },
];

const dangerButtonStyle = {
  border: "1px solid var(--danger)",
  background: "transparent",
  color: "var(--danger)",
};

const destructivePanelStyle = {
  marginTop: "18px",
};

const destructiveActionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "10px",
  marginTop: "16px",
};

function formatQuantity(
  quantity: number | null,
  unit: string | null,
) {
  if (quantity === null) {
    return "Quantity not tracked";
  }

  return `${quantity} ${unit ?? ""}`.trim();
}

function formatExpiryDate(
  expiryDate: string | null,
) {
  if (!expiryDate) {
    return "No expiry date";
  }

  const [year, month, day] = expiryDate
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
  );

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function PantryPage() {
  const [pantryItems, setPantryItems] = useState<
    PantryItem[]
  >([]);

  const [
    catalogueIngredients,
    setCatalogueIngredients,
  ] = useState<Ingredient[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isClearing, setIsClearing] =
    useState(false);

  const [message, setMessage] = useState("");

  const [searchText, setSearchText] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StockStatus | "all">("all");

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [editingItemId, setEditingItemId] =
    useState<string | null>(null);

  const [ingredientName, setIngredientName] =
    useState("");

  const [category, setCategory] =
    useState<IngredientCategory>("Other");

  const [trackingMode, setTrackingMode] =
    useState<TrackingMode>("approximate");

  const [quantity, setQuantity] =
    useState("");

  const [unit, setUnit] = useState("");

  const [stockStatus, setStockStatus] =
    useState<StockStatus>("enough");

  const [expiryDate, setExpiryDate] =
    useState("");

  const [notes, setNotes] = useState("");

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
      await Promise.all([
        loadPantry(),
        loadIngredientCatalogue(),
      ]);
    } catch (error) {
      console.error(
        "Could not load pantry data:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load pantry data.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadIngredientCatalogue() {
    const user = await getCurrentUser();

    if (!user) {
      setCatalogueIngredients([]);
      return;
    }

    const { data, error } = await supabase
      .from("ingredients")
      .select(`
        id,
        name,
        category,
        default_unit,
        approximate_allowed
      `)
      .eq("user_id", user.id)
      .order("name", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setCatalogueIngredients(
      (data ?? []) as Ingredient[],
    );
  }

  async function loadPantry() {
    const user = await getCurrentUser();

    if (!user) {
      setPantryItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("pantry_items")
      .select(`
        id,
        ingredient_id,
        tracking_mode,
        quantity,
        unit,
        stock_status,
        expiry_date,
        notes,
        ingredients (
          id,
          name,
          category,
          default_unit,
          approximate_allowed
        )
      `)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    const normalizedItems = (data ?? [])
      .map((item) => ({
        ...item,

        ingredients: Array.isArray(
          item.ingredients,
        )
          ? item.ingredients[0]
          : item.ingredients,
      }))
      .filter(
        (item) =>
          item.ingredients !== null &&
          item.ingredients !== undefined,
      )
      .sort((first, second) =>
        first.ingredients.name.localeCompare(
          second.ingredients.name,
        ),
      ) as PantryItem[];

    setPantryItems(normalizedItems);
  }

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchText
      .trim()
      .toLowerCase();

    return pantryItems.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.ingredients.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        item.ingredients.category
          .toLowerCase()
          .includes(normalizedSearch) ||
        item.notes
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        item.stock_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    pantryItems,
    searchText,
    statusFilter,
  ]);

  const pantryIngredientIds = useMemo(
    () =>
      new Set(
        pantryItems.map(
          (item) => item.ingredient_id,
        ),
      ),
    [pantryItems],
  );

  const catalogueOnlyIngredients = useMemo(
    () =>
      catalogueIngredients.filter(
        (ingredient) =>
          !pantryIngredientIds.has(
            ingredient.id,
          ),
      ),
    [
      catalogueIngredients,
      pantryIngredientIds,
    ],
  );

  const lowStockCount = pantryItems.filter(
    (item) =>
      item.stock_status === "low" ||
      item.stock_status === "out",
  ).length;

  function resetForm() {
    setEditingItemId(null);

    setIngredientName("");
    setCategory("Other");

    setTrackingMode("approximate");
    setQuantity("");
    setUnit("");

    setStockStatus("enough");
    setExpiryDate("");
    setNotes("");

    setMessage("");
  }

  function openNewItem() {
    resetForm();
    setIsModalOpen(true);
  }

  function openEditItem(item: PantryItem) {
    setEditingItemId(item.id);

    setIngredientName(
      item.ingredients.name,
    );

    setCategory(
      categories.includes(
        item.ingredients
          .category as IngredientCategory,
      )
        ? (item.ingredients
            .category as IngredientCategory)
        : "Other",
    );

    setTrackingMode(item.tracking_mode);

    setQuantity(
      item.quantity === null
        ? ""
        : String(item.quantity),
    );

    setUnit(
      item.unit ??
        item.ingredients.default_unit,
    );

    setStockStatus(item.stock_status);
    setExpiryDate(item.expiry_date ?? "");
    setNotes(item.notes);

    setMessage("");
    setIsModalOpen(true);
  }

  function openCatalogueItem(
    ingredient: Ingredient,
  ) {
    resetForm();

    setIngredientName(ingredient.name);

    setCategory(
      categories.includes(
        ingredient.category as IngredientCategory,
      )
        ? (ingredient.category as IngredientCategory)
        : "Other",
    );

    setUnit(ingredient.default_unit);

    setIsModalOpen(true);
  }

  function closeModal() {
    resetForm();
    setIsModalOpen(false);
  }

  function handleIngredientNameBlur() {
    const formattedName =
      formatIngredientName(
        ingredientName,
      );

    setIngredientName(formattedName);

    if (
      !editingItemId ||
      category === "Other"
    ) {
      setCategory(
        inferIngredientCategory(
          formattedName,
        ),
      );
    }
  }

  function validateForm() {
    if (!ingredientName.trim()) {
      return "Enter an ingredient name.";
    }

    if (trackingMode === "exact") {
      if (
        quantity.trim() === "" ||
        Number(quantity) < 0 ||
        !Number.isFinite(
          Number(quantity),
        )
      ) {
        return "Enter a valid quantity.";
      }

      if (!unit.trim()) {
        return "Select or enter a unit.";
      }
    }

    return "";
  }

  async function findOrCreateIngredient(
    userId: string,
  ) {
    const normalizedName =
      formatIngredientName(
        ingredientName,
      );

    const inferredCategory =
      category === "Other"
        ? inferIngredientCategory(
            normalizedName,
          )
        : category;

    const {
      data: existingIngredients,
      error: existingIngredientError,
    } = await supabase
      .from("ingredients")
      .select(`
        id,
        name,
        category,
        default_unit,
        approximate_allowed
      `)
      .eq("user_id", userId)
      .ilike("name", normalizedName)
      .limit(1);

    if (existingIngredientError) {
      throw existingIngredientError;
    }

    const existingIngredient =
      existingIngredients?.[0] as
        | Ingredient
        | undefined;

    if (existingIngredient) {
      const { data, error } =
        await supabase
          .from("ingredients")
          .update({
            name: normalizedName,

            category:
              inferredCategory,

            default_unit:
              trackingMode === "exact"
                ? unit.trim()
                : existingIngredient.default_unit,

            approximate_allowed: true,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existingIngredient.id,
          )
          .select(`
            id,
            name,
            category,
            default_unit,
            approximate_allowed
          `)
          .single();

      if (error) {
        throw error;
      }

      return data as Ingredient;
    }

    const { data, error } =
      await supabase
        .from("ingredients")
        .insert({
          user_id: userId,

          name: normalizedName,

          category:
            inferredCategory,

          default_unit:
            trackingMode === "exact"
              ? unit.trim()
              : "",

          approximate_allowed: true,
        })
        .select(`
          id,
          name,
          category,
          default_unit,
          approximate_allowed
        `)
        .single();

    if (error) {
      throw error;
    }

    return data as Ingredient;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in before editing the pantry.",
        );
      }

      let ingredient: Ingredient;

      if (editingItemId) {
        const existingItem =
          pantryItems.find(
            (item) =>
              item.id ===
              editingItemId,
          );

        if (!existingItem) {
          throw new Error(
            "The pantry item could not be found.",
          );
        }

        const formattedName =
          formatIngredientName(
            ingredientName,
          );

        const inferredCategory =
          category === "Other"
            ? inferIngredientCategory(
                formattedName,
              )
            : category;

        const { data, error } =
          await supabase
            .from("ingredients")
            .update({
              name: formattedName,

              category:
                inferredCategory,

              default_unit:
                trackingMode === "exact"
                  ? unit.trim()
                  : existingItem
                      .ingredients
                      .default_unit,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              existingItem.ingredient_id,
            )
            .select(`
              id,
              name,
              category,
              default_unit,
              approximate_allowed
            `)
            .single();

        if (error) {
          throw error;
        }

        ingredient =
          data as Ingredient;
      } else {
        ingredient =
          await findOrCreateIngredient(
            user.id,
          );
      }

      const pantryValues = {
        user_id: user.id,

        ingredient_id:
          ingredient.id,

        tracking_mode:
          trackingMode,

        quantity:
          trackingMode === "exact"
            ? Number(quantity)
            : null,

        unit:
          trackingMode === "exact"
            ? unit.trim()
            : null,

        stock_status:
          stockStatus,

        expiry_date:
          expiryDate || null,

        notes: notes.trim(),

        updated_at:
          new Date().toISOString(),
      };

      if (editingItemId) {
        const { error } =
          await supabase
            .from("pantry_items")
            .update(pantryValues)
            .eq(
              "id",
              editingItemId,
            );

        if (error) {
          throw error;
        }
      } else {
        const { error } =
          await supabase
            .from("pantry_items")
            .insert(
              pantryValues,
            );

        if (error) {
          if (
            error.code === "23505"
          ) {
            throw new Error(
              "This ingredient is already in your pantry.",
            );
          }

          throw error;
        }
      }

      closeModal();

      await Promise.all([
        loadPantry(),
        loadIngredientCatalogue(),
      ]);
    } catch (error) {
      console.error(
        "Could not save pantry item:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the pantry item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePantryItem(
    item: PantryItem,
  ) {
    const shouldDelete =
      window.confirm(
        `Remove ${item.ingredients.name} from your pantry?`,
      );

    if (!shouldDelete) {
      return;
    }

    setMessage("");

    try {
      const { error } =
        await supabase
          .from("pantry_items")
          .delete()
          .eq("id", item.id);

      if (error) {
        throw error;
      }

      await Promise.all([
        loadPantry(),
        loadIngredientCatalogue(),
      ]);
    } catch (error) {
      console.error(
        "Could not delete pantry item:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete the pantry item.",
      );
    }
  }

  async function updateStockStatus(
    item: PantryItem,
    newStatus: StockStatus,
  ) {
    const { error } =
      await supabase
        .from("pantry_items")
        .update({
          stock_status: newStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", item.id);

    if (error) {
      console.error(
        "Could not update stock status:",
        error,
      );

      setMessage(error.message);
      return;
    }

    setPantryItems((current) =>
      current.map((pantryItem) =>
        pantryItem.id === item.id
          ? {
              ...pantryItem,

              stock_status:
                newStatus,
            }
          : pantryItem,
      ),
    );
  }

  async function clearPantry() {
    if (pantryItems.length === 0) {
      setMessage(
        "The pantry is already empty.",
      );
      return;
    }

    const shouldClear = window.confirm(
      `Clear all ${pantryItems.length} pantry items?\n\nThis removes your stock records but keeps the ingredient catalogue and recipes.`,
    );

    if (!shouldClear) {
      return;
    }

    setIsClearing(true);
    setMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in before clearing the pantry.",
        );
      }

      const { error } = await supabase
        .from("pantry_items")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      await Promise.all([
        loadPantry(),
        loadIngredientCatalogue(),
      ]);

      setMessage(
        "Pantry cleared. The ingredient catalogue was kept.",
      );
    } catch (error) {
      console.error(
        "Could not clear pantry:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not clear the pantry.",
      );
    } finally {
      setIsClearing(false);
    }
  }

  async function clearCatalogue() {
    if (
      catalogueIngredients.length === 0
    ) {
      setMessage(
        "The ingredient catalogue is already empty.",
      );
      return;
    }

    const firstConfirmation =
      window.confirm(
        `Delete all ${catalogueIngredients.length} catalogue ingredients?\n\nThis will also clear your pantry. Recipe names, quantities, and units will remain, but their catalogue links will be removed.`,
      );

    if (!firstConfirmation) {
      return;
    }

    const secondConfirmation =
      window.confirm(
        "This is a destructive action. Are you absolutely sure you want to clear the entire ingredient catalogue?",
      );

    if (!secondConfirmation) {
      return;
    }

    setIsClearing(true);
    setMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in before clearing the catalogue.",
        );
      }

      const {
        error: pantryDeleteError,
      } = await supabase
        .from("pantry_items")
        .delete()
        .eq("user_id", user.id);

      if (pantryDeleteError) {
        throw pantryDeleteError;
      }

      const {
        error: recipeIngredientError,
      } = await supabase
        .from("recipe_ingredients")
        .update({
          ingredient_id: null,
        })
        .eq("user_id", user.id);

      if (recipeIngredientError) {
        throw recipeIngredientError;
      }

      const {
        error: ingredientDeleteError,
      } = await supabase
        .from("ingredients")
        .delete()
        .eq("user_id", user.id);

      if (ingredientDeleteError) {
        throw ingredientDeleteError;
      }

      await Promise.all([
        loadPantry(),
        loadIngredientCatalogue(),
      ]);

      setMessage(
        "Ingredient catalogue and pantry cleared.",
      );
    } catch (error) {
      console.error(
        "Could not clear catalogue:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not clear the ingredient catalogue.",
      );
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Inventory
          </p>

          <h1>Pantry</h1>

          <p className="subtitle">
            Track pantry stock and manage
            the ingredient catalogue shared
            with your recipes.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openNewItem}
          type="button"
        >
          Add pantry item
        </button>
      </header>

      <section className="pantry-summary-grid">
        <article className="pantry-summary-card">
          <span>Total items</span>

          <strong>
            {pantryItems.length}
          </strong>

          <small>
            Ingredients currently tracked
          </small>
        </article>

        <article className="pantry-summary-card">
          <span>Low or out</span>

          <strong>
            {lowStockCount}
          </strong>

          <small>
            May need to be purchased
          </small>
        </article>

        <article className="pantry-summary-card">
          <span>Catalogue only</span>

          <strong>
            {
              catalogueOnlyIngredients.length
            }
          </strong>

          <small>
            Used in recipes but not in pantry
          </small>
        </article>
      </section>

      <section className="panel pantry-panel">
        <div className="pantry-toolbar">
          <label className="pantry-search-field">
            <span>Search pantry</span>

            <input
              placeholder="Search by ingredient, category, or note"
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="pantry-filter-field">
            <span>Stock status</span>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as
                    | StockStatus
                    | "all",
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              {stockStatusOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        {message &&
        !isModalOpen ? (
          <p
            className="form-error"
            role="alert"
          >
            {message}
          </p>
        ) : null}

        {isLoading ? (
          <div className="empty-state">
            <strong>
              Loading pantry…
            </strong>
          </div>
        ) : filteredItems.length ===
          0 ? (
          <div className="empty-state">
            <strong>
              {pantryItems.length ===
              0
                ? "Your pantry is empty"
                : "No pantry items match"}
            </strong>

            <p>
              {pantryItems.length ===
              0
                ? "Add your first ingredient to begin tracking your inventory."
                : "Try changing the search text or stock filter."}
            </p>

            {pantryItems.length ===
            0 ? (
              <button
                className="secondary-button"
                onClick={openNewItem}
                type="button"
              >
                Add first pantry item
              </button>
            ) : null}
          </div>
        ) : (
          <div className="pantry-item-grid">
            {filteredItems.map(
              (item) => (
                <article
                  className={`pantry-item-card pantry-status-${item.stock_status}`}
                  key={item.id}
                >
                  <div className="pantry-item-heading">
                    <div>
                      <span className="pantry-category">
                        {
                          item
                            .ingredients
                            .category
                        }
                      </span>

                      <h2>
                        {
                          item
                            .ingredients
                            .name
                        }
                      </h2>
                    </div>

                    <div className="pantry-card-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          openEditItem(
                            item,
                          )
                        }
                        type="button"
                      >
                        Edit
                      </button>

                      <button
                        className="text-button danger-text"
                        onClick={() =>
                          deletePantryItem(
                            item,
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="pantry-item-details">
                    <div>
                      <span>
                        Tracking
                      </span>

                      <strong>
                        {item.tracking_mode ===
                        "exact"
                          ? formatQuantity(
                              item.quantity,
                              item.unit,
                            )
                          : "Approximate"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Expiry
                      </span>

                      <strong>
                        {formatExpiryDate(
                          item.expiry_date,
                        )}
                      </strong>
                    </div>
                  </div>

                  <label className="pantry-status-select">
                    <span>
                      Stock level
                    </span>

                    <select
                      value={
                        item.stock_status
                      }
                      onChange={(event) =>
                        updateStockStatus(
                          item,

                          event.target
                            .value as StockStatus,
                        )
                      }
                    >
                      {stockStatusOptions.map(
                        (option) => (
                          <option
                            key={
                              option.value
                            }
                            value={
                              option.value
                            }
                          >
                            {
                              option.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  {item.notes ? (
                    <p className="pantry-notes">
                      {item.notes}
                    </p>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <section className="panel ingredient-catalogue-panel">
        <div className="ingredient-catalogue-heading">
          <div>
            <p className="eyebrow">
              Shared ingredient catalogue
            </p>

            <h2>
              Ingredients not currently
              in pantry
            </h2>

            <p>
              These ingredients are used
              by recipes but are not
              currently tracked as pantry
              stock.
            </p>
          </div>

          <strong>
            {
              catalogueOnlyIngredients.length
            }
          </strong>
        </div>

        {catalogueOnlyIngredients.length ===
        0 ? (
          <div className="empty-state">
            <strong>
              Every catalogue ingredient
              is in your pantry
            </strong>
          </div>
        ) : (
          <div className="ingredient-catalogue-grid">
            {catalogueOnlyIngredients.map(
              (ingredient) => (
                <article
                  className="ingredient-catalogue-card"
                  key={ingredient.id}
                >
                  <span>
                    {ingredient.category}
                  </span>

                  <strong>
                    {ingredient.name}
                  </strong>

                  <small>
                    {ingredient.default_unit
                      ? `Default unit: ${ingredient.default_unit}`
                      : "No default unit"}
                  </small>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      openCatalogueItem(
                        ingredient,
                      )
                    }
                  >
                    Add to pantry
                  </button>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <section
        className="panel"
        style={destructivePanelStyle}
      >
        <p className="eyebrow">
          Data management
        </p>

        <h2>Clear pantry data</h2>

        <p className="subtitle">
          Clear pantry stock independently,
          or remove the entire ingredient
          catalogue and rebuild it from your
          recipes.
        </p>

        <div style={destructiveActionsStyle}>
          <button
            className="secondary-button"
            disabled={
              isClearing ||
              pantryItems.length === 0
            }
            onClick={clearPantry}
            style={dangerButtonStyle}
            type="button"
          >
            {isClearing
              ? "Working…"
              : "Clear pantry"}
          </button>

          <button
            className="secondary-button"
            disabled={
              isClearing ||
              catalogueIngredients.length === 0
            }
            onClick={clearCatalogue}
            style={dangerButtonStyle}
            type="button"
          >
            {isClearing
              ? "Working…"
              : "Clear catalogue"}
          </button>
        </div>
      </section>

      {isModalOpen ? (
        <div
          aria-labelledby="pantry-form-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !isSaving
            ) {
              closeModal();
            }
          }}
        >
          <div className="modal-card pantry-form-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Pantry
                </p>

                <h2 id="pantry-form-title">
                  {editingItemId
                    ? "Edit pantry item"
                    : "Add pantry item"}
                </h2>
              </div>

              <button
                aria-label="Close pantry editor"
                className="close-button"
                disabled={isSaving}
                onClick={closeModal}
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="pantry-form-content">
                <label className="form-field">
                  <span>
                    Ingredient name
                  </span>

                  <input
                    autoFocus
                    placeholder="For example: Basmati rice"
                    required
                    value={ingredientName}
                    onChange={(event) =>
                      setIngredientName(
                        event.target.value,
                      )
                    }
                    onBlur={
                      handleIngredientNameBlur
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Category
                  </span>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target
                          .value as IngredientCategory,
                      )
                    }
                  >
                    {categories.map(
                      (
                        categoryOption,
                      ) => (
                        <option
                          key={
                            categoryOption
                          }
                          value={
                            categoryOption
                          }
                        >
                          {
                            categoryOption
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <fieldset className="pantry-tracking-fieldset">
                  <legend>
                    Tracking method
                  </legend>

                  <div className="pantry-tracking-options">
                    <label
                      className={
                        trackingMode ===
                        "approximate"
                          ? "pantry-tracking-option selected"
                          : "pantry-tracking-option"
                      }
                    >
                      <input
                        checked={
                          trackingMode ===
                          "approximate"
                        }
                        name="tracking-mode"
                        type="radio"
                        value="approximate"
                        onChange={() => {
                          setTrackingMode(
                            "approximate",
                          );

                          setQuantity("");

                          setUnit("");
                        }}
                      />

                      <span>
                        <strong>
                          Approximate
                        </strong>

                        <small>
                          Track this item as
                          Out, Low, Enough,
                          or Plenty.
                        </small>
                      </span>
                    </label>

                    <label
                      className={
                        trackingMode ===
                        "exact"
                          ? "pantry-tracking-option selected"
                          : "pantry-tracking-option"
                      }
                    >
                      <input
                        checked={
                          trackingMode ===
                          "exact"
                        }
                        name="tracking-mode"
                        type="radio"
                        value="exact"
                        onChange={() =>
                          setTrackingMode(
                            "exact",
                          )
                        }
                      />

                      <span>
                        <strong>
                          Exact quantity
                        </strong>

                        <small>
                          Store a measured
                          quantity and unit.
                        </small>
                      </span>
                    </label>
                  </div>
                </fieldset>

                {trackingMode ===
                "exact" ? (
                  <div className="pantry-quantity-grid">
                    <label className="form-field">
                      <span>
                        Quantity
                      </span>

                      <input
                        min="0"
                        required
                        step="any"
                        type="number"
                        value={quantity}
                        onChange={(event) =>
                          setQuantity(
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Unit
                      </span>

                      <input
                        list="pantry-unit-options"
                        placeholder="g, ml, whole..."
                        required
                        value={unit}
                        onChange={(event) =>
                          setUnit(
                            event.target
                              .value,
                          )
                        }
                      />

                      <datalist id="pantry-unit-options">
                        {units
                          .filter(Boolean)
                          .map(
                            (
                              unitOption,
                            ) => (
                              <option
                                key={
                                  unitOption
                                }
                                value={
                                  unitOption
                                }
                              />
                            ),
                          )}
                      </datalist>
                    </label>
                  </div>
                ) : null}

                <fieldset className="pantry-status-fieldset">
                  <legend>
                    Current stock level
                  </legend>

                  <div className="pantry-status-options">
                    {stockStatusOptions.map(
                      (option) => (
                        <label
                          className={
                            stockStatus ===
                            option.value
                              ? `pantry-status-option pantry-status-option-${option.value} selected`
                              : `pantry-status-option pantry-status-option-${option.value}`
                          }
                          key={
                            option.value
                          }
                        >
                          <input
                            checked={
                              stockStatus ===
                              option.value
                            }
                            name="stock-status"
                            type="radio"
                            value={
                              option.value
                            }
                            onChange={() =>
                              setStockStatus(
                                option.value,
                              )
                            }
                          />

                          <span>
                            <strong>
                              {
                                option.label
                              }
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
                  <span>
                    Expiry date
                  </span>

                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(event) =>
                      setExpiryDate(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Notes
                  </span>

                  <textarea
                    placeholder="For example: opened packet, top shelf, buy preferred brand..."
                    rows={3}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value,
                      )
                    }
                  />
                </label>

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
                    disabled={isSaving}
                    onClick={closeModal}
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
                      ? "Saving…"
                      : editingItemId
                        ? "Save changes"
                        : "Add item"}
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