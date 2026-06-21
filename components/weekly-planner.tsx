"use client";

import { useEffect, useMemo, useState } from "react";
import {
  recipes,
  type MealType,
  type Recipe,
} from "@/data/recipes";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const mealTypes: MealType[] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
];

const cookingBlockTypes = [
  {
    value: "light",
    label: "Light preparation",
    description: "Assembly, chopping, reheating, or a very quick recipe.",
  },
  {
    value: "normal",
    label: "Normal cooking",
    description: "One or two regular recipes.",
  },
  {
    value: "batch",
    label: "Batch cooking",
    description: "A longer session intended to prepare several meals.",
  },
] as const;

type Day = (typeof days)[number];

type MealSlotKey = `${Day}-${MealType}`;

type PlannedMeal = {
  recipeId: string;
  servings: number;
};

type WeeklyPlan = Partial<Record<MealSlotKey, PlannedMeal>>;

type SelectedSlot = {
  day: Day;
  mealType: MealType;
} | null;

type CookingBlockType =
  (typeof cookingBlockTypes)[number]["value"];

type CookingBlock = {
  id: string;
  day: Day;
  startTime: string;
  endTime: string;
  type: CookingBlockType;
  notes: string;
};

type CookingBlockForm = Omit<CookingBlock, "id">;

const MEAL_STORAGE_KEY = "meal-planner-weekly-plan-v1";
const COOKING_BLOCK_STORAGE_KEY =
  "meal-planner-cooking-blocks-v1";

const emptyCookingBlockForm: CookingBlockForm = {
  day: "Sunday",
  startTime: "16:00",
  endTime: "18:00",
  type: "batch",
  notes: "",
};

function makeSlotKey(
  day: Day,
  mealType: MealType,
): MealSlotKey {
  return `${day}-${mealType}`;
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(time: string) {
  if (!time || !time.includes(":")) {
    return "Time not set";
  }

  const [hoursText, minutesText] = time.split(":");
  const hours = Number(hoursText);

  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
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
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

function formatDuration(totalMinutes: number) {
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
    const firstDayIndex = days.indexOf(first.day);
    const secondDayIndex = days.indexOf(second.day);

    if (firstDayIndex !== secondDayIndex) {
      return firstDayIndex - secondDayIndex;
    }

    return (
      timeToMinutes(first.startTime) -
      timeToMinutes(second.startTime)
    );
  });
}

