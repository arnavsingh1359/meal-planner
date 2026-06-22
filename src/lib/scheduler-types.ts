export const recipeTaskTypes = [
  "preparation",
  "marinating",
  "soaking",
  "thawing",
  "cooking",
  "resting",
  "cooling",
  "portioning",
  "storage",
  "cleanup",
  "serving",
  "other",
] as const;

export type RecipeTaskType =
  (typeof recipeTaskTypes)[number];

export type ScheduledTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export type RecipeTask = {
  id: string;
  user_id: string;
  recipe_id: string;

  title: string;
  instructions: string;

  task_type: RecipeTaskType;

  active_minutes: number;
  passive_minutes: number;

  day_offset: number;
  start_before_meal_minutes: number;

  batch_key: string;
  can_batch: boolean;
  unattended: boolean;
  blocks_active_work: boolean;

  depends_on_task_id: string | null;

  position: number;
};

export type ScheduledTask = {
  id: string;
  user_id: string;

  weekly_plan_id: string;
  planned_meal_id: string | null;

  recipe_id: string | null;
  recipe_task_id: string | null;

  title: string;
  instructions: string;

  task_type: RecipeTaskType;

  scheduled_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;

  active_minutes: number;
  passive_minutes: number;

  unattended: boolean;
  blocks_active_work: boolean;

  status: ScheduledTaskStatus;

  is_generated: boolean;
  manually_adjusted: boolean;

  batch_key: string;
  source_recipe_name: string;
  source_meal_type: string;

  notes: string;
  position: number;

  completed_at: string | null;
};

export const recipeTaskTypeLabels: Record<
  RecipeTaskType,
  string
> = {
  preparation: "Preparation",
  marinating: "Marinating",
  soaking: "Soaking",
  thawing: "Thawing",
  cooking: "Cooking",
  resting: "Resting",
  cooling: "Cooling",
  portioning: "Portioning",
  storage: "Storage",
  cleanup: "Cleanup",
  serving: "Serving",
  other: "Other",
};

export const recipeTaskTypeDescriptions: Record<
  RecipeTaskType,
  string
> = {
  preparation:
    "Washing, chopping, measuring, mixing, or other setup.",

  marinating:
    "Applying a marinade and allowing the food to absorb it.",

  soaking:
    "Soaking beans, rice, grains, nuts, or other ingredients.",

  thawing:
    "Moving frozen food to the refrigerator or otherwise defrosting it.",

  cooking:
    "Heating, baking, boiling, frying, roasting, or simmering.",

  resting:
    "Allowing dough, meat, or cooked food to rest before the next step.",

  cooling:
    "Allowing food to cool before storing, portioning, or serving.",

  portioning:
    "Dividing the finished food into meals or containers.",

  storage:
    "Refrigerating, freezing, labeling, or otherwise storing food.",

  cleanup:
    "Washing equipment and cleaning the cooking area.",

  serving:
    "Final reheating, plating, garnishing, or serving work.",

  other:
    "Any task that does not fit another category.",
};

export function formatTaskType(
  taskType: RecipeTaskType,
) {
  return recipeTaskTypeLabels[taskType];
}

export function inferTaskType(
  text: string,
): RecipeTaskType {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("thaw") ||
    normalized.includes("defrost") ||
    normalized.includes("freezer to refrigerator")
  ) {
    return "thawing";
  }

  if (
    normalized.includes("marinate") ||
    normalized.includes("marinade")
  ) {
    return "marinating";
  }

  if (normalized.includes("soak")) {
    return "soaking";
  }

  if (
    normalized.includes("cool") ||
    normalized.includes("come to room temperature")
  ) {
    return "cooling";
  }

  if (
    normalized.includes("rest") ||
    normalized.includes("proof")
  ) {
    return "resting";
  }

  if (
    normalized.includes("portion") ||
    normalized.includes("divide into containers")
  ) {
    return "portioning";
  }

  if (
    normalized.includes("store") ||
    normalized.includes("refrigerate") ||
    normalized.includes("freeze") ||
    normalized.includes("label container")
  ) {
    return "storage";
  }

  if (
    normalized.includes("clean") ||
    normalized.includes("wash cookware")
  ) {
    return "cleanup";
  }

  if (
    normalized.includes("serve") ||
    normalized.includes("plate") ||
    normalized.includes("garnish") ||
    normalized.includes("reheat")
  ) {
    return "serving";
  }

  if (
    normalized.includes("cook") ||
    normalized.includes("bake") ||
    normalized.includes("boil") ||
    normalized.includes("simmer") ||
    normalized.includes("roast") ||
    normalized.includes("fry") ||
    normalized.includes("sauté") ||
    normalized.includes("saute") ||
    normalized.includes("grill")
  ) {
    return "cooking";
  }

  return "preparation";
}