export const dayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayKey = (typeof dayKeys)[number];
export type MealCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "any";

export type PreparationMode =
  | "fresh"
  | "packed"
  | "previous_evening"
  | "batch_cooked"
  | "leftover"
  | "reheat_only"
  | "no_cooking";

export type MealSlotSetting = {
  id: string;
  name: string;
  meal_type: MealCategory;
  time: string;
  ready_by_time: string;
  preparation_mode: PreparationMode;
  position: number;
};

export type DaySettings = {
  inherits_from: DayKey | null;
  earliest_task_time: string;
  latest_task_time: string;
  evening_prep_start: string;
  evening_prep_end: string;
  leave_home_time: string | null;
  return_home_time: string | null;
  max_active_minutes: number;
  cooking_allowed: boolean;
  meal_slots: MealSlotSetting[];
};

export type UserSettings = {
  conflict_grouping_minutes: number;
  preferred_batch_days: DayKey[];
  preserve_manual_tasks: boolean;
  day_settings: Record<DayKey, DaySettings>;
};

export const dayLabels: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const mealCategoryLabels: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  any: "Any",
};

export const preparationModeLabels: Record<PreparationMode, string> = {
  fresh: "Fresh",
  packed: "Packed",
  previous_evening: "Prepare previous evening",
  batch_cooked: "Batch cooked",
  leftover: "Leftover",
  reheat_only: "Reheat only",
  no_cooking: "No cooking",
};

function standardMealSlots(): MealSlotSetting[] {
  return [
    {
      id: "breakfast",
      name: "Breakfast",
      meal_type: "breakfast",
      time: "08:00",
      ready_by_time: "08:00",
      preparation_mode: "fresh",
      position: 0,
    },
    {
      id: "lunch",
      name: "Lunch",
      meal_type: "lunch",
      time: "12:30",
      ready_by_time: "08:10",
      preparation_mode: "packed",
      position: 1,
    },
    {
      id: "snack",
      name: "Snack",
      meal_type: "snack",
      time: "17:00",
      ready_by_time: "08:15",
      preparation_mode: "packed",
      position: 2,
    },
    {
      id: "dinner",
      name: "Dinner",
      meal_type: "dinner",
      time: "19:30",
      ready_by_time: "19:30",
      preparation_mode: "fresh",
      position: 3,
    },
  ];
}

function weekdaySettings(inheritsFrom: DayKey | null): DaySettings {
  return {
    inherits_from: inheritsFrom,
    earliest_task_time: "07:00",
    latest_task_time: "21:30",
    evening_prep_start: "18:30",
    evening_prep_end: "21:00",
    leave_home_time: "08:30",
    return_home_time: "18:00",
    max_active_minutes: 75,
    cooking_allowed: true,
    meal_slots: standardMealSlots(),
  };
}

function weekendSettings(inheritsFrom: DayKey | null): DaySettings {
  return {
    inherits_from: inheritsFrom,
    earliest_task_time: "08:00",
    latest_task_time: "22:00",
    evening_prep_start: "17:30",
    evening_prep_end: "21:30",
    leave_home_time: null,
    return_home_time: null,
    max_active_minutes: 150,
    cooking_allowed: true,
    meal_slots: [
      {
        id: "breakfast",
        name: "Breakfast",
        meal_type: "breakfast",
        time: "09:00",
        ready_by_time: "09:00",
        preparation_mode: "fresh",
        position: 0,
      },
      {
        id: "lunch",
        name: "Lunch",
        meal_type: "lunch",
        time: "13:30",
        ready_by_time: "13:30",
        preparation_mode: "fresh",
        position: 1,
      },
      {
        id: "snack",
        name: "Snack",
        meal_type: "snack",
        time: "17:00",
        ready_by_time: "17:00",
        preparation_mode: "fresh",
        position: 2,
      },
      {
        id: "dinner",
        name: "Dinner",
        meal_type: "dinner",
        time: "20:00",
        ready_by_time: "20:00",
        preparation_mode: "fresh",
        position: 3,
      },
    ],
  };
}

