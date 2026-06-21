"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Recipe = {
  id: string;
  name: string;
  description: string;
  meal_types: string[];
  default_servings: number;
  preparation_minutes: number;
  cooking_minutes: number;
};

export default function RecipeTestPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [isSaving, setIsSaving] = useState(false);

  async function loadRecipes() {
    setStatus("Loading recipes...");

    const { data, error } = await supabase
      .from("recipes")
      .select(
        `
          id,
          name,
          description,
          meal_types,
          default_servings,
          preparation_minutes,
          cooking_minutes
        `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Recipe loading error:", error);
      setStatus(error.message);
      return;
    }

    setRecipes(data ?? []);
    setStatus(
      data && data.length > 0
        ? "Recipes loaded successfully."
        : "No recipes saved yet.",
    );
  }

  useEffect(() => {
    void loadRecipes();
  }, []);

  async function addTestRecipe() {
    setIsSaving(true);
    setStatus("Saving recipe...");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You are not signed in.");
      }

      const { error } = await supabase.from("recipes").insert({
        user_id: user.id,
        name: "Test Overnight Oats",
        description: "Temporary recipe used to test Supabase.",
        meal_types: ["Breakfast"],
        default_servings: 1,
        preparation_minutes: 10,
        cooking_minutes: 0,
      });

      if (error) {
        throw error;
      }

      await loadRecipes();
    } catch (error) {
      console.error("Recipe saving error:", error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Could not save the recipe.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Database test</p>
          <h1>Recipe storage</h1>
          <p className="subtitle">{status}</p>
        </div>

        <button
          className="primary-button"
          disabled={isSaving}
          onClick={addTestRecipe}
          type="button"
        >
          {isSaving ? "Saving..." : "Add test recipe"}
        </button>
      </header>

      <section className="panel">
        {recipes.length === 0 ? (
          <p>No recipes found.</p>
        ) : (
          <div className="recipe-test-list">
            {recipes.map((recipe) => (
              <article className="recipe-test-item" key={recipe.id}>
                <div>
                  <strong>{recipe.name}</strong>
                  <p>{recipe.description}</p>
                </div>

                <small>
                  {recipe.default_servings} serving
                  {recipe.default_servings === 1 ? "" : "s"} ·{" "}
                  {recipe.preparation_minutes +
                    recipe.cooking_minutes}{" "}
                  min
                </small>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}