export type MeasurementSystem =
  | "metric"
  | "imperial";

export type UnitDimension =
  | "mass"
  | "volume"
  | "count"
  | "unknown";

export type NormalizedMeasurement = {
  quantity: number;
  unit: string;
  dimension: UnitDimension;
};

type UnitDefinition = {
  canonicalUnit: string;
  dimension: UnitDimension;
  toBaseFactor: number;
};

const unitAliases: Record<
  string,
  UnitDefinition
> = {
  g: {
    canonicalUnit: "g",
    dimension: "mass",
    toBaseFactor: 1,
  },
  gram: {
    canonicalUnit: "g",
    dimension: "mass",
    toBaseFactor: 1,
  },
  grams: {
    canonicalUnit: "g",
    dimension: "mass",
    toBaseFactor: 1,
  },

  kg: {
    canonicalUnit: "kg",
    dimension: "mass",
    toBaseFactor: 1000,
  },
  kilogram: {
    canonicalUnit: "kg",
    dimension: "mass",
    toBaseFactor: 1000,
  },
  kilograms: {
    canonicalUnit: "kg",
    dimension: "mass",
    toBaseFactor: 1000,
  },

  oz: {
    canonicalUnit: "oz",
    dimension: "mass",
    toBaseFactor: 28.349523125,
  },
  ounce: {
    canonicalUnit: "oz",
    dimension: "mass",
    toBaseFactor: 28.349523125,
  },
  ounces: {
    canonicalUnit: "oz",
    dimension: "mass",
    toBaseFactor: 28.349523125,
  },

  lb: {
    canonicalUnit: "lb",
    dimension: "mass",
    toBaseFactor: 453.59237,
  },
  lbs: {
    canonicalUnit: "lb",
    dimension: "mass",
    toBaseFactor: 453.59237,
  },
  pound: {
    canonicalUnit: "lb",
    dimension: "mass",
    toBaseFactor: 453.59237,
  },
  pounds: {
    canonicalUnit: "lb",
    dimension: "mass",
    toBaseFactor: 453.59237,
  },

  ml: {
    canonicalUnit: "ml",
    dimension: "volume",
    toBaseFactor: 1,
  },
  milliliter: {
    canonicalUnit: "ml",
    dimension: "volume",
    toBaseFactor: 1,
  },
  milliliters: {
    canonicalUnit: "ml",
    dimension: "volume",
    toBaseFactor: 1,
  },
  millilitre: {
    canonicalUnit: "ml",
    dimension: "volume",
    toBaseFactor: 1,
  },
  millilitres: {
    canonicalUnit: "ml",
    dimension: "volume",
    toBaseFactor: 1,
  },

  l: {
    canonicalUnit: "L",
    dimension: "volume",
    toBaseFactor: 1000,
  },
  liter: {
    canonicalUnit: "L",
    dimension: "volume",
    toBaseFactor: 1000,
  },
  liters: {
    canonicalUnit: "L",
    dimension: "volume",
    toBaseFactor: 1000,
  },
  litre: {
    canonicalUnit: "L",
    dimension: "volume",
    toBaseFactor: 1000,
  },
  litres: {
    canonicalUnit: "L",
    dimension: "volume",
    toBaseFactor: 1000,
  },

  tsp: {
    canonicalUnit: "tsp",
    dimension: "volume",
    toBaseFactor: 4.92892159375,
  },
  teaspoon: {
    canonicalUnit: "tsp",
    dimension: "volume",
    toBaseFactor: 4.92892159375,
  },
  teaspoons: {
    canonicalUnit: "tsp",
    dimension: "volume",
    toBaseFactor: 4.92892159375,
  },

  tbsp: {
    canonicalUnit: "tbsp",
    dimension: "volume",
    toBaseFactor: 14.78676478125,
  },
  tablespoon: {
    canonicalUnit: "tbsp",
    dimension: "volume",
    toBaseFactor: 14.78676478125,
  },
  tablespoons: {
    canonicalUnit: "tbsp",
    dimension: "volume",
    toBaseFactor: 14.78676478125,
  },

  cup: {
    canonicalUnit: "cup",
    dimension: "volume",
    toBaseFactor: 236.5882365,
  },
  cups: {
    canonicalUnit: "cup",
    dimension: "volume",
    toBaseFactor: 236.5882365,
  },

  "fl oz": {
    canonicalUnit: "fl oz",
    dimension: "volume",
    toBaseFactor: 29.5735295625,
  },
  floz: {
    canonicalUnit: "fl oz",
    dimension: "volume",
    toBaseFactor: 29.5735295625,
  },
  "fluid ounce": {
    canonicalUnit: "fl oz",
    dimension: "volume",
    toBaseFactor: 29.5735295625,
  },
  "fluid ounces": {
    canonicalUnit: "fl oz",
    dimension: "volume",
    toBaseFactor: 29.5735295625,
  },

  pint: {
    canonicalUnit: "pint",
    dimension: "volume",
    toBaseFactor: 473.176473,
  },
  pints: {
    canonicalUnit: "pint",
    dimension: "volume",
    toBaseFactor: 473.176473,
  },
  pt: {
    canonicalUnit: "pint",
    dimension: "volume",
    toBaseFactor: 473.176473,
  },

  quart: {
    canonicalUnit: "quart",
    dimension: "volume",
    toBaseFactor: 946.352946,
  },
  quarts: {
    canonicalUnit: "quart",
    dimension: "volume",
    toBaseFactor: 946.352946,
  },
  qt: {
    canonicalUnit: "quart",
    dimension: "volume",
    toBaseFactor: 946.352946,
  },

  gallon: {
    canonicalUnit: "gallon",
    dimension: "volume",
    toBaseFactor: 3785.411784,
  },
  gallons: {
    canonicalUnit: "gallon",
    dimension: "volume",
    toBaseFactor: 3785.411784,
  },
  gal: {
    canonicalUnit: "gallon",
    dimension: "volume",
    toBaseFactor: 3785.411784,
  },

  whole: {
    canonicalUnit: "whole",
    dimension: "count",
    toBaseFactor: 1,
  },
  piece: {
    canonicalUnit: "piece",
    dimension: "count",
    toBaseFactor: 1,
  },
  pieces: {
    canonicalUnit: "piece",
    dimension: "count",
    toBaseFactor: 1,
  },
  item: {
    canonicalUnit: "piece",
    dimension: "count",
    toBaseFactor: 1,
  },
  items: {
    canonicalUnit: "piece",
    dimension: "count",
    toBaseFactor: 1,
  },

  clove: {
    canonicalUnit: "clove",
    dimension: "count",
    toBaseFactor: 1,
  },
  cloves: {
    canonicalUnit: "clove",
    dimension: "count",
    toBaseFactor: 1,
  },

  can: {
    canonicalUnit: "can",
    dimension: "count",
    toBaseFactor: 1,
  },
  cans: {
    canonicalUnit: "can",
    dimension: "count",
    toBaseFactor: 1,
  },

  packet: {
    canonicalUnit: "packet",
    dimension: "count",
    toBaseFactor: 1,
  },
  packets: {
    canonicalUnit: "packet",
    dimension: "count",
    toBaseFactor: 1,
  },

  bottle: {
    canonicalUnit: "bottle",
    dimension: "count",
    toBaseFactor: 1,
  },
  bottles: {
    canonicalUnit: "bottle",
    dimension: "count",
    toBaseFactor: 1,
  },

  box: {
    canonicalUnit: "box",
    dimension: "count",
    toBaseFactor: 1,
  },
  boxes: {
    canonicalUnit: "box",
    dimension: "count",
    toBaseFactor: 1,
  },

  dozen: {
    canonicalUnit: "whole",
    dimension: "count",
    toBaseFactor: 12,
  },
};

