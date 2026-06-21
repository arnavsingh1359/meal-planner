"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type AppShellProps = {
  children: ReactNode;
};

const navigationItems = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Home",
  },
  {
    href: "/week",
    label: "Week",
    shortLabel: "Week",
  },
  {
    href: "/recipes",
    label: "Recipes",
    shortLabel: "Recipes",
  },
  {
    href: "/pantry",
    label: "Pantry",
    shortLabel: "Pantry",
  },
  {
    href: "/shopping",
    label: "Shopping",
    shortLabel: "Shopping",
  },
];

const protectedRoutes = [
  "/week",
  "/recipes",
  "/pantry",
  "/shopping",
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
            Your recipes, weekly plans, pantry, and
            shopping list are private and synchronized
            through your account.
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

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] =
    useState(false);

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

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Could not sign out:", error);
      setIsSigningOut(false);
      return;
    }

    setUser(null);
    setIsSigningOut(false);

    router.push("/");
    router.refresh();
  }

  const isLoginPage = pathname === "/login";
  const routeRequiresAuthentication =
    isProtectedRoute(pathname);

  if (isLoginPage) {
    return (
      <main className="standalone-page">
        {children}
      </main>
    );
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/" className="brand-link">
            <span className="brand-mark">MP</span>

            <span>
              <strong>Meal Planner</strong>
              <small>Plan, cook, shop</small>
            </span>
          </Link>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Main navigation"
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
                    ? "sidebar-nav-link active"
                    : "sidebar-nav-link"
                }
                href={item.href}
                key={item.href}
              >
                {item.label}
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
              <div className="signed-in-details">
                <span>Signed in as</span>

                <strong title={user.email}>
                  {user.email ??
                    "Authenticated user"}
                </strong>
              </div>

              <button
                className="secondary-button auth-full-width"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                {isSigningOut
                  ? "Signing out…"
                  : "Sign out"}
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
              <button
                className="text-button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                {isSigningOut
                  ? "Signing out…"
                  : "Sign out"}
              </button>
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

        <main className="page-content">
          {pageContent}
        </main>
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
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}