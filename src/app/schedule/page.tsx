"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

import {
  formatTaskType,
  type RecipeTask,
  type ScheduledTask,
  type ScheduledTaskStatus,
} from "@/lib/scheduler-types";

import {
  addDays,
  generateTasksForMeal,
  toLocalDateString,
  type PlannedMealForScheduler,
} from "@/lib/scheduler-utils";

import {
  defaultUserSettings,
  normalizeUserSettings,
  type PreparationMode,
  type UserSettings,
} from "@/lib/user-settings";

type WeeklyPlanRow = {
  id: string;
  week_start: string;
};

type RecipeRow = {
  id: string;
  name: string;
};

type PlannedMealRecipeDatabaseRow = {
  recipe_id: string;
  servings: number;
  position: number;

  recipes:
    | RecipeRow
    | RecipeRow[]
    | null;
};

type PlannedMealDatabaseRow = {
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

  recipes:
    | RecipeRow
    | RecipeRow[]
    | null;

  planned_meal_recipes:
    | PlannedMealRecipeDatabaseRow[]
    | null;
};

type RecipeTaskDatabaseRow = RecipeTask;

type ScheduleConflict = {
  firstTaskId: string;
  secondTaskId: string;
};

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getMonday(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  const day = result.getDay();

  const difference =
    day === 0 ? -6 : 1 - day;

  result.setDate(
    result.getDate() + difference,
  );

  return result;
}

function parseLocalDate(
  dateString: string,
) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
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

function formatScheduleDate(
  dateString: string,
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "long",
      month: "short",
      day: "numeric",
    },
  ).format(
    parseLocalDate(dateString),
  );
}

function normalizeDatabaseTime(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  return value.slice(0, 5);
}

