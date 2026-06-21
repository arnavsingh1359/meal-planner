import type { CSSProperties } from "react";

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

const styles: Record<string, CSSProperties> = {
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },

  summaryCard: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
    padding: "18px 20px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-medium)",
    background: "var(--surface)",
    boxShadow: "var(--shadow)",
  },

  summaryLabel: {
    color: "var(--muted)",
    fontSize: "0.78rem",
    fontWeight: 700,
  },

  summaryValue: {
    color: "var(--primary)",
    fontSize: "1.8rem",
    lineHeight: 1,
  },

  summaryDetail: {
    color: "var(--muted)",
    fontSize: "0.72rem",
    lineHeight: 1.35,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
    alignItems: "start",
  },

  taskList: {
    display: "grid",
    gap: 0,
  },

  task: {
    display: "grid",
    gridTemplateColumns: "86px 12px minmax(0, 1fr)",
    alignItems: "start",
    gap: "12px",
    padding: "15px 0",
    borderBottom: "1px solid var(--border)",
  },

  taskTime: {
    color: "var(--muted)",
    fontSize: "0.78rem",
    fontWeight: 700,
    lineHeight: 1.4,
  },

  taskMarker: {
    width: "10px",
    height: "10px",
    marginTop: "4px",
    borderRadius: "50%",
    background: "var(--primary)",
    boxShadow: "0 0 0 4px var(--primary-soft)",
  },

  taskText: {
    display: "grid",
    gap: "4px",
    minWidth: 0,
  },

  taskTitle: {
    fontSize: "0.92rem",
  },

  taskDetail: {
    margin: 0,
    color: "var(--muted)",
    fontSize: "0.8rem",
  },

  nextStepPanel: {
    display: "grid",
    gap: "8px",
  },

  noMargin: {
    marginBottom: 0,
  },

  mutedParagraph: {
    marginBottom: 0,
    color: "var(--muted)",
  },
};

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

      <section
        style={styles.summaryGrid}
        aria-label="Weekly summary"
      >
        <article style={styles.summaryCard}>
          <span style={styles.summaryLabel}>
            Meals planned
          </span>

          <strong style={styles.summaryValue}>
            0
          </strong>

          <small style={styles.summaryDetail}>
            of 28 meal slots
          </small>
        </article>

        <article style={styles.summaryCard}>
          <span style={styles.summaryLabel}>
            Cooking sessions
          </span>

          <strong style={styles.summaryValue}>
            0
          </strong>

          <small style={styles.summaryDetail}>
            No schedule generated
          </small>
        </article>

        <article style={styles.summaryCard}>
          <span style={styles.summaryLabel}>
            Shopping items
          </span>

          <strong style={styles.summaryValue}>
            0
          </strong>

          <small style={styles.summaryDetail}>
            Pantry not reviewed
          </small>
        </article>
      </section>

      <section style={styles.contentGrid}>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Schedule
              </p>

              <h2 style={styles.noMargin}>
                Today&apos;s tasks
              </h2>
            </div>
          </div>

          <div style={styles.taskList}>
            {todayTasks.map((task, index) => (
              <div
                key={`${task.time}-${task.title}`}
                style={{
                  ...styles.task,
                  ...(index === todayTasks.length - 1
                    ? { borderBottom: "none" }
                    : {}),
                }}
              >
                <div style={styles.taskTime}>
                  {task.time}
                </div>

                <div
                  style={styles.taskMarker}
                  aria-hidden="true"
                />

                <div style={styles.taskText}>
                  <strong style={styles.taskTitle}>
                    {task.title}
                  </strong>

                  <p style={styles.taskDetail}>
                    {task.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article
          className="panel"
          style={styles.nextStepPanel}
        >
          <p
            className="eyebrow"
            style={styles.noMargin}
          >
            Getting started
          </p>

          <h2 style={styles.noMargin}>
            Create your first weekly plan
          </h2>

          <p style={styles.mutedParagraph}>
            Select meals for each day, enter your cooking blocks, and later
            generate an optimized preparation schedule.
          </p>
        </article>
      </section>
    </>
  );
}