import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meal Planner",
    short_name: "Meals",
    description:
      "Plan meals, schedule cooking sessions, manage pantry stock, and create shopping lists.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#1f5132",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}