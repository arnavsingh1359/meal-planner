export const ingredientCategories = [
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
] as const;

export type IngredientCategory =
  (typeof ingredientCategories)[number];

const categoryKeywords: Record<
  Exclude<IngredientCategory, "Other">,
  string[]
> = {
  Produce: [
    "apple",
    "banana",
    "orange",
    "lemon",
    "lime",
    "mango",
    "grape",
    "berry",
    "strawberry",
    "blueberry",
    "raspberry",
    "watermelon",
    "melon",
    "avocado",
    "tomato",
    "potato",
    "onion",
    "garlic",
    "ginger",
    "carrot",
    "spinach",
    "lettuce",
    "cabbage",
    "cauliflower",
    "broccoli",
    "pepper",
    "capsicum",
    "chili",
    "chilli",
    "cucumber",
    "zucchini",
    "eggplant",
    "aubergine",
    "mushroom",
    "celery",
    "coriander",
    "cilantro",
    "parsley",
    "mint",
    "basil",
    "spring onion",
    "green onion",
    "peas",
    "corn",
  ],

  Dairy: [
    "milk",
    "cream",
    "cheese",
    "butter",
    "ghee",
    "yogurt",
    "yoghurt",
    "curd",
    "paneer",
    "mozzarella",
    "cheddar",
    "parmesan",
    "ricotta",
    "sour cream",
  ],

  Meat: [
    "chicken",
    "beef",
    "pork",
    "lamb",
    "mutton",
    "turkey",
    "bacon",
    "sausage",
    "ham",
    "steak",
    "mince",
    "ground meat",
  ],

  Seafood: [
    "fish",
    "salmon",
    "tuna",
    "shrimp",
    "prawn",
    "crab",
    "lobster",
    "cod",
    "tilapia",
    "sardine",
    "anchovy",
    "mackerel",
    "squid",
  ],

  Grains: [
    "rice",
    "basmati",
    "jasmine rice",
    "brown rice",
    "quinoa",
    "oats",
    "barley",
    "millet",
    "couscous",
    "bread",
    "tortilla",
    "roti",
    "chapati",
    "naan",
  ],

  Pasta: [
    "pasta",
    "spaghetti",
    "penne",
    "macaroni",
    "lasagna",
    "lasagne",
    "noodle",
    "ramen",
    "vermicelli",
    "fettuccine",
  ],

  Legumes: [
    "lentil",
    "dal",
    "dhal",
    "bean",
    "chickpea",
    "rajma",
    "kidney bean",
    "black bean",
    "soybean",
    "tofu",
    "tempeh",
  ],

  Spices: [
    "salt",
    "pepper",
    "turmeric",
    "cumin",
    "coriander powder",
    "garam masala",
    "paprika",
    "cinnamon",
    "cardamom",
    "clove",
    "nutmeg",
    "oregano",
    "thyme",
    "rosemary",
    "bay leaf",
    "mustard seed",
    "fenugreek",
    "saffron",
    "chili powder",
    "chilli powder",
    "cayenne",
  ],

  Condiments: [
    "oil",
    "olive oil",
    "vegetable oil",
    "soy sauce",
    "vinegar",
    "ketchup",
    "mustard",
    "mayonnaise",
    "mayo",
    "hot sauce",
    "chutney",
    "pickle",
    "jam",
    "honey",
    "maple syrup",
    "tahini",
    "peanut butter",
  ],

  Baking: [
    "flour",
    "sugar",
    "brown sugar",
    "baking powder",
    "baking soda",
    "yeast",
    "cocoa",
    "chocolate",
    "vanilla",
    "cornstarch",
    "corn flour",
    "icing sugar",
  ],

  Frozen: [
    "frozen",
    "ice cream",
    "frozen peas",
    "frozen corn",
    "frozen berries",
  ],

  Snacks: [
    "chips",
    "crisps",
    "cracker",
    "cookie",
    "biscuit",
    "popcorn",
    "nuts",
    "almond",
    "cashew",
    "walnut",
    "peanut",
    "trail mix",
  ],

  Beverages: [
    "coffee",
    "tea",
    "juice",
    "soda",
    "sparkling water",
    "coconut water",
    "energy drink",
  ],
};

const lowercaseWords = new Set([
  "and",
  "or",
  "of",
  "with",
  "in",
  "for",
]);

export function formatIngredientName(value: string) {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return normalized
    .split(" ")
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) {
        return word;
      }

      return word
        .split("-")
        .map(
          (part) =>
            part.charAt(0).toUpperCase() +
            part.slice(1),
        )
        .join("-");
    })
    .join(" ");
}

export function inferIngredientCategory(
  ingredientName: string,
): IngredientCategory {
  const normalizedName = ingredientName
    .trim()
    .toLowerCase();

  for (const [category, keywords] of Object.entries(
    categoryKeywords,
  )) {
    const matches = keywords.some((keyword) => {
      const normalizedKeyword = keyword.toLowerCase();

      return (
        normalizedName === normalizedKeyword ||
        normalizedName.includes(normalizedKeyword)
      );
    });

    if (matches) {
      return category as IngredientCategory;
    }
  }

  return "Other";
}