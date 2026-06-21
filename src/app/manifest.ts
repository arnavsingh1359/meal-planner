import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meal Planner",
    short_name: "Meals",
    description:
      "Plan meals, manage recipes, track pantry inventory, and generate shopping lists.",

    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#f7f5ef",
    theme_color: "#174c2b",

    orientation: "portrait-primary",

    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}