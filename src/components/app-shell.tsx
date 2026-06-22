"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type AppShellProps = {
  children: ReactNode;
};

type IconName =
  | "dashboard"
  | "week"
  | "schedule"
  | "recipes"
  | "pantry"
  | "shopping"
  | "settings"
  | "user";

type AppIconProps = {
  name: IconName;
  size?: number;
};

function AppIcon({ name, size = 20 }: AppIconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );

    case "week":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" />
        </svg>
      );

    case "schedule":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
          <path d="m8 12 2 2 4-4" />
        </svg>
      );

    case "recipes":
      return (
        <svg {...commonProps}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22Z" />
          <path d="M4 5.5V20M8 7h8M8 11h8M8 15h5" />
        </svg>
      );

    case "pantry":
      return (
        <svg {...commonProps}>
          <path d="M5 4h14l-1 17H6Z" />
          <path d="M4 8h16M9 12v5M15 12v5" />
        </svg>
      );

    case "shopping":
      return (
        <svg {...commonProps}>
          <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 8H7" />
          <circle cx="10" cy="20" r="1" />
          <circle cx="17" cy="20" r="1" />
        </svg>
      );

    case "settings":
      return (
        <svg {...commonProps}>
          <path d="M4 7h10" />
          <path d="M18 7h2" />
          <circle cx="16" cy="7" r="2" />
          <path d="M4 17h2" />
          <path d="M10 17h10" />
          <circle cx="8" cy="17" r="2" />
          <path d="M4 12h5" />
          <path d="M13 12h7" />
          <circle cx="11" cy="12" r="2" />
        </svg>
      );

    case "user":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
  }
}

const navigationItems = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Home",
    icon: "dashboard" as IconName,
  },
  {
    href: "/week",
    label: "Week",
    shortLabel: "Week",
    icon: "week" as IconName,
  },
  {
    href: "/schedule",
    label: "Schedule",
    shortLabel: "Schedule",
    icon: "schedule" as IconName,
  },
  {
    href: "/recipes",
    label: "Recipes",
    shortLabel: "Recipes",
    icon: "recipes" as IconName,
  },
  {
    href: "/pantry",
    label: "Pantry",
    shortLabel: "Pantry",
    icon: "pantry" as IconName,
  },
  {
    href: "/shopping",
    label: "Shopping",
    shortLabel: "Shopping",
    icon: "shopping" as IconName,
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: "settings" as IconName,
  },
];

