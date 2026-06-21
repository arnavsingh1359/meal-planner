import type { ReactNode } from "react";
import AppNavigation from "@/components/app-navigation";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>

          <div>
            <strong>Meal Planner</strong>
            <span>Personal kitchen assistant</span>
          </div>
        </div>

        <AppNavigation variant="desktop" />

        <div className="sidebar-footer">
          <span>Current week</span>
          <strong>Not planned</strong>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <AppNavigation variant="mobile" />
    </div>
  );
}