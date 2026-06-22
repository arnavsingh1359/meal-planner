import type { RecipeTask, RecipeTaskType } from "@/lib/scheduler-types";
import {
  dayKeyFromIndex,
  resolveDaySettings,
  type PreparationMode,
  type UserSettings,
} from "@/lib/user-settings";

export type PlannedMealForScheduler = {
  id: string;
  recipe_id: string;
  day_index: number;
  meal_type: string;
  meal_slot_name: string;
  meal_time: string;
  ready_by_time: string;
  preparation_mode: PreparationMode;
  servings: number;
  recipeName: string;
};

export type GeneratedScheduleTask = {
  plannedMealId: string;
  recipeId: string;
  recipeTaskId: string;
  title: string;
  instructions: string;
  taskType: RecipeTaskType;
  scheduledDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  unscheduledReason: string | null;
  activeMinutes: number;
  passiveMinutes: number;
  unattended: boolean;
  blocksActiveWork: boolean;
  batchKey: string;
  sourceRecipeName: string;
  sourceMealType: string;
  position: number;
};

type AvailabilityWindow = {
  start: Date;
  end: Date;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result;
}

export function formatTimeForDatabase(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function minutesBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

function maxDate(first: Date, second: Date) {
  return first > second ? first : second;
}

function minDate(first: Date, second: Date) {
  return first < second ? first : second;
}

function getDayIndexForDate(weekStart: Date, date: Date) {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function getAvailabilityWindows(
  weekStart: Date,
  date: Date,
  settings: UserSettings,
): AvailabilityWindow[] {
  const index = ((getDayIndexForDate(weekStart, date) % 7) + 7) % 7;
  const day = resolveDaySettings(settings, dayKeyFromIndex(index));

  if (!day.cooking_allowed) {
    return [];
  }

  const earliest = combineDateAndTime(date, day.earliest_task_time);
  const latest = combineDateAndTime(date, day.latest_task_time);
  const windows: AvailabilityWindow[] = [];

  if (day.leave_home_time) {
    const leave = combineDateAndTime(date, day.leave_home_time);
    if (leave > earliest) {
      windows.push({ start: earliest, end: minDate(leave, latest) });
    }
  }

  if (day.return_home_time) {
    const returned = combineDateAndTime(date, day.return_home_time);
    const eveningStart = combineDateAndTime(date, day.evening_prep_start);
    const eveningEnd = combineDateAndTime(date, day.evening_prep_end);
    const start = maxDate(returned, eveningStart);
    const end = minDate(eveningEnd, latest);

    if (end > start) {
      windows.push({ start, end });
    }
  }

  if (!day.leave_home_time && !day.return_home_time) {
    windows.push({ start: earliest, end: latest });
  } else if (!day.return_home_time) {
    const eveningStart = combineDateAndTime(date, day.evening_prep_start);
    const eveningEnd = minDate(
      combineDateAndTime(date, day.evening_prep_end),
      latest,
    );

    if (eveningEnd > eveningStart) {
      windows.push({ start: eveningStart, end: eveningEnd });
    }
  }

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function chooseLatestAvailableStart(
  weekStart: Date,
  idealStart: Date,
  latestFinish: Date,
  requiredActiveMinutes: number,
  settings: UserSettings,
  searchBackDays = 4,
) {
  const duration = Math.max(requiredActiveMinutes, 1);

  for (let offset = 0; offset <= searchBackDays; offset += 1) {
    const date = addDays(idealStart, -offset);
    const windows = getAvailabilityWindows(weekStart, date, settings);

    for (const window of [...windows].reverse()) {
      const allowedEnd = minDate(window.end, latestFinish);
      const latestStart = new Date(allowedEnd.getTime() - duration * 60_000);
      const candidate = minDate(idealStart, latestStart);

      if (candidate >= window.start && minutesBetween(candidate, allowedEnd) >= duration) {
        return candidate;
      }

      if (latestStart >= window.start) {
        return latestStart;
      }
    }
  }

  return null;
}

function shouldPreferPreviousEvening(
  meal: PlannedMealForScheduler,
  task: RecipeTask,
) {
  if (
    !["packed", "previous_evening", "batch_cooked"].includes(
      meal.preparation_mode,
    )
  ) {
    return false;
  }

  return [
    "preparation",
    "cooking",
    "cooling",
    "portioning",
    "storage",
    "marinating",
    "soaking",
    "thawing",
  ].includes(task.task_type);
}

function getTaskElapsedMinutes(task: RecipeTask) {
  return Math.max(task.active_minutes + task.passive_minutes, 1);
}

function sortGeneratedTasks(
  first: GeneratedScheduleTask,
  second: GeneratedScheduleTask,
) {
  return (
    `${first.scheduledDate}T${first.scheduledStart}`.localeCompare(
      `${second.scheduledDate}T${second.scheduledStart}`,
    ) || first.position - second.position
  );
}

/*
  Schedule one selected recipe within a configured meal slot.
  Multi-recipe meals invoke this once per recipe while sharing
  the same planned meal identifier and deadline.
*/
export function generateTasksForMeal(
  weekStart: Date,
  meal: PlannedMealForScheduler,
  recipeTasks: RecipeTask[],
  settings: UserSettings,
): GeneratedScheduleTask[] {
  const mealDate = addDays(weekStart, meal.day_index);
  const eatAt = combineDateAndTime(mealDate, meal.meal_time);
  const readyBy = combineDateAndTime(mealDate, meal.ready_by_time);
  const deadline =
    meal.preparation_mode === "fresh" ? eatAt : minDate(eatAt, readyBy);

  return [...recipeTasks]
    .sort((a, b) => a.position - b.position)
    .map((task) => {
      const offsetDeadline = addDays(deadline, task.day_offset);
      let idealStart = new Date(
        offsetDeadline.getTime() - task.start_before_meal_minutes * 60_000,
      );

      if (
        shouldPreferPreviousEvening(meal, task) &&
        idealStart.toDateString() === mealDate.toDateString() &&
        !["serving", "cleanup"].includes(task.task_type)
      ) {
        const previousDay = addDays(mealDate, -1);
        const previousIndex =
          ((getDayIndexForDate(weekStart, previousDay) % 7) + 7) % 7;
        const previousSettings = resolveDaySettings(
          settings,
          dayKeyFromIndex(previousIndex),
        );
        const previousEveningEnd = combineDateAndTime(
          previousDay,
          previousSettings.evening_prep_end,
        );
        idealStart = new Date(
          previousEveningEnd.getTime() -
            Math.max(task.active_minutes, 1) * 60_000,
        );
      }

      const scheduledStart = task.blocks_active_work && !task.unattended
        ? chooseLatestAvailableStart(
            weekStart,
            idealStart,
            offsetDeadline,
            task.active_minutes,
            settings,
          )
        : chooseLatestAvailableStart(
            weekStart,
            idealStart,
            offsetDeadline,
            Math.max(task.active_minutes, 1),
            settings,
          );

      const scheduledEnd = scheduledStart
        ? new Date(
            scheduledStart.getTime() + getTaskElapsedMinutes(task) * 60_000,
          )
        : null;

      return {
        plannedMealId: meal.id,
        recipeId: meal.recipe_id,
        recipeTaskId: task.id,
        title: task.title,
        instructions: task.instructions,
        taskType: task.task_type,
        scheduledDate: toLocalDateString(idealStart),
        scheduledStart: scheduledStart
          ? formatTimeForDatabase(scheduledStart)
          : null,
        scheduledEnd: scheduledEnd
          ? formatTimeForDatabase(scheduledEnd)
          : null,
        unscheduledReason: scheduledStart
          ? null
          : "No valid kitchen availability window could fit this active task before its deadline.",
        activeMinutes: task.active_minutes,
        passiveMinutes: task.passive_minutes,
        unattended: task.unattended,
        blocksActiveWork: task.blocks_active_work,
        batchKey: task.batch_key,
        sourceRecipeName: meal.recipeName,
        sourceMealType: meal.meal_slot_name,
        position: task.position,
      };
    })
    .sort(sortGeneratedTasks);
}