const protectedRoutes = [
  "/week",
  "/schedule",
  "/recipes",
  "/pantry",
  "/shopping",
  "/settings",
  "/account",
];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`),
  );
}

function AuthenticationRequired() {
  return (
    <section className="auth-required-page">
      <div className="auth-required-card">
        <span className="brand-mark">MP</span>

        <div>
          <p className="eyebrow">Account required</p>
          <h1>Log in to continue</h1>

          <p>
            Public recipes are shared across the community.
            Your favorites, customizations, weekly plans, pantry,
            and shopping list stay tied to your account.
          </p>
        </div>

        <div className="auth-required-actions">
          <Link
            className="primary-button auth-required-button"
            href="/login?mode=login"
          >
            Log in
          </Link>

          <Link
            className="secondary-button auth-required-button"
            href="/login?mode=signup"
          >
            Sign up
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false);

  useEffect(() => {
    const savedState = window.localStorage.getItem(
      "meal-planner-sidebar-collapsed",
    );

    setIsSidebarCollapsed(savedState === "true");
  }, []);

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;

      window.localStorage.setItem(
        "meal-planner-sidebar-collapsed",
        String(next),
      );

      return next;
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(
          "Could not load authenticated user:",
          error,
        );
      }

      setUser(currentUser ?? null);
      setAuthLoading(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) {
          return;
        }

        setUser(session?.user ?? null);
        setAuthLoading(false);
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error("Could not sign out:", error);
      setIsSigningOut(false);
      return;
    }

    setUser(null);

    for (const key of Object.keys(window.localStorage)) {
      if (
        key.startsWith("meal-planner-") &&
        key !== "meal-planner-sidebar-collapsed"
      ) {
        window.localStorage.removeItem(key);
      }
    }

    window.sessionStorage.clear();
    window.location.replace("/login?mode=login");
  }

  const isLoginPage = pathname === "/login";
  const routeRequiresAuthentication =
    isProtectedRoute(pathname);

  if (isLoginPage) {
    return <main className="standalone-page">{children}</main>;
  }

  const pageContent = authLoading ? (
    <section className="auth-checking-page">
      <div className="auth-checking-card">
        <span className="brand-mark">MP</span>
        <p>Checking your account…</p>
      </div>
    </section>
  ) : routeRequiresAuthentication && !user ? (
    <AuthenticationRequired />
  ) : (
    children
  );

  return (
    <div
      className={
        isSidebarCollapsed
          ? "app-shell sidebar-collapsed"
          : "app-shell"
      }
    >
      <aside className="sidebar">
        <div className="sidebar-top-row">
          <Link href="/" className="brand-link">
            <span className="brand-mark">MP</span>

            <span className="brand-copy">
              <strong>Meal Planner</strong>
              <small>Plan, cook, shop</small>
            </span>
          </Link>

          <button
            aria-label={
              isSidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className="sidebar-collapse-button"
            onClick={toggleSidebar}
            title={
              isSidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            type="button"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isSidebarCollapsed ? (
                <path d="m9 18 6-6-6-6" />
              ) : (
                <path d="m15 18-6-6 6-6" />
              )}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                className={
                  isActive
                    ? "sidebar-nav-link active"
                    : "sidebar-nav-link"
                }
                href={item.href}
                key={item.href}
                title={
                  isSidebarCollapsed ? item.label : undefined
                }
              >
                <span className="sidebar-nav-icon">
                  <AppIcon name={item.icon} />
                </span>

                <span className="sidebar-nav-label">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-auth">
          {authLoading ? (
            <p className="auth-loading-text">
              Checking account…
            </p>
          ) : user ? (
            <div className="signed-in-panel">
              <Link
                className={
                  pathname.startsWith("/account")
                    ? "sidebar-user-icon active"
                    : "sidebar-user-icon"
                }
                href="/account"
                title="Account settings"
                aria-label="Open account settings"
              >
                <AppIcon name="user" size={20} />
              </Link>

              <div className="signed-in-details">
                <span>Signed in as</span>

                <strong title={user.email}>
                  {user.email ?? "Authenticated user"}
                </strong>
              </div>

              <button
                className="secondary-button auth-full-width"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <div className="auth-button-stack">
              <Link
                className="secondary-button auth-link-button"
                href="/login?mode=login"
              >
                Log in
              </Link>

              <Link
                className="primary-button auth-link-button"
                href="/login?mode=signup"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </aside>

      <div className="app-content">
        <header className="mobile-topbar">
          <Link href="/" className="mobile-brand">
            <span className="brand-mark">MP</span>
            <strong>Meal Planner</strong>
          </Link>

          <div className="mobile-auth-actions">
            {authLoading ? null : user ? (
              <>
                <Link
                  className="mobile-account-link"
                  href="/account"
                  aria-label="Open account settings"
                  title="Account settings"
                >
                  <AppIcon name="user" size={19} />
                </Link>

                <button
                  className="text-button"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  type="button"
                >
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  className="text-button auth-header-link"
                  href="/login?mode=login"
                >
                  Log in
                </Link>

                <Link
                  className="primary-button compact-auth-button"
                  href="/login?mode=signup"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="page-content">{pageContent}</main>
      </div>

      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile navigation"
      >
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              className={
                isActive
                  ? "mobile-nav-link active"
                  : "mobile-nav-link"
              }
              href={item.href}
              key={item.href}
            >
              <span className="mobile-nav-icon">
                <AppIcon name={item.icon} size={18} />
              </span>
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