function formatTime(
  value: string | null,
) {
  if (!value) {
    return "Any time";
  }

  const [hours, minutes] = value
    .slice(0, 5)
    .split(":")
    .map(Number);

  const date = new Date();

  date.setHours(
    hours,
    minutes,
    0,
    0,
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function timeToMinutes(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function normalizeSingleRelation<T>(
  relation: T | T[] | null,
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function getDurationText(
  task: ScheduledTask,
) {
  const parts: string[] = [];

  if (task.active_minutes > 0) {
    parts.push(
      `${task.active_minutes} min active`,
    );
  }

  if (task.passive_minutes > 0) {
    parts.push(
      `${task.passive_minutes} min passive`,
    );
  }

  if (parts.length === 0) {
    return "No duration recorded";
  }

  return parts.join(" · ");
}

function statusLabel(
  status: ScheduledTaskStatus,
) {
  switch (status) {
    case "in_progress":
      return "In progress";

    case "completed":
      return "Completed";

    case "skipped":
      return "Skipped";

    default:
      return "Pending";
  }
}

export default function SchedulePage() {
  const [weekStart, setWeekStart] =
    useState(() =>
      getMonday(new Date()),
    );

  const [weeklyPlanId, setWeeklyPlanId] =
    useState<string | null>(null);

  const [tasks, setTasks] = useState<
    ScheduledTask[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    showCompleted,
    setShowCompleted,
  ] = useState(true);

  const [schedulerSettings, setSchedulerSettings] =
    useState<UserSettings>(defaultUserSettings);

  const [selectedScheduleDate, setSelectedScheduleDate] =
    useState<string>("all");

  useEffect(() => {
    setSelectedScheduleDate("all");
    void loadSchedule();
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

  async function loadSchedule() {
    setIsLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        setWeeklyPlanId(null);
        setTasks([]);
        return;
      }

      const weekStartString =
        toLocalDateString(
          weekStart,
        );

      const {
        data: weeklyPlan,
        error: weeklyPlanError,
      } = await supabase
        .from("weekly_plans")
        .select(`
          id,
          week_start
        `)
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
        setWeeklyPlanId(null);
        setTasks([]);
        setMessage(
          "No weekly plan exists for this week.",
        );
        return;
      }

      const plan =
        weeklyPlan as WeeklyPlanRow;

      setWeeklyPlanId(plan.id);

      const {
        data: scheduledTaskData,
        error: scheduledTaskError,
      } = await supabase
        .from("scheduled_tasks")
        .select(`
          id,
          user_id,
          weekly_plan_id,
          planned_meal_id,
          recipe_id,
          recipe_task_id,
          title,
          instructions,
          task_type,
          scheduled_date,
          scheduled_start,
          scheduled_end,
          active_minutes,
          passive_minutes,
          unattended,
          blocks_active_work,
          status,
          is_generated,
          manually_adjusted,
          batch_key,
          source_recipe_name,
          source_meal_type,
          notes,
          position,
          completed_at
        `)
        .eq(
          "weekly_plan_id",
          plan.id,
        )
        .order(
          "scheduled_date",
          {
            ascending: true,
          },
        )
        .order(
          "scheduled_start",
          {
            ascending: true,
            nullsFirst: false,
          },
        )
        .order("position", {
          ascending: true,
        });

      if (scheduledTaskError) {
        throw scheduledTaskError;
      }

      const normalizedTasks = (
        scheduledTaskData ?? []
      ).map((task) => ({
        ...task,

        scheduled_start:
          normalizeDatabaseTime(
            task.scheduled_start,
          ),

        scheduled_end:
          normalizeDatabaseTime(
            task.scheduled_end,
          ),
      })) as ScheduledTask[];

      setTasks(normalizedTasks);
    } catch (error) {
      console.error(
        "Could not load schedule:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load the schedule.",
      );

      setWeeklyPlanId(null);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateSchedule() {
    setIsGenerating(true);
    setMessage("");
    setErrorMessage("");

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        throw new Error(
          "Please log in before generating a schedule.",
        );
      }

      const weekStartString =
        toLocalDateString(
          weekStart,
        );

      const {
        data: weeklyPlan,
        error: weeklyPlanError,
      } = await supabase
        .from("weekly_plans")
        .select(`
          id,
          week_start
        `)
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
          "Create and save a weekly meal plan before generating the schedule.",
        );
      }

      const plan =
        weeklyPlan as WeeklyPlanRow;

      const { data: settingsData, error: settingsError } =
        await supabase
          .from("user_settings")
          .select(`
            conflict_grouping_minutes,
            preferred_batch_day,
            preferred_batch_days,
            preserve_manual_tasks,
            day_settings
          `)
          .eq("user_id", user.id)
          .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      const resolvedSettings = settingsData
        ? normalizeUserSettings(settingsData)
        : defaultUserSettings;

      setSchedulerSettings(resolvedSettings);

      const {
        data: plannedMealData,
        error: plannedMealError,
      } = await supabase
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
          recipes (
            id,
            name
          ),
          planned_meal_recipes (
            recipe_id,
            servings,
            position,
            recipes (
              id,
              name
            )
          )
        `)
        .eq(
          "weekly_plan_id",
          plan.id,
        )
        .order("day_index", {
          ascending: true,
        });

      if (plannedMealError) {
        throw plannedMealError;
      }

      const plannedMealRows =
        (plannedMealData ??
          []) as PlannedMealDatabaseRow[];

      if (
        plannedMealRows.length === 0
      ) {
        throw new Error(
          "This weekly plan has no meals.",
        );
      }

      const mealRecipeSelections =
        plannedMealRows.flatMap((meal) => {
          const joinedSelections =
            meal.planned_meal_recipes ?? [];

          if (joinedSelections.length > 0) {
            return [...joinedSelections]
              .sort(
                (first, second) =>
                  first.position - second.position,
              )
              .map((selection) => ({
                plannedMealId: meal.id,
                dayIndex: meal.day_index,
                mealType: meal.meal_category ?? meal.meal_type,
                mealSlotName: meal.meal_slot_name ?? meal.meal_type,
                mealTime: meal.meal_time?.slice(0, 5) ?? "12:00",
                readyByTime: meal.ready_by_time?.slice(0, 5) ?? "12:00",
                preparationMode: (meal.preparation_mode ?? "fresh") as PreparationMode,
                recipeId: selection.recipe_id,
                servings: Math.max(
                  Number(selection.servings),
                  1,
                ),
                recipe: normalizeSingleRelation(
                  selection.recipes,
                ),
              }));
          }

          if (!meal.recipe_id) {
            return [];
          }

          return [
            {
              plannedMealId: meal.id,
              dayIndex: meal.day_index,
              mealType: meal.meal_category ?? meal.meal_type,
              mealSlotName: meal.meal_slot_name ?? meal.meal_type,
              mealTime: meal.meal_time?.slice(0, 5) ?? "12:00",
              readyByTime: meal.ready_by_time?.slice(0, 5) ?? "12:00",
              preparationMode: (meal.preparation_mode ?? "fresh") as PreparationMode,
              recipeId: meal.recipe_id,
              servings: Math.max(
                Number(meal.servings ?? 1),
                1,
              ),
              recipe: normalizeSingleRelation(
                meal.recipes,
              ),
            },
          ];
        });

      const recipeIds = Array.from(
        new Set(
          mealRecipeSelections.map(
            (selection) => selection.recipeId,
          ),
        ),
      );

      const {
        data: recipeTaskData,
        error: recipeTaskError,
      } = await supabase
        .from("recipe_tasks")
        .select(`
          id,
          user_id,
          recipe_id,
          title,
          instructions,
          task_type,
          active_minutes,
          passive_minutes,
          day_offset,
          start_before_meal_minutes,
          batch_key,
          can_batch,
          unattended,
          blocks_active_work,
          depends_on_task_id,
          position
        `)
        .in(
          "recipe_id",
          recipeIds,
        )
        .order("position", {
          ascending: true,
        });

      if (recipeTaskError) {
        throw recipeTaskError;
      }

      const recipeTasks =
        (recipeTaskData ??
          []) as RecipeTaskDatabaseRow[];

      if (recipeTasks.length === 0) {
        throw new Error(
          "None of the planned recipes have scheduler tasks. Add scheduler tasks in the Recipes page first.",
        );
      }

      const mealsForScheduler: PlannedMealForScheduler[] =
        mealRecipeSelections
          .map((selection) => {
            if (!selection.recipe) {
              return null;
            }

            return {
              id: selection.plannedMealId,
              recipe_id: selection.recipeId,
              day_index: selection.dayIndex,
              meal_type: selection.mealType,
              meal_slot_name: selection.mealSlotName,
              meal_time: selection.mealTime,
              ready_by_time: selection.readyByTime,
              preparation_mode: selection.preparationMode,
              servings: selection.servings,
              recipeName: selection.recipe.name,
            };
          })
          .filter(
            (meal): meal is PlannedMealForScheduler =>
              meal !== null,
          );

      const generatedTasks =
        mealsForScheduler.flatMap(
          (meal) => {
            const matchingTasks =
              recipeTasks.filter(
                (task) =>
                  task.recipe_id ===
                  meal.recipe_id,
              );

            return generateTasksForMeal(
              weekStart,
              meal,
              matchingTasks,
              resolvedSettings,
            );
          },
        );

      if (
        generatedTasks.length === 0
      ) {
        throw new Error(
          "No scheduler tasks could be generated for this week.",
        );
      }

      let preservedTaskData: Array<{
        planned_meal_id: string | null;
        recipe_id: string | null;
        recipe_task_id: string | null;
      }> = [];

      if (resolvedSettings.preserve_manual_tasks) {
        const {
          data,
          error: preservedTaskError,
        } = await supabase
          .from("scheduled_tasks")
          .select(`
            planned_meal_id,
            recipe_id,
            recipe_task_id
          `)
          .eq("weekly_plan_id", plan.id)
          .eq("manually_adjusted", true);

        if (preservedTaskError) {
          throw preservedTaskError;
        }

        preservedTaskData = data ?? [];
      }

      const preservedTaskKeys = new Set(
        preservedTaskData.map((task) =>
          [
            task.planned_meal_id ?? "",
            task.recipe_id ?? "",
            task.recipe_task_id ?? "",
          ].join("::"),
        ),
      );

      /*
        Preserve tasks the user manually adjusted.

        Regeneration deletes only automatically generated
        tasks that were never manually moved or edited.
      */
      const {
        error: deleteGeneratedError,
      } = await supabase
        .from("scheduled_tasks")
        .delete()
        .eq(
          "weekly_plan_id",
          plan.id,
        )
        .eq(
          "is_generated",
          true,
        )
        .eq(
          "manually_adjusted",
          false,
        );

      if (deleteGeneratedError) {
        throw deleteGeneratedError;
      }

      const generatedRows =
        generatedTasks
          .filter((task) => {
            const key = [
              task.plannedMealId,
              task.recipeId,
              task.recipeTaskId,
            ].join("::");

            return !preservedTaskKeys.has(key);
          })
          .map(
            (task) => ({
            user_id: user.id,

            weekly_plan_id:
              plan.id,

            planned_meal_id:
              task.plannedMealId,

            recipe_id:
              task.recipeId,

            recipe_task_id:
              task.recipeTaskId,

            title: task.title,

            instructions:
              task.instructions,

            task_type:
              task.taskType,

            scheduled_date:
              task.scheduledDate,

            scheduled_start:
              task.scheduledStart,

            scheduled_end:
              task.scheduledEnd,

            active_minutes:
              task.activeMinutes,

            passive_minutes:
              task.passiveMinutes,

            unattended:
              task.unattended,

            blocks_active_work:
              task.blocksActiveWork,

            status: "pending",

            is_generated: true,

            manually_adjusted:
              false,

            batch_key:
              task.batchKey,

            source_recipe_name:
              task.sourceRecipeName,

            source_meal_type:
              task.sourceMealType,

            notes: task.unscheduledReason
              ? `Unscheduled: ${task.unscheduledReason}`
              : "",

            position:
              task.position,
          }),
        );

      const {
        error: insertError,
      } = await supabase
        .from("scheduled_tasks")
        .insert(generatedRows);

      if (insertError) {
        throw insertError;
      }

      setWeeklyPlanId(plan.id);

      await loadSchedule();

      setMessage(
        `Generated ${generatedRows.length} schedule tasks.`,
      );
    } catch (error) {
      console.error(
        "Could not generate schedule:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not generate the schedule.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateTaskStatus(
    task: ScheduledTask,
    status: ScheduledTaskStatus,
  ) {
    const completedAt =
      status === "completed"
        ? new Date().toISOString()
        : null;

    const {
      error,
    } = await supabase
      .from("scheduled_tasks")
      .update({
        status,
        completed_at:
          completedAt,
      })
      .eq("id", task.id);

    if (error) {
      setErrorMessage(
        error.message,
      );

      return;
    }

    setTasks((current) =>
      current.map(
        (currentTask) =>
          currentTask.id ===
          task.id
            ? {
                ...currentTask,
                status,
                completed_at:
                  completedAt,
              }
            : currentTask,
      ),
    );
  }

  async function deleteTask(
    task: ScheduledTask,
  ) {
    const shouldDelete =
      window.confirm(
        `Delete "${task.title}" from this schedule?`,
      );

    if (!shouldDelete) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("scheduled_tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      setErrorMessage(
        error.message,
      );

      return;
    }

    setTasks((current) =>
      current.filter(
        (currentTask) =>
          currentTask.id !==
          task.id,
      ),
    );
  }

  async function clearSchedule() {
    if (
      !weeklyPlanId ||
      tasks.length === 0
    ) {
      setMessage(
        "The schedule is already empty.",
      );

      return;
    }

    const shouldClear =
      window.confirm(
        `Delete all ${tasks.length} scheduled tasks for this week?`,
      );

    if (!shouldClear) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("scheduled_tasks")
      .delete()
      .eq(
        "weekly_plan_id",
        weeklyPlanId,
      );

    if (error) {
      setErrorMessage(
        error.message,
      );

      return;
    }

    setTasks([]);

    setMessage(
      "Schedule cleared.",
    );
  }

  const conflicts = useMemo(() => {
    const conflictPairs: ScheduleConflict[] = [];
    const tasksByDate = new Map<string, ScheduledTask[]>();

    for (const task of tasks) {
      if (
        !task.blocks_active_work ||
        task.unattended ||
        task.status === "completed" ||
        task.status === "skipped" ||
        task.active_minutes <= 0
      ) {
        continue;
      }

      const current =
        tasksByDate.get(task.scheduled_date) ?? [];

      current.push(task);
      tasksByDate.set(task.scheduled_date, current);
    }

    /*
      Treat nearby work as one practical kitchen session.
      Tasks beginning within a 60-minute window are not a
      conflict when their combined active work fits within
      that same hour. Passive time is intentionally ignored.
    */
    const sessionWindowMinutes =
      schedulerSettings.conflict_grouping_minutes;

    for (const dateTasks of tasksByDate.values()) {
      const sorted = [...dateTasks].sort(
        (first, second) =>
          (timeToMinutes(first.scheduled_start) ?? 0) -
          (timeToMinutes(second.scheduled_start) ?? 0),
      );

      let session: ScheduledTask[] = [];
      let sessionStart: number | null = null;

      function evaluateSession() {
        if (session.length < 2) {
          return;
        }

        const totalActiveMinutes = session.reduce(
          (total, task) => total + task.active_minutes,
          0,
        );

        if (totalActiveMinutes <= sessionWindowMinutes) {
          return;
        }

        for (let index = 0; index < session.length; index += 1) {
          for (
            let secondIndex = index + 1;
            secondIndex < session.length;
            secondIndex += 1
          ) {
            conflictPairs.push({
              firstTaskId: session[index].id,
              secondTaskId: session[secondIndex].id,
            });
          }
        }
      }

      for (const task of sorted) {
        const start = timeToMinutes(task.scheduled_start);

        if (start === null) {
          continue;
        }

        if (
          sessionStart === null ||
          start - sessionStart <= sessionWindowMinutes
        ) {
          session.push(task);
          sessionStart ??= start;
          continue;
        }

        evaluateSession();
        session = [task];
        sessionStart = start;
      }

      evaluateSession();
    }

    return conflictPairs;
  }, [tasks, schedulerSettings.conflict_grouping_minutes]);

  const conflictingTaskIds =
    useMemo(() => {
      const ids = new Set<string>();

      for (const conflict of conflicts) {
        ids.add(
          conflict.firstTaskId,
        );

        ids.add(
          conflict.secondTaskId,
        );
      }

      return ids;
    }, [conflicts]);

  const filteredTasks =
    useMemo(
      () =>
        showCompleted
          ? tasks
          : tasks.filter(
              (task) =>
                task.status !==
                  "completed" &&
                task.status !==
                  "skipped",
            ),
      [tasks, showCompleted],
    );

  const groupedTasks =
    useMemo(() => {
      const groups =
        new Map<
          string,
          ScheduledTask[]
        >();

      for (const task of filteredTasks) {
        const current =
          groups.get(
            task.scheduled_date,
          ) ?? [];

        current.push(task);

        groups.set(
          task.scheduled_date,
          current,
        );
      }

      return Array.from(
        groups.entries(),
      )
        .sort(
          ([firstDate], [
            secondDate,
          ]) =>
            firstDate.localeCompare(
              secondDate,
            ),
        )
        .map(
          ([date, dateTasks]) => ({
            date,

            tasks: dateTasks.sort(
              (first, second) => {
                const firstTime =
                  first.scheduled_start ??
                  "99:99";

                const secondTime =
                  second.scheduled_start ??
                  "99:99";

                return (
                  firstTime.localeCompare(
                    secondTime,
                  ) ||
                  first.position -
                    second.position
                );
              },
            ),
          }),
        );
    }, [filteredTasks]);

  const visibleGroupedTasks = useMemo(
    () =>
      selectedScheduleDate === "all"
        ? groupedTasks
        : groupedTasks.filter(
            (group) => group.date === selectedScheduleDate,
          ),
    [groupedTasks, selectedScheduleDate],
  );

  const unscheduledCount = tasks.filter(
    (task) => task.scheduled_start === null,
  ).length;

  const pendingCount =
    tasks.filter(
      (task) =>
        task.status ===
          "pending" ||
        task.status ===
          "in_progress",
    ).length;

  const completedCount =
    tasks.filter(
      (task) =>
        task.status ===
        "completed",
    ).length;

  const previousDayTaskCount =
    tasks.filter((task) => {
      const date =
        parseLocalDate(
          task.scheduled_date,
        );

      return date < weekStart;
    }).length;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Preparation planner
          </p>

          <h1>
            Cooking schedule
          </h1>

          <p className="subtitle">
            Generate daily preparation,
            marinating, thawing, cooking,
            cooling, portioning, storage,
            and cleanup tasks from your
            weekly meal plan.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={
            isGenerating
          }
          onClick={
            generateSchedule
          }
          type="button"
        >
          {isGenerating
            ? "Generating…"
            : tasks.length > 0
              ? "Regenerate schedule"
              : "Generate schedule"}
        </button>
      </header>

      <section className="schedule-week-toolbar">
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

        <div className="schedule-week-title">
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

      <section className="schedule-summary-grid">
        <article className="schedule-summary-card">
          <span>
            Remaining tasks
          </span>

          <strong>
            {pendingCount}
          </strong>

          <small>
            Pending or in progress
          </small>
        </article>

        <article className="schedule-summary-card">
          <span>
            Completed
          </span>

          <strong>
            {completedCount}
          </strong>

          <small>
            Finished this week
          </small>
        </article>

        <article className="schedule-summary-card">
          <span>
            Earlier preparation
          </span>

          <strong>
            {
              previousDayTaskCount
            }
          </strong>

          <small>
            Tasks scheduled before Monday
          </small>
        </article>

        <article className="schedule-summary-card">
          <span>
            Active conflicts
          </span>

          <strong>
            {conflicts.length}
          </strong>

          <small>
            {unscheduledCount > 0
              ? `${unscheduledCount} task${unscheduledCount === 1 ? "" : "s"} need manual placement`
              : "Overlapping active tasks"}
          </small>
        </article>
      </section>

      <section className="panel schedule-options-panel">
        <label className="checkbox-field">
          <input
            checked={showCompleted}
            onChange={(event) =>
              setShowCompleted(
                event.target.checked,
              )
            }
            type="checkbox"
          />

          <span>
            Show completed and skipped
            tasks
          </span>
        </label>

        <button
          className="text-button danger-text"
          disabled={
            tasks.length === 0
          }
          onClick={
            clearSchedule
          }
          type="button"
        >
          Clear schedule
        </button>
      </section>

      {groupedTasks.length > 0 ? (
        <section className="schedule-day-view-panel" aria-label="Schedule view">
          <div className="schedule-day-view-heading">
            <div>
              <strong>View tasks by day</strong>
              <span>Show the full week or focus on one day.</span>
            </div>
          </div>

          <div className="schedule-day-tabs" role="tablist" aria-label="Schedule days">
            <button
              aria-selected={selectedScheduleDate === "all"}
              className={
                selectedScheduleDate === "all"
                  ? "schedule-day-tab active"
                  : "schedule-day-tab"
              }
              onClick={() => setSelectedScheduleDate("all")}
              role="tab"
              type="button"
            >
              All days
              <span>{filteredTasks.length}</span>
            </button>

            {groupedTasks.map((group) => (
              <button
                aria-selected={selectedScheduleDate === group.date}
                className={
                  selectedScheduleDate === group.date
                    ? "schedule-day-tab active"
                    : "schedule-day-tab"
                }
                key={group.date}
                onClick={() => setSelectedScheduleDate(group.date)}
                role="tab"
                type="button"
              >
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(parseLocalDate(group.date))}
                <span>{group.tasks.length}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {errorMessage ? (
        <p
          className="form-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {message ? (
        <p className="schedule-message">
          {message}
        </p>
      ) : null}

      {unscheduledCount > 0 ? (
        <section className="schedule-warning schedule-unscheduled-warning">
          <strong>Some tasks could not be scheduled</strong>
          <p>
            {unscheduledCount} active task{unscheduledCount === 1 ? "" : "s"} did not fit inside the availability configured in Settings. They are marked as Unscheduled below.
          </p>
        </section>
      ) : null}

      {conflicts.length > 0 ? (
        <section className="schedule-warning">
          <strong>
            Scheduling conflict
          </strong>

          <p>
            Some active tasks overlap.
            Conflicting tasks are marked
            below. Passive or unattended
            tasks are not treated as
            active-work conflicts.
          </p>
        </section>
      ) : null}

      {isLoading ? (
        <section className="panel empty-state">
          <strong>
            Loading schedule…
          </strong>
        </section>
      ) : visibleGroupedTasks.length ===
        0 ? (
        <section className="panel empty-state">
          <strong>
            No scheduled tasks
          </strong>

          <p>
            Save meals in the Week page,
            add scheduler tasks to the
            relevant recipes, and then
            generate this schedule.
          </p>
        </section>
      ) : (
        <div className="schedule-day-list">
          {visibleGroupedTasks.map(
            (group) => (
              <section
                className="panel schedule-day-panel"
                key={group.date}
              >
                <div className="schedule-day-heading">
                  <div>
                    <p className="eyebrow">
                      Daily tasks
                    </p>

                    <h2>
                      {formatScheduleDate(
                        group.date,
                      )}
                    </h2>
                  </div>

                  <span>
                    {
                      group.tasks
                        .length
                    }{" "}
                    {group.tasks
                      .length === 1
                      ? "task"
                      : "tasks"}
                  </span>
                </div>

                <div className="schedule-task-list">
                  {group.tasks.map(
                    (task) => {
                      const hasConflict =
                        conflictingTaskIds.has(
                          task.id,
                        );

                      return (
                        <article
                          className={[
                            "schedule-task-card",

                            `schedule-task-status-${task.status}`,

                            task.scheduled_start === null
                              ? "schedule-task-unscheduled"
                              : "",

                            hasConflict
                              ? "schedule-task-conflict"
                              : "",
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(" ")}
                          key={
                            task.id
                          }
                        >
                          <div className="schedule-task-time">
                            <strong>
                              {formatTime(
                                task.scheduled_start,
                              )}
                            </strong>

                            {task.scheduled_end ? (
                              <span>
                                to{" "}
                                {formatTime(
                                  task.scheduled_end,
                                )}
                              </span>
                            ) : null}
                          </div>

                          <div className="schedule-task-content">
                            <div className="schedule-task-title-row">
                              <div>
                                <span className="schedule-task-type">
                                  {formatTaskType(
                                    task.task_type,
                                  )}
                                </span>

                                <h3>
                                  {
                                    task.title
                                  }
                                </h3>
                              </div>

                              <span
                                className={`schedule-status-badge schedule-status-${task.status}`}
                              >
                                {statusLabel(
                                  task.status,
                                )}
                              </span>
                            </div>

                            {task.instructions ? (
                              <p className="schedule-task-instructions">
                                {
                                  task.instructions
                                }
                              </p>
                            ) : null}

                            <div className="schedule-task-metadata">
                              <span>
                                {getDurationText(
                                  task,
                                )}
                              </span>

                              {task.unattended ? (
                                <span>
                                  Can run unattended
                                </span>
                              ) : null}

                              {task.scheduled_start === null ? (
                                <span className="schedule-unscheduled-label">
                                  Unscheduled
                                </span>
                              ) : null}

                              {task.manually_adjusted ? (
                                <span>
                                  Manually adjusted
                                </span>
                              ) : null}

                              {hasConflict ? (
                                <span className="schedule-conflict-label">
                                  Active-time conflict
                                </span>
                              ) : null}
                            </div>

                            <p className="schedule-task-source">
                              For{" "}
                              <strong>
                                {
                                  task.source_recipe_name
                                }
                              </strong>

                              {task.source_meal_type
                                ? ` · ${task.source_meal_type}`
                                : ""}
                            </p>

                            {task.notes ? (
                              <p className="schedule-task-notes">
                                {
                                  task.notes
                                }
                              </p>
                            ) : null}

                            <div className="schedule-task-actions">
                              {task.status !==
                              "completed" ? (
                                <button
                                  className="primary-button"
                                  onClick={() =>
                                    updateTaskStatus(
                                      task,
                                      "completed",
                                    )
                                  }
                                  type="button"
                                >
                                  Complete
                                </button>
                              ) : (
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    updateTaskStatus(
                                      task,
                                      "pending",
                                    )
                                  }
                                  type="button"
                                >
                                  Reopen
                                </button>
                              )}

                              {task.status ===
                              "pending" ? (
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    updateTaskStatus(
                                      task,
                                      "in_progress",
                                    )
                                  }
                                  type="button"
                                >
                                  Start
                                </button>
                              ) : null}

                              {task.status !==
                                "skipped" &&
                              task.status !==
                                "completed" ? (
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    updateTaskStatus(
                                      task,
                                      "skipped",
                                    )
                                  }
                                  type="button"
                                >
                                  Skip
                                </button>
                              ) : null}

                              <button
                                className="text-button danger-text"
                                onClick={() =>
                                  deleteTask(
                                    task,
                                  )
                                }
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}