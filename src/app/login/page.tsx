"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(
      window.location.search,
    );

    const requestedMode = searchParams.get("mode");

    if (requestedMode === "signup") {
      setMode("signup");
    } else {
      setMode("login");
    }

    void redirectAuthenticatedUser();
  }, []);

  async function redirectAuthenticatedUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      router.replace("/week");
      router.refresh();
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setIsError(false);

    const url =
      nextMode === "signup"
        ? "/login?mode=signup"
        : "/login?mode=login";

    window.history.replaceState({}, "", url);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setIsError(true);
      setMessage("Enter your email address.");
      return;
    }

    if (password.length < 6) {
      setIsError(true);
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setIsError(false);

    try {
      if (mode === "signup") {
        const emailRedirectTo = `${window.location.origin}/week`;

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo,
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          router.push("/week");
          router.refresh();
          return;
        }

        setMessage(
          "Account created. Check your email and open the confirmation link before logging in.",
        );

        setPassword("");
        return;
      }

      const { error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (error) {
        throw error;
      }

      router.push("/week");
      router.refresh();
    } catch (error) {
      console.error("Authentication error:", error);

      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">
          <span className="brand-mark">MP</span>

          <span>
            <strong>Meal Planner</strong>
            <small>Plan, cook, shop</small>
          </span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">Your account</p>

          <h1>
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p>
            {mode === "login"
              ? "Log in to access your recipes and synchronized weekly plans."
              : "Create an account to keep your recipes and plans synchronized across devices."}
          </p>
        </div>

        <div className="auth-mode-tabs">
          <button
            className={
              mode === "login"
                ? "auth-mode-tab active"
                : "auth-mode-tab"
            }
            onClick={() => switchMode("login")}
            type="button"
          >
            Log in
          </button>

          <button
            className={
              mode === "signup"
                ? "auth-mode-tab active"
                : "auth-mode-tab"
            }
            onClick={() => switchMode("signup")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email address</span>

            <input
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Password</span>

            <input
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={6}
              placeholder="At least 6 characters"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {message ? (
            <p
              className={
                isError
                  ? "form-error auth-message"
                  : "auth-success-message"
              }
              role={isError ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          <button
            className="primary-button auth-submit-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? mode === "login"
                ? "Logging in…"
                : "Creating account…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="auth-switch-text">
          {mode === "login"
            ? "Do not have an account?"
            : "Already have an account?"}{" "}
          <button
            className="inline-auth-button"
            onClick={() =>
              switchMode(
                mode === "login" ? "signup" : "login",
              )
            }
            type="button"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </section>
    </div>
  );
}