export default function WeeklyPlanner() {
  const [weeklyPlan, setWeeklyPlan] =
    useState<WeeklyPlan>({});

  const [selectedSlot, setSelectedSlot] =
    useState<SelectedSlot>(null);

  const [selectedRecipeId, setSelectedRecipeId] =
    useState("");

  const [servings, setServings] = useState(1);

  const [cookingBlocks, setCookingBlocks] = useState<
    CookingBlock[]
  >([]);

  const [isCookingBlockModalOpen, setIsCookingBlockModalOpen] =
    useState(false);

  const [editingCookingBlockId, setEditingCookingBlockId] =
    useState<string | null>(null);

  const [cookingBlockForm, setCookingBlockForm] =
    useState<CookingBlockForm>(emptyCookingBlockForm);

  const [cookingBlockError, setCookingBlockError] =
    useState("");

  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedPlan = window.localStorage.getItem(
        MEAL_STORAGE_KEY,
      );

      if (storedPlan) {
        setWeeklyPlan(
          JSON.parse(storedPlan) as WeeklyPlan,
        );
      }

      const storedBlocks = window.localStorage.getItem(
        COOKING_BLOCK_STORAGE_KEY,
      );

      if (storedBlocks) {
        const parsedBlocks = JSON.parse(
          storedBlocks,
        ) as CookingBlock[];

        setCookingBlocks(
          sortCookingBlocks(parsedBlocks),
        );
      }
    } catch (error) {
      console.error(
        "Could not load the weekly planner:",
        error,
      );
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        MEAL_STORAGE_KEY,
        JSON.stringify(weeklyPlan),
      );
    } catch (error) {
      console.error(
        "Could not save the weekly meal plan:",
        error,
      );
    }
  }, [weeklyPlan, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        COOKING_BLOCK_STORAGE_KEY,
        JSON.stringify(cookingBlocks),
      );
    } catch (error) {
      console.error(
        "Could not save cooking blocks:",
        error,
      );
    }
  }, [cookingBlocks, hasLoaded]);

  const compatibleRecipes = useMemo(() => {
    if (!selectedSlot) {
      return [];
    }

    return recipes.filter((recipe) =>
      recipe.mealTypes.includes(
        selectedSlot.mealType,
      ),
    );
  }, [selectedSlot]);

  const selectedRecipe = recipes.find(
    (recipe) => recipe.id === selectedRecipeId,
  );

  const numberOfPlannedMeals =
    Object.keys(weeklyPlan).length;

  const totalCookingMinutes = cookingBlocks.reduce(
    (total, block) =>
      total +
      Math.max(
        0,
        getBlockDuration(
          block.startTime,
          block.endTime,
        ),
      ),
    0,
  );

  function openMealPicker(
    day: Day,
    mealType: MealType,
  ) {
    const slotKey = makeSlotKey(day, mealType);
    const currentMeal = weeklyPlan[slotKey];

    setSelectedSlot({ day, mealType });

    if (currentMeal) {
      setSelectedRecipeId(currentMeal.recipeId);
      setServings(currentMeal.servings);
      return;
    }

    const firstCompatibleRecipe = recipes.find(
      (recipe) =>
        recipe.mealTypes.includes(mealType),
    );

    setSelectedRecipeId(
      firstCompatibleRecipe?.id ?? "",
    );

    setServings(
      firstCompatibleRecipe?.defaultServings ?? 1,
    );
  }

  function closeMealPicker() {
    setSelectedSlot(null);
    setSelectedRecipeId("");
    setServings(1);
  }

  function chooseRecipe(recipe: Recipe) {
    setSelectedRecipeId(recipe.id);
    setServings(recipe.defaultServings);
  }

  function saveMeal() {
    if (
      !selectedSlot ||
      !selectedRecipeId ||
      servings < 1
    ) {
      return;
    }

    const slotKey = makeSlotKey(
      selectedSlot.day,
      selectedSlot.mealType,
    );

    setWeeklyPlan((currentPlan) => ({
      ...currentPlan,
      [slotKey]: {
        recipeId: selectedRecipeId,
        servings,
      },
    }));

    closeMealPicker();
  }

  function removeMeal() {
    if (!selectedSlot) {
      return;
    }

    const slotKey = makeSlotKey(
      selectedSlot.day,
      selectedSlot.mealType,
    );

    setWeeklyPlan((currentPlan) => {
      const updatedPlan = { ...currentPlan };
      delete updatedPlan[slotKey];
      return updatedPlan;
    });

    closeMealPicker();
  }

  function clearWeek() {
    const shouldClear = window.confirm(
      "Remove all meals from this weekly plan?",
    );

    if (shouldClear) {
      setWeeklyPlan({});
    }
  }

  function openNewCookingBlock() {
    setEditingCookingBlockId(null);
    setCookingBlockForm(emptyCookingBlockForm);
    setCookingBlockError("");
    setIsCookingBlockModalOpen(true);
  }

  function openEditCookingBlock(
    block: CookingBlock,
  ) {
    setEditingCookingBlockId(block.id);

    setCookingBlockForm({
      day: block.day,
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
        block.day !== candidate.day
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

    function saveCookingBlock() {
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

    if (hasCookingBlockOverlap(cookingBlockForm)) {
        setCookingBlockError(
        "This cooking block overlaps another block on the same day.",
        );
        return;
    }

    if (editingCookingBlockId) {
        setCookingBlocks((currentBlocks) =>
        sortCookingBlocks(
            currentBlocks.map((block) =>
            block.id === editingCookingBlockId
                ? {
                    id: block.id,
                    ...cookingBlockForm,
                }
                : block,
            ),
        ),
        );
    } else {
        setCookingBlocks((currentBlocks) =>
        sortCookingBlocks([
            ...currentBlocks,
            {
            id: createId(),
            ...cookingBlockForm,
            },
        ]),
        );
    }

    closeCookingBlockModal();
    }

  function deleteCookingBlock(
    blockId: string,
  ) {
    const shouldDelete = window.confirm(
      "Delete this cooking block?",
    );

    if (!shouldDelete) {
      return;
    }

    setCookingBlocks((currentBlocks) =>
      currentBlocks.filter(
        (block) => block.id !== blockId,
      ),
    );
  }

  function getBlockTypeLabel(
    type: CookingBlockType,
  ) {
    return (
      cookingBlockTypes.find(
        (option) => option.value === type,
      )?.label ?? type
    );
  }

  return (
    <>
      <section className="planner-summary">
        <div className="planner-summary-stats">
          <div>
            <span>Meals selected</span>
            <strong>{numberOfPlannedMeals}</strong>
            <small>
              of {days.length * mealTypes.length} slots
            </small>
          </div>

          <div>
            <span>Cooking blocks</span>
            <strong>{cookingBlocks.length}</strong>
            <small>
              {formatDuration(totalCookingMinutes)} available
            </small>
          </div>
        </div>

        <button
          className="text-button danger-text"
          disabled={numberOfPlannedMeals === 0}
          onClick={clearWeek}
          type="button"
        >
          Clear meals
        </button>
      </section>

      <section className="panel week-panel">
        <div className="week-toolbar">
          <div>
            <p className="eyebrow">Current plan</p>
            <h2>This week</h2>
          </div>

          <p className="save-status">
            {hasLoaded
              ? "Changes saved automatically"
              : "Loading plan…"}
          </p>
        </div>

        <div className="week-grid-scroll">
          <div className="week-grid">
            <div className="week-grid-corner">
              Meal
            </div>

            {days.map((day) => (
              <div
                className="week-day-heading"
                key={day}
              >
                {day}
              </div>
            ))}

            {mealTypes.map((mealType) => (
              <div
                className="week-row"
                key={mealType}
              >
                <div className="meal-type-heading">
                  {mealType}
                </div>

                {days.map((day) => {
                  const slotKey = makeSlotKey(
                    day,
                    mealType,
                  );

                  const plannedMeal =
                    weeklyPlan[slotKey];

                  const recipe = plannedMeal
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
                      key={slotKey}
                      onClick={() =>
                        openMealPicker(
                          day,
                          mealType,
                        )
                      }
                      type="button"
                    >
                      {recipe && plannedMeal ? (
                        <>
                          <strong>{recipe.name}</strong>

                          <small>
                            {plannedMeal.servings}{" "}
                            {plannedMeal.servings === 1
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
                          <small>Add meal</small>
                        </>
                      )}
                    </button>
                  );
                })}
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
            onClick={openNewCookingBlock}
            type="button"
          >
            Add cooking block
          </button>
        </div>

        {cookingBlocks.length === 0 ? (
          <div className="empty-state">
            <strong>No cooking blocks yet</strong>

            <p>
              Add the periods during the week when you
              are willing to prepare or cook food.
            </p>

            <button
              className="secondary-button"
              onClick={openNewCookingBlock}
              type="button"
            >
              Add first cooking block
            </button>
          </div>
        ) : (
          <div className="cooking-block-list">
            {cookingBlocks.map((block) => {
              const duration = getBlockDuration(
                block.startTime,
                block.endTime,
              );

              return (
                <article
                  className={`cooking-block-card cooking-block-${block.type}`}
                  key={block.id}
                >
                  <div className="cooking-block-time">
                    <strong>{block.day}</strong>

                    <span>
                      {formatTime(block.startTime)}–
                      {formatTime(block.endTime)}
                    </span>

                    <small>
                      {formatDuration(duration)}
                    </small>
                  </div>

                  <div className="cooking-block-details">
                    <span className="block-type-badge">
                      {getBlockTypeLabel(block.type)}
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
                      onClick={() =>
                        openEditCookingBlock(block)
                      }
                      type="button"
                    >
                      Edit
                    </button>

                    <button
                      className="text-button danger-text"
                      onClick={() =>
                        deleteCookingBlock(block.id)
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
              event.target === event.currentTarget
            ) {
              closeMealPicker();
            }
          }}
        >
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  {selectedSlot.day}
                </p>

                <h2 id="meal-picker-title">
                  Choose{" "}
                  {selectedSlot.mealType.toLowerCase()}
                </h2>
              </div>

              <button
                aria-label="Close meal picker"
                className="close-button"
                onClick={closeMealPicker}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="recipe-picker-list">
              {compatibleRecipes.map((recipe) => {
                const isSelected =
                  recipe.id === selectedRecipeId;

                return (
                  <button
                    className={
                      isSelected
                        ? "recipe-option selected"
                        : "recipe-option"
                    }
                    key={recipe.id}
                    onClick={() =>
                      chooseRecipe(recipe)
                    }
                    type="button"
                  >
                    <div>
                      <strong>{recipe.name}</strong>
                      <p>{recipe.description}</p>
                    </div>

                    <span>
                      {recipe.preparationMinutes +
                        recipe.cookingMinutes}{" "}
                      min
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedRecipe ? (
              <div className="serving-control">
                <div>
                  <strong>Servings</strong>

                  <p>
                    How many servings should this meal
                    require?
                  </p>
                </div>

                <div className="stepper">
                  <button
                    aria-label="Decrease servings"
                    disabled={servings <= 1}
                    onClick={() =>
                      setServings((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                    type="button"
                  >
                    −
                  </button>

                  <strong>{servings}</strong>

                  <button
                    aria-label="Increase servings"
                    onClick={() =>
                      setServings(
                        (current) => current + 1,
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
                  selectedSlot.day,
                  selectedSlot.mealType,
                )
              ] ? (
                <button
                  className="danger-button"
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
                  onClick={closeMealPicker}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  disabled={!selectedRecipeId}
                  onClick={saveMeal}
                  type="button"
                >
                  Save meal
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
              event.target === event.currentTarget
            ) {
              closeCookingBlockModal();
            }
          }}
        >
          <div className="modal-card cooking-block-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  Availability
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
                onClick={closeCookingBlockModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="cooking-block-form">
              <label className="form-field">
                <span>Day</span>

                <select
                  value={cookingBlockForm.day}
                  onChange={(event) =>
                    updateCookingBlockForm(
                      "day",
                      event.target.value as Day,
                    )
                  }
                >
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
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
                    value={cookingBlockForm.endTime}
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
                            {option.description}
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
                  placeholder="For example: stovetop only, meal prep, no oven…"
                  rows={3}
                  value={cookingBlockForm.notes}
                  onChange={(event) =>
                    updateCookingBlockForm(
                      "notes",
                      event.target.value,
                    )
                  }
                />
              </label>

              {cookingBlockError ? (
                <p className="form-error" role="alert">
                  {cookingBlockError}
                </p>
              ) : null}
            </div>

            <div className="modal-actions">
              <span />

              <div className="modal-primary-actions">
                <button
                  className="secondary-button"
                  onClick={
                    closeCookingBlockModal
                  }
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  onClick={saveCookingBlock}
                  type="button"
                >
                  {editingCookingBlockId
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