function normalizeUnitText(unit: string) {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function getUnitDefinition(
  unit: string,
): UnitDefinition | null {
  const normalized = normalizeUnitText(unit);

  return unitAliases[normalized] ?? null;
}

export function normalizeMeasurement(
  quantity: number,
  unit: string,
): NormalizedMeasurement {
  const definition = getUnitDefinition(unit);

  if (!definition) {
    return {
      quantity,
      unit: normalizeUnitText(unit),
      dimension: "unknown",
    };
  }

  if (definition.dimension === "count") {
    return {
      quantity:
        quantity *
        definition.toBaseFactor,
      unit: definition.canonicalUnit,
      dimension: "count",
    };
  }

  return {
    quantity:
      quantity *
      definition.toBaseFactor,

    unit:
      definition.dimension === "mass"
        ? "g"
        : "ml",

    dimension:
      definition.dimension,
  };
}

export function areUnitsCompatible(
  firstUnit: string,
  secondUnit: string,
) {
  const first =
    normalizeMeasurement(1, firstUnit);

  const second =
    normalizeMeasurement(1, secondUnit);

  if (
    first.dimension === "unknown" ||
    second.dimension === "unknown"
  ) {
    return (
      normalizeUnitText(firstUnit) ===
      normalizeUnitText(secondUnit)
    );
  }

  if (
    first.dimension === "count" &&
    second.dimension === "count"
  ) {
    return first.unit === second.unit;
  }

  return first.dimension === second.dimension;
}

function roundQuantity(value: number) {
  if (value >= 100) {
    return Math.round(value);
  }

  if (value >= 10) {
    return Math.round(value * 10) / 10;
  }

  return Math.round(value * 100) / 100;
}

export function displayMeasurement(
  baseQuantity: number,
  baseUnit: string,
  system: MeasurementSystem,
) {
  if (
    baseUnit !== "g" &&
    baseUnit !== "ml"
  ) {
    return {
      quantity:
        roundQuantity(baseQuantity),
      unit: baseUnit,
    };
  }

  if (baseUnit === "g") {
    if (system === "metric") {
      if (baseQuantity >= 1000) {
        return {
          quantity: roundQuantity(
            baseQuantity / 1000,
          ),
          unit: "kg",
        };
      }

      return {
        quantity:
          roundQuantity(baseQuantity),
        unit: "g",
      };
    }

    const pounds =
      baseQuantity / 453.59237;

    if (pounds >= 1) {
      return {
        quantity: roundQuantity(pounds),
        unit: "lb",
      };
    }

    return {
      quantity: roundQuantity(
        baseQuantity / 28.349523125,
      ),
      unit: "oz",
    };
  }

  if (system === "metric") {
    if (baseQuantity >= 1000) {
      return {
        quantity: roundQuantity(
          baseQuantity / 1000,
        ),
        unit: "L",
      };
    }

    return {
      quantity:
        roundQuantity(baseQuantity),
      unit: "ml",
    };
  }

  if (baseQuantity >= 3785.411784) {
    return {
      quantity: roundQuantity(
        baseQuantity / 3785.411784,
      ),
      unit: "gallon",
    };
  }

  if (baseQuantity >= 946.352946) {
    return {
      quantity: roundQuantity(
        baseQuantity / 946.352946,
      ),
      unit: "quart",
    };
  }

  if (baseQuantity >= 473.176473) {
    return {
      quantity: roundQuantity(
        baseQuantity / 473.176473,
      ),
      unit: "pint",
    };
  }

  if (baseQuantity >= 236.5882365) {
    return {
      quantity: roundQuantity(
        baseQuantity / 236.5882365,
      ),
      unit: "cup",
    };
  }

  if (baseQuantity >= 29.5735295625) {
    return {
      quantity: roundQuantity(
        baseQuantity / 29.5735295625,
      ),
      unit: "fl oz",
    };
  }

  if (baseQuantity >= 14.78676478125) {
    return {
      quantity: roundQuantity(
        baseQuantity / 14.78676478125,
      ),
      unit: "tbsp",
    };
  }

  return {
    quantity: roundQuantity(
      baseQuantity / 4.92892159375,
    ),
    unit: "tsp",
  };
}

export function formatMeasurement(
  quantity: number | null,
  unit: string,
  system: MeasurementSystem,
) {
  if (quantity === null) {
    return "Not measured";
  }

  const displayed = displayMeasurement(
    quantity,
    unit,
    system,
  );

  return `${displayed.quantity} ${displayed.unit}`.trim();
}