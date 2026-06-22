"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  cloneUserSettings,
  dayKeys,
  dayLabels,
  defaultUserSettings,
  makeMealSlotId,
  mealCategoryLabels,
  normalizeUserSettings,
  preparationModeLabels,
  resolveDaySettings,
  type DayKey,
  type DaySettings,
  type MealCategory,
  type MealSlotSetting,
  type PreparationMode,
  type UserSettings,
} from "@/lib/user-settings";

function cloneMealSlots(slots: MealSlotSetting[]) {
  return slots.map((slot) => ({ ...slot }));
}

function settingsSnapshot(value: UserSettings) {
  return JSON.stringify(normalizeUserSettings(value));
}


function timeToMinutes(value: string | null) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function validateSettings(settings: UserSettings) {
  const errors: string[] = [];

  for (const day of dayKeys) {
    const resolved = resolveDaySettings(settings, day);
    const earliest = timeToMinutes(resolved.earliest_task_time);
    const latest = timeToMinutes(resolved.latest_task_time);
    const eveningStart = timeToMinutes(resolved.evening_prep_start);
    const eveningEnd = timeToMinutes(resolved.evening_prep_end);

    if (earliest === null || latest === null || earliest >= latest) {
      errors.push(`${dayLabels[day]}: earliest task time must be before latest task time.`);
    }

    if (eveningStart === null || eveningEnd === null || eveningStart >= eveningEnd) {
      errors.push(`${dayLabels[day]}: evening prep start must be before evening prep end.`);
    }

    if (resolved.max_active_minutes < 0) {
      errors.push(`${dayLabels[day]}: maximum active cooking cannot be negative.`);
    }

    const ids = new Set<string>();

    for (const slot of resolved.meal_slots) {
      if (!slot.name.trim()) {
        errors.push(`${dayLabels[day]}: every meal slot needs a name.`);
      }

      if (ids.has(slot.id)) {
        errors.push(`${dayLabels[day]}: meal slot IDs must be unique.`);
      }
      ids.add(slot.id);

      const eatAt = timeToMinutes(slot.time);
      const readyBy = timeToMinutes(slot.ready_by_time);

      if (eatAt === null || readyBy === null) {
        errors.push(`${dayLabels[day]}: ${slot.name || "meal slot"} needs valid times.`);
      }

      if (slot.preparation_mode === "fresh" && eatAt !== readyBy) {
        errors.push(`${dayLabels[day]}: fresh ${slot.name || "meal"} should be ready at its eating time.`);
      }
    }
  }

  return Array.from(new Set(errors));
}

