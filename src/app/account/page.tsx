"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type TimeFormat = "12h" | "24h";
type MeasurementSystem = "metric" | "us";
type WeekStartsOn = "monday" | "sunday";
type DefaultRecipeTab = "discover" | "favorites" | "mine";

type AccountForm = {
  displayName: string;
  avatarUrl: string;
  bio: string;
  publicProfileEnabled: boolean;
  showAvatarPublicly: boolean;
  timeFormat: TimeFormat;
  measurementSystem: MeasurementSystem;
  weekStartsOn: WeekStartsOn;
  defaultRecipeTab: DefaultRecipeTab;
};

const DEFAULT_FORM: AccountForm = {
  displayName: "",
  avatarUrl: "",
  bio: "",
  publicProfileEnabled: true,
  showAvatarPublicly: true,
  timeFormat: "12h",
  measurementSystem: "metric",
  weekStartsOn: "monday",
  defaultRecipeTab: "discover",
};

function normalizeForm(form: AccountForm): AccountForm {
  return {
    ...form,
    displayName: form.displayName.trim(),
    avatarUrl: form.avatarUrl.trim(),
    bio: form.bio.trim(),
  };
}

function serializeForm(form: AccountForm) {
  return JSON.stringify(normalizeForm(form));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<AccountForm>(DEFAULT_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState(
    serializeForm(DEFAULT_FORM),
  );
  const [emailInput, setEmailInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isDirty = useMemo(
    () => serializeForm(form) !== savedSnapshot,
    [form, savedSnapshot],
  );

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!currentUser) {
        router.replace("/login?mode=login");
        return;
      }

      setUser(currentUser);
      setEmailInput(currentUser.email ?? "");

      const [
        { data: profile, error: profileError },
        { data: preferences, error: preferencesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, avatar_url, bio, public_profile_enabled, show_avatar_publicly",
          )
          .eq("user_id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("account_preferences")
          .select(
            "time_format, measurement_system, week_starts_on, default_recipe_tab",
          )
          .eq("user_id", currentUser.id)
          .maybeSingle(),
      ]);

      if (profileError) throw profileError;
      if (preferencesError) throw preferencesError;

      const nextForm: AccountForm = normalizeForm({
        ...DEFAULT_FORM,
        displayName:
          profile?.display_name ??
          currentUser.user_metadata?.full_name ??
          currentUser.user_metadata?.name ??
          currentUser.email?.split("@")[0] ??
          "",
        avatarUrl: profile?.avatar_url ?? "",
        bio: profile?.bio ?? "",
        publicProfileEnabled: profile?.public_profile_enabled ?? true,
        showAvatarPublicly: profile?.show_avatar_publicly ?? true,
        timeFormat:
          (preferences?.time_format as TimeFormat | undefined) ?? "12h",
        measurementSystem:
          (preferences?.measurement_system as MeasurementSystem | undefined) ??
          "metric",
        weekStartsOn:
          (preferences?.week_starts_on as WeekStartsOn | undefined) ?? "monday",
        defaultRecipeTab:
          (preferences?.default_recipe_tab as DefaultRecipeTab | undefined) ??
          "discover",
      });

      setForm(nextForm);
      setSavedSnapshot(serializeForm(nextForm));
    } catch (error) {
      console.error("Could not load account settings:", error);
      setErrorMessage(
        getErrorMessage(error, "Could not load your account settings."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname) return;

      const shouldLeave = window.confirm(
        "You have unsaved account changes. Leave without saving?",
      );

      if (!shouldLeave) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () =>
      document.removeEventListener("click", handleDocumentClick, true);
  }, [isDirty]);

  function updateForm<K extends keyof AccountForm>(
    key: K,
    value: AccountForm[K],
  ) {
    setMessage("");
    setErrorMessage("");
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !isDirty) return;

    const normalized = normalizeForm(form);
    if (!normalized.displayName) {
      setErrorMessage("Display name is required.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          display_name: normalized.displayName,
          avatar_url: normalized.avatarUrl || null,
          bio: normalized.bio || null,
          public_profile_enabled: normalized.publicProfileEnabled,
          show_avatar_publicly: normalized.showAvatarPublicly,
        },
        { onConflict: "user_id" },
      );

      if (profileError) throw profileError;

      const { error: preferencesError } = await supabase
        .from("account_preferences")
        .upsert(
          {
            user_id: user.id,
            time_format: normalized.timeFormat,
            measurement_system: normalized.measurementSystem,
            week_starts_on: normalized.weekStartsOn,
            default_recipe_tab: normalized.defaultRecipeTab,
          },
          { onConflict: "user_id" },
        );

      if (preferencesError) throw preferencesError;

      const { error: authMetadataError } = await supabase.auth.updateUser({
        data: {
          full_name: normalized.displayName,
          avatar_url: normalized.avatarUrl || null,
        },
      });

      if (authMetadataError) throw authMetadataError;

      // Existing recipe cards currently store creator_name as a snapshot.
      // Keep all recipes owned by this user synchronized with the profile name.
      const { error: recipeNameError } = await supabase
        .from("recipes")
        .update({ creator_name: normalized.displayName })
        .eq("user_id", user.id);

      if (recipeNameError) throw recipeNameError;

      setForm(normalized);
      setSavedSnapshot(serializeForm(normalized));
      setMessage("Account settings saved.");
    } catch (error) {
      console.error("Could not save account settings:", error);
      setErrorMessage(
        getErrorMessage(error, "Could not save your account settings."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const nextEmail = emailInput.trim().toLowerCase();
    if (!nextEmail || nextEmail === user.email?.toLowerCase()) return;

    setIsUpdatingEmail(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;

      setMessage(
        "Verification links were sent as required. Your email changes after confirmation.",
      );
    } catch (error) {
      console.error("Could not update email:", error);
      setErrorMessage(getErrorMessage(error, "Could not update your email."));
    } finally {
      setIsUpdatingEmail(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setErrorMessage("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    setIsUpdatingPassword(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (error) {
      console.error("Could not update password:", error);
      setErrorMessage(
        getErrorMessage(error, "Could not update your password."),
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function handleSignOut() {
    if (isDirty) {
      const shouldSignOut = window.confirm(
        "You have unsaved account changes. Sign out without saving?",
      );
      if (!shouldSignOut) return;
    }

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      setIsSigningOut(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (isLoading) {
    return (
      <section className="account-page page-section">
        <div className="account-loading-card">Loading account settings…</div>
      </section>
    );
  }

  const avatarLetter = form.displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <section className="account-page page-section">
      <header className="account-hero">
        <div className="account-hero-copy">
          <p className="eyebrow">Account</p>
          <h1>Account settings</h1>
          <p>
            Manage your public recipe identity, sign-in details, and app
            preferences.
          </p>
        </div>

        <div className="account-save-cluster">
          <span
            className={`account-save-state ${isDirty ? "is-dirty" : "is-saved"}`}
          >
            <span aria-hidden="true" />
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button
            className="primary-button account-save-button"
            disabled={!isDirty || isSaving}
            form="account-profile-form"
            type="submit"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      {message ? (
        <p className="status-message success-message">{message}</p>
      ) : null}
      {errorMessage ? (
        <p className="status-message error-message">{errorMessage}</p>
      ) : null}

      <div className="account-layout">
        <aside className="account-summary-card">
          <div className="account-avatar-large" aria-hidden="true">
            {form.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.avatarUrl} alt="" />
            ) : (
              <span>{avatarLetter}</span>
            )}
          </div>
          <div className="account-summary-copy">
            <strong>{form.displayName.trim() || "Your display name"}</strong>
            <span>{user?.email}</span>
            <p>This is how you appear on public recipes.</p>
          </div>
          <div className="account-visibility-pill">
            {form.publicProfileEnabled
              ? "Public profile enabled"
              : "Public profile hidden"}
          </div>
        </aside>

        <div className="account-content-stack">
          <form
            id="account-profile-form"
            onSubmit={handleSave}
            className="account-form-stack"
          >
            <article className="account-panel">
              <div className="account-panel-header">
                <div>
                  <p className="eyebrow">Public profile</p>
                  <h2>Creator identity</h2>
                  <p>Shown alongside recipes you publish.</p>
                </div>
              </div>

              <div className="account-form-grid account-form-grid-profile">
                <label className="field-label">
                  <span>Display name</span>
                  <input
                    value={form.displayName}
                    onChange={(event) =>
                      updateForm("displayName", event.target.value)
                    }
                    maxLength={80}
                    required
                  />
                </label>

                <label className="field-label">
                  <span>Avatar image URL</span>
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(event) =>
                      updateForm("avatarUrl", event.target.value)
                    }
                    placeholder="https://…"
                  />
                </label>

                <label className="field-label account-field-full">
                  <span>Creator bio</span>
                  <textarea
                    value={form.bio}
                    onChange={(event) => updateForm("bio", event.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder="A short introduction shown with your public recipes."
                  />
                  <small>{form.bio.length}/300</small>
                </label>
              </div>

              <div className="account-toggle-list">
                <label className="account-toggle-row">
                  <span>
                    <strong>Enable public creator profile</strong>
                    <small>
                      Your public recipes remain visible even when this profile
                      is hidden.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.publicProfileEnabled}
                    onChange={(event) =>
                      updateForm("publicProfileEnabled", event.target.checked)
                    }
                  />
                </label>

                <label className="account-toggle-row">
                  <span>
                    <strong>Show avatar publicly</strong>
                    <small>
                      Your email address is never displayed publicly.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.showAvatarPublicly}
                    onChange={(event) =>
                      updateForm("showAvatarPublicly", event.target.checked)
                    }
                  />
                </label>
              </div>
            </article>

            <article className="account-panel">
              <div className="account-panel-header">
                <div>
                  <p className="eyebrow">Preferences</p>
                  <h2>App experience</h2>
                  <p>
                    Choose how the app displays time, units, and navigation
                    defaults.
                  </p>
                </div>
              </div>

              <div className="account-form-grid">
                <label className="field-label">
                  <span>Time format</span>
                  <select
                    value={form.timeFormat}
                    onChange={(event) =>
                      updateForm("timeFormat", event.target.value as TimeFormat)
                    }
                  >
                    <option value="12h">12-hour</option>
                    <option value="24h">24-hour</option>
                  </select>
                </label>

                <label className="field-label">
                  <span>Measurement system</span>
                  <select
                    value={form.measurementSystem}
                    onChange={(event) =>
                      updateForm(
                        "measurementSystem",
                        event.target.value as MeasurementSystem,
                      )
                    }
                  >
                    <option value="metric">Metric</option>
                    <option value="us">US customary</option>
                  </select>
                </label>

                <label className="field-label">
                  <span>Week starts on</span>
                  <select
                    value={form.weekStartsOn}
                    onChange={(event) =>
                      updateForm(
                        "weekStartsOn",
                        event.target.value as WeekStartsOn,
                      )
                    }
                  >
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </label>

                <label className="field-label account-field-full">
                  <span>Default Recipes tab</span>
                  <select
                    value={form.defaultRecipeTab}
                    onChange={(event) =>
                      updateForm(
                        "defaultRecipeTab",
                        event.target.value as DefaultRecipeTab,
                      )
                    }
                  >
                    <option value="discover">Discover</option>
                    <option value="favorites">Favorites</option>
                    <option value="mine">My recipes</option>
                  </select>
                </label>
              </div>
            </article>
          </form>

          <div className="account-security-grid">
            <form className="account-panel" onSubmit={handleEmailChange}>
              <div className="account-panel-header compact">
                <div>
                  <p className="eyebrow">Sign-in</p>
                  <h2>Email address</h2>
                  <p>Changing your email requires verification.</p>
                </div>
              </div>

              <label className="field-label">
                <span>Email</span>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  required
                />
              </label>

              <button
                className="secondary-button account-action-button"
                disabled={
                  isUpdatingEmail ||
                  !emailInput.trim() ||
                  emailInput.trim().toLowerCase() === user?.email?.toLowerCase()
                }
                type="submit"
              >
                {isUpdatingEmail ? "Requesting change…" : "Change email"}
              </button>
            </form>

            <form className="account-panel" onSubmit={handlePasswordChange}>
              <div className="account-panel-header compact">
                <div>
                  <p className="eyebrow">Security</p>
                  <h2>Change password</h2>
                  <p>Use at least eight characters.</p>
                </div>
              </div>

              <label className="field-label">
                <span>New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>

              <label className="field-label">
                <span>Confirm new password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>

              <button
                className="secondary-button account-action-button"
                disabled={
                  isUpdatingPassword || !newPassword || !confirmPassword
                }
                type="submit"
              >
                {isUpdatingPassword ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>

          <article className="account-panel account-session-card">
            <div>
              <p className="eyebrow">Session</p>
              <h2>Signed in on this device</h2>
              <p>{user?.email}</p>
            </div>

            <button
              className="secondary-button"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
