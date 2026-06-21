export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export type Recipe = {
  id: string;
  name: string;
  mealTypes: MealType[];
  description: string;
  defaultServings: number;
  preparationMinutes: number;
  cookingMinutes: number;
};

export const recipes: Recipe[] = [
  {
    id: "overnight-oats",
    name: "Overnight Oats",
    mealTypes: ["Breakfast"],
    description: "Oats soaked overnight with milk, yogurt, and fruit.",
    defaultServings: 1,
    preparationMinutes: 10,
    cookingMinutes: 0,
  },
  {
    id: "eggs-toast",
    name: "Eggs and Toast",
    mealTypes: ["Breakfast"],
    description: "Eggs served with toasted bread.",
    defaultServings: 1,
    preparationMinutes: 5,
    cookingMinutes: 10,
  },
  {
    id: "poha",
    name: "Poha",
    mealTypes: ["Breakfast"],
    description: "Flattened rice cooked with onion, spices, and peanuts.",
    defaultServings: 2,
    preparationMinutes: 10,
    cookingMinutes: 20,
  },
  {
    id: "chilla",
    name: "Besan Chilla",
    mealTypes: ["Breakfast", "Lunch"],
    description: "Savory chickpea-flour pancakes with vegetables.",
    defaultServings: 2,
    preparationMinutes: 10,
    cookingMinutes: 20,
  },
  {
    id: "rajma-rice",
    name: "Rajma and Rice",
    mealTypes: ["Lunch", "Dinner"],
    description: "Kidney-bean curry served with rice.",
    defaultServings: 3,
    preparationMinutes: 20,
    cookingMinutes: 70,
  },
  {
    id: "chicken-curry",
    name: "Chicken Curry",
    mealTypes: ["Lunch", "Dinner"],
    description: "Chicken cooked in an onion and tomato curry.",
    defaultServings: 3,
    preparationMinutes: 25,
    cookingMinutes: 45,
  },
  {
    id: "pasta",
    name: "Pasta",
    mealTypes: ["Lunch", "Dinner"],
    description: "Pasta with a tomato and vegetable sauce.",
    defaultServings: 2,
    preparationMinutes: 10,
    cookingMinutes: 25,
  },
  {
    id: "vegetable-stir-fry",
    name: "Vegetable Stir-Fry",
    mealTypes: ["Lunch", "Dinner"],
    description: "Mixed vegetables quickly cooked with a savory sauce.",
    defaultServings: 2,
    preparationMinutes: 20,
    cookingMinutes: 15,
  },
  {
    id: "fruit-yogurt",
    name: "Fruit and Yogurt",
    mealTypes: ["Breakfast", "Snack"],
    description: "Fresh fruit served with yogurt.",
    defaultServings: 1,
    preparationMinutes: 5,
    cookingMinutes: 0,
  },
  {
    id: "roasted-makhana",
    name: "Roasted Makhana",
    mealTypes: ["Snack"],
    description: "Makhana roasted with seasoning.",
    defaultServings: 4,
    preparationMinutes: 2,
    cookingMinutes: 10,
  },
  {
    id: "nuts",
    name: "Mixed Nuts",
    mealTypes: ["Snack"],
    description: "A portion of mixed nuts.",
    defaultServings: 1,
    preparationMinutes: 1,
    cookingMinutes: 0,
  },
];