function newMealSlot(position: number): MealSlotSetting {
  return {
    id: makeMealSlotId(`meal-${position + 1}`),
    name: `Meal ${position + 1}`,
    meal_type: "any",
    time: "12:00",
    ready_by_time: "12:00",
    preparation_mode: "fresh",
    position,
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(() =>
    cloneUserSettings(defaultUserSettings),
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    settingsSnapshot(defaultUserSettings),
  );
  const allowNavigationRef = useRef(false);
  const [selectedDay, setSelectedDay] = useState<DayKey>("monday");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  const currentSnapshot = useMemo(() => settingsSnapshot(settings), [settings]);

  const hasUnsavedChanges = !isLoading && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges || allowNavigationRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!hasUnsavedChanges || allowNavigationRef.current) {
        return;
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;

      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash
      ) {
        return;
      }

      const confirmed = window.confirm(
        "You have unsaved settings changes. Leave without saving?",
      );

      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      allowNavigationRef.current = true;
    }

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

  async function getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  }

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Please log in to edit settings.");
      }

      const { data, error } = await supabase
        .from("user_settings")
        .select(
          `
          conflict_grouping_minutes,
          preferred_batch_day,
          preferred_batch_days,
          preserve_manual_tasks,
          day_settings
        `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        const defaults = cloneUserSettings(defaultUserSettings);
        setSettings(defaults);
        setSavedSnapshot(settingsSnapshot(defaults));
        setMessage(
          "Using the default schedule. Save to create your settings profile.",
        );
        return;
      }

      const loadedSettings = normalizeUserSettings({
        conflict_grouping_minutes: data.conflict_grouping_minutes,
        preferred_batch_day: data.preferred_batch_day,
        preferred_batch_days: data.preferred_batch_days,
        preserve_manual_tasks: data.preserve_manual_tasks,
        day_settings: data.day_settings,
      });

      setSettings(loadedSettings);
      setSavedSnapshot(settingsSnapshot(loadedSettings));
      setMessage("Settings loaded.");
    } catch (error) {
      console.error("Could not load settings:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSettings() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("Please log in to save settings.");
      }

      const normalized = normalizeUserSettings(settings);
      const validationErrors = validateSettings(normalized);

      if (validationErrors.length > 0) {
        throw new Error(validationErrors[0]);
      }

      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          conflict_grouping_minutes: normalized.conflict_grouping_minutes,
          preferred_batch_day:
            normalized.preferred_batch_days[0] ?? "sunday",
          preferred_batch_days: normalized.preferred_batch_days,
          preserve_manual_tasks: normalized.preserve_manual_tasks,
          day_settings: normalized.day_settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        throw error;
      }

      setSettings(normalized);
      setSavedSnapshot(settingsSnapshot(normalized));
      allowNavigationRef.current = false;
      setMessage("Settings saved. Regenerate a future schedule to apply them.");
    } catch (error) {
      console.error("Could not save settings:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function resetSettings() {
    const confirmed = window.confirm("Reset all settings to the defaults?");

    if (!confirmed) {
      return;
    }

    setSettings(cloneUserSettings(defaultUserSettings));
    setSelectedDay("monday");
    setMessage("Defaults restored locally. Press Save settings to keep them.");
  }

  function updateGlobal<Key extends keyof UserSettings>(
    key: Key,
    value: UserSettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateDay(day: DayKey, patch: Partial<DaySettings>) {
    setSettings((current) => ({
      ...current,
      day_settings: {
        ...current.day_settings,
        [day]: {
          ...current.day_settings[day],
          ...patch,
        },
      },
    }));
  }

  function setInheritance(day: DayKey, checked: boolean) {
    const source: DayKey = day === "sunday" ? "saturday" : "monday";

    setSettings((current) => {
      const copied = resolveDaySettings(current, source);

      return {
        ...current,
        day_settings: {
          ...current.day_settings,
          [day]: checked
            ? {
                ...copied,
                inherits_from: source,
              }
            : {
                ...copied,
                inherits_from: null,
              },
        },
      };
    });
  }

  function updateMealSlot(
    day: DayKey,
    slotId: string,
    patch: Partial<MealSlotSetting>,
  ) {
    const daySettings = settings.day_settings[day];
    const meal_slots = daySettings.meal_slots.map((slot) =>
      slot.id === slotId ? { ...slot, ...patch } : slot,
    );

    updateDay(day, { meal_slots });
  }

  function addMealSlot(day: DayKey) {
    const current = settings.day_settings[day].meal_slots;
    updateDay(day, {
      meal_slots: [...current, newMealSlot(current.length)],
    });
  }

  function removeMealSlot(day: DayKey, slotId: string) {
    const current = settings.day_settings[day].meal_slots;

    if (current.length <= 1) {
      setErrorMessage("Each day must have at least one meal slot.");
      return;
    }

    const slot = current.find((item) => item.id === slotId);
    const confirmed = window.confirm(
      `Remove ${slot?.name ?? "this meal slot"}? Future weekly plans using this slot will no longer show it in the planner.`,
    );

    if (!confirmed) {
      return;
    }

    updateDay(day, {
      meal_slots: current
        .filter((slot) => slot.id !== slotId)
        .map((slot, position) => ({ ...slot, position })),
    });
  }

  function moveMealSlot(day: DayKey, slotId: string, direction: -1 | 1) {
    const current = cloneMealSlots(settings.day_settings[day].meal_slots);
    const index = current.findIndex((slot) => slot.id === slotId);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= current.length) {
      return;
    }

    [current[index], current[target]] = [current[target], current[index]];

    updateDay(day, {
      meal_slots: current.map((slot, position) => ({ ...slot, position })),
    });
  }

  const selectedSettings = resolveDaySettings(settings, selectedDay);
  const sourceDay = selectedDay === "sunday" ? "saturday" : "monday";
  const canInherit = !["monday", "saturday"].includes(selectedDay);
  const inheritedFrom = settings.day_settings[selectedDay].inherits_from;
  const isInherited = inheritedFrom !== null;

  const totalMealSlots = useMemo(
    () =>
      dayKeys.reduce(
        (total, day) =>
          total + resolveDaySettings(settings, day).meal_slots.length,
        0,
      ),
    [settings],
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Scheduling preferences</p>
          <h1>Settings</h1>
          <p className="subtitle">
            Define your normal availability and exactly which meals or snacks
            appear on each day. Future schedules use the latest saved settings
            whenever you regenerate them.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={isLoading || isSaving || !hasUnsavedChanges}
          onClick={saveSettings}
          type="button"
        >
          {isSaving ? "Saving…" : hasUnsavedChanges ? "Save changes" : "Saved"}
        </button>
      </header>

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {message ? <p className="schedule-message">{message}</p> : null}

      {hasUnsavedChanges ? (
        <p className="schedule-warning" role="status">
          <strong>Unsaved changes</strong>
          <span>Your settings differ from the last saved version.</span>
        </p>
      ) : null}

      <section className="settings-summary-grid">
        <article className="schedule-summary-card">
          <span>Configured meal slots</span>
          <strong>{totalMealSlots}</strong>
          <small>Across all seven resolved days</small>
        </article>

        <article className="schedule-summary-card">
          <span>Conflict grouping</span>
          <strong>{settings.conflict_grouping_minutes}</strong>
          <small>Minutes per practical kitchen session</small>
        </article>

        <article className="schedule-summary-card">
          <span>Batch cooking days</span>
          <strong>{settings.preferred_batch_days.length}</strong>
          <small>
            {settings.preferred_batch_days.length > 0
              ? settings.preferred_batch_days
                  .map((day) => dayLabels[day].slice(0, 3))
                  .join(", ")
              : "None selected"}
          </small>
        </article>
      </section>

      <section className="panel settings-global-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Global behavior</p>
            <h2>Scheduler defaults</h2>
          </div>

          <button
            className="text-button danger-text"
            onClick={resetSettings}
            type="button"
          >
            Reset defaults
          </button>
        </div>

        <div className="settings-global-grid">
          <label className="form-field">
            <span>Conflict grouping window</span>
            <select
              value={settings.conflict_grouping_minutes}
              onChange={(event) =>
                updateGlobal(
                  "conflict_grouping_minutes",
                  Number(event.target.value),
                )
              }
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </label>

          <fieldset className="settings-batch-days-fieldset">
            <legend>Preferred batch-cooking days</legend>
            <div className="settings-batch-days-grid">
              {dayKeys.map((day) => (
                <label className="checkbox-field" key={day}>
                  <input
                    checked={settings.preferred_batch_days.includes(day)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? Array.from(
                            new Set([
                              ...settings.preferred_batch_days,
                              day,
                            ]),
                          )
                        : settings.preferred_batch_days.filter(
                            (selected) => selected !== day,
                          );

                      updateGlobal("preferred_batch_days", next);
                    }}
                    type="checkbox"
                  />
                  <span>{dayLabels[day]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="checkbox-field settings-preserve-check">
            <input
              checked={settings.preserve_manual_tasks}
              onChange={(event) =>
                updateGlobal("preserve_manual_tasks", event.target.checked)
              }
              type="checkbox"
            />
            <span>Preserve manually adjusted tasks when regenerating</span>
          </label>
        </div>
      </section>

      <section className="panel settings-days-panel">
        <div
          className="settings-day-tabs"
          role="tablist"
          aria-label="Day settings"
        >
          {dayKeys.map((day) => (
            <button
              className={
                selectedDay === day
                  ? "settings-day-tab active"
                  : "settings-day-tab"
              }
              key={day}
              onClick={() => setSelectedDay(day)}
              type="button"
            >
              {dayLabels[day].slice(0, 3)}
              {settings.day_settings[day].inherits_from ? (
                <small>Linked</small>
              ) : null}
            </button>
          ))}
        </div>

        <div className="settings-day-content">
          <div className="settings-day-header">
            <div>
              <p className="eyebrow">Day schedule</p>
              <h2>{dayLabels[selectedDay]}</h2>
            </div>

            {canInherit ? (
              <label className="checkbox-field settings-inherit-check">
                <input
                  checked={isInherited}
                  onChange={(event) =>
                    setInheritance(selectedDay, event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Same as {dayLabels[sourceDay]}</span>
              </label>
            ) : null}
          </div>

          {isInherited ? (
            <p className="settings-linked-message">
              This day mirrors {dayLabels[sourceDay]}. Uncheck the box to make
              independent changes.
            </p>
          ) : null}

          <fieldset
            className="settings-fieldset"
            disabled={isInherited || isLoading}
          >
            <legend>Availability</legend>

            <div className="settings-time-grid">
              <label className="form-field">
                <span>Earliest task</span>
                <input
                  type="time"
                  value={selectedSettings.earliest_task_time}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      earliest_task_time: event.target.value,
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Latest task</span>
                <input
                  type="time"
                  value={selectedSettings.latest_task_time}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      latest_task_time: event.target.value,
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Leave home</span>
                <input
                  type="time"
                  value={selectedSettings.leave_home_time ?? ""}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      leave_home_time: event.target.value || null,
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Return home</span>
                <input
                  type="time"
                  value={selectedSettings.return_home_time ?? ""}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      return_home_time: event.target.value || null,
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Evening prep starts</span>
                <input
                  type="time"
                  value={selectedSettings.evening_prep_start}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      evening_prep_start: event.target.value,
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Evening prep ends</span>
                <input
                  type="time"
                  value={selectedSettings.evening_prep_end}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      evening_prep_end: event.target.value,
                    })
                  }
                />
              </label>

              <label className="form-field">
                <span>Maximum active cooking</span>
                <input
                  min={0}
                  step={5}
                  type="number"
                  value={selectedSettings.max_active_minutes}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      max_active_minutes: Math.max(
                        0,
                        Number(event.target.value),
                      ),
                    })
                  }
                />
              </label>

              <label className="checkbox-field settings-cooking-check">
                <input
                  checked={selectedSettings.cooking_allowed}
                  onChange={(event) =>
                    updateDay(selectedDay, {
                      cooking_allowed: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>Cooking is allowed on this day</span>
              </label>
            </div>
          </fieldset>

          <fieldset
            className="settings-fieldset"
            disabled={isInherited || isLoading}
          >
            <div className="settings-meal-heading">
              <div>
                <legend>Meal and snack slots</legend>
                <p>
                  Add as many slots as needed, including 11 AM and 5 PM snacks.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={() => addMealSlot(selectedDay)}
                type="button"
              >
                Add meal slot
              </button>
            </div>

            <div className="settings-meal-list">
              {selectedSettings.meal_slots.map((slot, index) => (
                <article className="settings-meal-card" key={slot.id}>
                  <div className="settings-meal-card-heading">
                    <strong>Slot {index + 1}</strong>
                    <div className="settings-meal-card-actions">
                      <button
                        aria-label="Move meal earlier"
                        className="settings-icon-button"
                        disabled={index === 0}
                        onClick={() => moveMealSlot(selectedDay, slot.id, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label="Move meal later"
                        className="settings-icon-button"
                        disabled={
                          index === selectedSettings.meal_slots.length - 1
                        }
                        onClick={() => moveMealSlot(selectedDay, slot.id, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => removeMealSlot(selectedDay, slot.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="settings-meal-grid">
                    <label className="form-field">
                      <span>Name</span>
                      <input
                        value={slot.name}
                        onChange={(event) =>
                          updateMealSlot(selectedDay, slot.id, {
                            name: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>Recipe category</span>
                      <select
                        value={slot.meal_type}
                        onChange={(event) =>
                          updateMealSlot(selectedDay, slot.id, {
                            meal_type: event.target.value as MealCategory,
                          })
                        }
                      >
                        {Object.entries(mealCategoryLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>Eat at</span>
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(event) =>
                          updateMealSlot(selectedDay, slot.id, {
                            time: event.target.value,
                            ready_by_time:
                              slot.preparation_mode === "fresh"
                                ? event.target.value
                                : slot.ready_by_time,
                          })
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>Ready by</span>
                      <input
                        type="time"
                        value={slot.ready_by_time}
                        onChange={(event) =>
                          updateMealSlot(selectedDay, slot.id, {
                            ready_by_time: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="form-field settings-preparation-field">
                      <span>Preparation mode</span>
                      <select
                        value={slot.preparation_mode}
                        onChange={(event) =>
                          updateMealSlot(selectedDay, slot.id, {
                            preparation_mode: event.target
                              .value as PreparationMode,
                          })
                        }
                      >
                        {Object.entries(preparationModeLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </fieldset>
        </div>
      </section>
    </>
  );
}
