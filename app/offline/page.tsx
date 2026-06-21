export default function OfflinePage() {
  return (
    <main
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div>
        <h1>You are offline</h1>
        <p>
          Reconnect to the internet, then reopen the Meal Planner.
        </p>
      </div>
    </main>
  );
}