export const defaultUserSettings: UserSettings = {
  conflict_grouping_minutes: 60,
  preferred_batch_days: ["sunday"],
  preserve_manual_tasks: true,
  day_settings: {
    monday: weekdaySettings(null),
    tuesday: weekdaySettings("monday"),
    wednesday: weekdaySettings("monday"),
    thursday: weekdaySettings("monday"),
    friday: weekdaySettings("monday"),
    saturday: weekendSettings(null),
    sunday: weekendSettings("saturday"),
  },
};

function cloneDaySettings(settings: DaySettings): DaySettings {
  return {
    ...settings,
    meal_slots: settings.meal_slots.map((slot) => ({ ...slot })),
  };
}

export function cloneUserSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    preferred_batch_days: [...settings.preferred_batch_days],
    day_settings: Object.fromEntries(
      dayKeys.map((day) => [day, cloneDaySettings(settings.day_settings[day])]),
    ) as Record<DayKey, DaySettings>,
  };
}

export function normalizeUserSettings(value: unknown): UserSettings {
  const defaults = cloneUserSettings(defaultUserSettings);

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const input = value as Partial<UserSettings> & {
    preferred_batch_day?: DayKey;
  };
  const inputDays = input.day_settings ?? ({} as Record<DayKey, DaySettings>);

  const day_settings = Object.fromEntries(
    dayKeys.map((day) => {
      const fallback = defaults.day_settings[day];
      const candidate = inputDays[day];

      if (!candidate || typeof candidate !== "object") {
        return [day, fallback];
      }

      const mealSlots = Array.isArray(candidate.meal_slots)
        ? candidate.meal_slots
            .filter((slot) => slot && typeof slot === "object")
            .map((slot, index) => ({
              id: String(slot.id || `meal-${index + 1}`),
              name: String(slot.name || `Meal ${index + 1}`),
              meal_type: (slot.meal_type || "any") as MealCategory,
              time: String(slot.time || "12:00").slice(0, 5),
              ready_by_time: String(slot.ready_by_time || slot.time || "12:00").slice(0, 5),
              preparation_mode: (slot.preparation_mode || "fresh") as PreparationMode,
              position: Number.isFinite(Number(slot.position)) ? Number(slot.position) : index,
            }))
            .sort((a, b) => a.position - b.position)
        : fallback.meal_slots;

      return [
        day,
        {
          ...fallback,
          ...candidate,
          meal_slots: mealSlots,
          max_active_minutes: Math.max(0, Number(candidate.max_active_minutes ?? fallback.max_active_minutes)),
        },
      ];
    }),
  ) as Record<DayKey, DaySettings>;

  return {
    conflict_grouping_minutes: Math.min(
      180,
      Math.max(15, Number(input.conflict_grouping_minutes ?? defaults.conflict_grouping_minutes)),
    ),
    preferred_batch_days: Array.isArray(input.preferred_batch_days)
      ? input.preferred_batch_days.filter(
          (day): day is DayKey => dayKeys.includes(day as DayKey),
        )
      : input.preferred_batch_day &&
          dayKeys.includes(input.preferred_batch_day as DayKey)
        ? [input.preferred_batch_day as DayKey]
        : defaults.preferred_batch_days,
    preserve_manual_tasks: input.preserve_manual_tasks ?? defaults.preserve_manual_tasks,
    day_settings,
  };
}

export function resolveDaySettings(
  settings: UserSettings,
  day: DayKey,
): DaySettings {
  const visited = new Set<DayKey>();
  let current = day;

  while (true) {
    if (visited.has(current)) {
      return cloneDaySettings(settings.day_settings[day]);
    }

    visited.add(current);
    const candidate = settings.day_settings[current];

    if (!candidate.inherits_from) {
      return cloneDaySettings(candidate);
    }

    current = candidate.inherits_from;
  }
}

export function dayKeyFromIndex(index: number): DayKey {
  return dayKeys[Math.min(6, Math.max(0, index))];
}

export function makeMealSlotId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "meal";

  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
