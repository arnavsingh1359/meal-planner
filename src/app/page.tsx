"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getMonday(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function formatTime(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type DashboardTask = {
  id: string;
  title: string;
  source_recipe_name: string;
  source_meal_type: string;
  scheduled_start: string | null;
  status: string;
  notes: string;
};

type TodayMeal = {
  id: string;
  meal_slot_name: string;
  meal_time: string;
  planned_meal_recipes: Array<{ id: string }> | null;
};

export default function Home() {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [todayMeals, setTodayMeals] = useState<TodayMeal[]>([]);
  const [weeklyMealCount, setWeeklyMealCount] = useState(0);
  const [weeklyRecipeCount, setWeeklyRecipeCount] = useState(0);
  const [shoppingCount, setShoppingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setTasks([]);
        setTodayMeals([]);
        return;
      }

      const today = new Date();
      const todayString = toLocalDateString(today);
      const weekStartString = toLocalDateString(getMonday(today));
      const day = today.getDay();
      const dayIndex = day === 0 ? 6 : day - 1;

      const { data: weeklyPlan, error: planError } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start", weekStartString)
        .maybeSingle();

      if (planError) {
        throw planError;
      }

      const [taskResult, shoppingResult] = await Promise.all([
        supabase
          .from("scheduled_tasks")
          .select(`
            id,
            title,
            source_recipe_name,
            source_meal_type,
            scheduled_start,
            status,
            notes
          `)
          .eq("user_id", user.id)
          .eq("scheduled_date", todayString)
          .in("status", ["pending", "in_progress"])
          .order("scheduled_start", { ascending: true, nullsFirst: false }),
        supabase
          .from("shopping_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_purchased", false),
      ]);

      if (taskResult.error) {
        throw taskResult.error;
      }

      if (shoppingResult.error) {
        throw shoppingResult.error;
      }

      setTasks((taskResult.data ?? []) as DashboardTask[]);
      setShoppingCount(shoppingResult.count ?? 0);

      if (!weeklyPlan) {
        setTodayMeals([]);
        setWeeklyMealCount(0);
        setWeeklyRecipeCount(0);
        return;
      }

      const { data: plannedMeals, error: mealsError } = await supabase
        .from("planned_meals")
        .select(`
          id,
          day_index,
          meal_slot_name,
          meal_time,
          planned_meal_recipes (id)
        `)
        .eq("weekly_plan_id", weeklyPlan.id)
        .order("day_index")
        .order("meal_time");

      if (mealsError) {
        throw mealsError;
      }

      const rows = (plannedMeals ?? []) as Array<TodayMeal & { day_index: number }>;
      setWeeklyMealCount(rows.length);
      setWeeklyRecipeCount(
        rows.reduce(
          (total, meal) => total + Math.max(meal.planned_meal_recipes?.length ?? 0, 1),
          0,
        ),
      );
      setTodayMeals(rows.filter((meal) => meal.day_index === dayIndex));
    } catch (error) {
      const details =
        error && typeof error === "object"
          ? JSON.stringify(error, null, 2)
          : String(error);

      console.error(
        "Could not load dashboard:",
        details,
      );

      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Could not load the dashboard.";

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  const unscheduledCount = useMemo(
    () => tasks.filter((task) => task.scheduled_start === null).length,
    [tasks],
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Today</p>
          <h1>Your kitchen dashboard</h1>
          <p className="subtitle">
            See today&apos;s meals, preparation tasks, and anything that still needs attention.
          </p>
        </div>
      </header>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <section className="dashboard-summary-grid" aria-label="Weekly summary">
        <article className="dashboard-summary-card">
          <span>Meal slots planned</span>
          <strong>{weeklyMealCount}</strong>
          <small>{weeklyRecipeCount} selected recipes this week</small>
        </article>

        <article className="dashboard-summary-card">
          <span>Tasks remaining today</span>
          <strong>{tasks.length}</strong>
          <small>
            {unscheduledCount > 0
              ? `${unscheduledCount} need manual placement`
              : "All generated tasks have a time"}
          </small>
        </article>

        <article className="dashboard-summary-card">
          <span>Shopping items remaining</span>
          <strong>{shoppingCount}</strong>
          <small>Unchecked items on your current lists</small>
        </article>
      </section>

      <section className="dashboard-content-grid">
        <article className="panel dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2>Today&apos;s tasks</h2>
            </div>
            <Link className="text-button" href="/schedule">
              Open schedule
            </Link>
          </div>

          {isLoading ? (
            <p className="muted-placeholder">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="empty-state dashboard-empty-state">
              <strong>No pending tasks today</strong>
              <p>Generate a schedule after planning your meals.</p>
            </div>
          ) : (
            <div className="dashboard-task-list">
              {tasks.map((task) => (
                <article
                  className={
                    task.scheduled_start === null
                      ? "dashboard-task dashboard-task-unscheduled"
                      : "dashboard-task"
                  }
                  key={task.id}
                >
                  <strong className="dashboard-task-time">
                    {formatTime(task.scheduled_start)}
                  </strong>
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.source_recipe_name}
                      {task.source_meal_type ? ` · ${task.source_meal_type}` : ""}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Meals</p>
              <h2>Today&apos;s plan</h2>
            </div>
            <Link className="text-button" href="/week">
              Edit week
            </Link>
          </div>

          {isLoading ? (
            <p className="muted-placeholder">Loading meals…</p>
          ) : todayMeals.length === 0 ? (
            <div className="empty-state dashboard-empty-state">
              <strong>No meals selected today</strong>
              <p>Add recipes to today&apos;s meal slots in the Week page.</p>
            </div>
          ) : (
            <div className="dashboard-meal-list">
              {todayMeals.map((meal) => (
                <article className="dashboard-meal" key={meal.id}>
                  <div>
                    <strong>{meal.meal_slot_name}</strong>
                    <small>{formatTime(meal.meal_time)}</small>
                  </div>
                  <span>
                    {Math.max(meal.planned_meal_recipes?.length ?? 0, 1)} recipe
                    {Math.max(meal.planned_meal_recipes?.length ?? 0, 1) === 1
                      ? ""
                      : "s"}
                  </span>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}
