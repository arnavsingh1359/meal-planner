const todayTasks = [
  {
    time: "8:00 AM",
    title: "Prepare breakfast",
    detail: "No breakfast selected",
  },
  {
    time: "6:30 PM",
    title: "Cooking block",
    detail: "No session planned yet",
  },
];

export default function Home() {
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Today</p>
          <h1>Your kitchen dashboard</h1>
          <p className="subtitle">
            Once your weekly menu is created, today&apos;s preparation and
            cooking tasks will appear here.
          </p>
        </div>
      </header>

      <section className="summary-grid" aria-label="Weekly summary">
        <article className="summary-card">
          <span>Meals planned</span>
          <strong>0</strong>
          <small>of 28 meal slots</small>
        </article>

        <article className="summary-card">
          <span>Cooking sessions</span>
          <strong>0</strong>
          <small>No schedule generated</small>
        </article>

        <article className="summary-card">
          <span>Shopping items</span>
          <strong>0</strong>
          <small>Pantry not reviewed</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2>Today&apos;s tasks</h2>
            </div>
          </div>

          <div className="task-list">
            {todayTasks.map((task) => (
              <div className="task" key={`${task.time}-${task.title}`}>
                <div className="task-time">{task.time}</div>
                <div className="task-marker" aria-hidden="true" />

                <div>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel next-step-panel">
          <p className="eyebrow">Getting started</p>
          <h2>Create your first weekly plan</h2>
          <p>
            Select meals for each day, enter your cooking blocks, and later
            generate an optimized preparation schedule.
          </p>
        </article>
      </section>
    </>
  );
}