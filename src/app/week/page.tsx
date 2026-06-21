import WeeklyPlanner from "@/components/weekly-planner";

export default function WeekPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Weekly planning</p>
          <h1>Plan your meals</h1>
          <p className="subtitle">
            Choose your meals and servings manually. The optimizer will later
            use this plan to create cooking batches and schedule them inside
            your available cooking blocks.
          </p>
        </div>
      </header>

      <WeeklyPlanner />
    </>
  );
}