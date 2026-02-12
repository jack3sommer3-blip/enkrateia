"use client";

import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  DayData,
  ActivityType,
  WorkoutActivity,
  DrinkingEvent,
  ReadingEvent,
} from "@/lib/types";
import { computeScores } from "@/lib/scoring";
import { getDefaultGoalConfig, normalizeGoalConfig } from "@/lib/goals";
import {
  createDrinkingEvent,
  deleteDrinkingEvent,
  listDrinkingEvents,
  updateDrinkingEvent,
} from "@/lib/drinking";
import { deleteFeedItemByEvent, upsertFeedItem, updateFeedItemByEvent } from "@/lib/social";
import {
  clampInt,
  formatScore,
  intFromText,
  numFromText,
  textFromUnknown,
  todayKey,
  getWeekWindowFromKey,
} from "@/lib/utils";

function makeEmptyDailyLog(): DayData {
  return {
    workouts: { activities: [], stepsText: undefined },
    sleep: { hoursText: undefined, minutesText: undefined, restingHrText: undefined },
    diet: {
      cookedMealsText: undefined,
      restaurantMealsText: undefined,
      healthinessText: undefined,
      proteinText: undefined,
      waterOzText: undefined,
    },
    reading: {
      events: [],
      title: undefined,
      pagesText: undefined,
      fictionPagesText: undefined,
      nonfictionPagesText: undefined,
      note: undefined,
      quote: undefined,
    },
    community: {
      callsText: undefined,
      callsFriendsText: undefined,
      callsFamilyText: undefined,
      socialEventsText: undefined,
      note: undefined,
    },
  };
}

const DEBUG_DAILY_LOG = false;

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  isFutureDate?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(({ isFutureDate, ...props }, ref) => (
  <input
    {...props}
    ref={ref}
    type={props.type ?? "text"}
    disabled={isFutureDate || props.disabled}
    className={[
      "w-full px-3 py-2 rounded-md bg-black/40 border border-white/10",
      "focus:outline-none focus:ring-2 focus:ring-white/10",
      props.className ?? "",
    ].join(" ")}
  />
));
Input.displayName = "Input";

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  isFutureDate?: boolean;
};

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ isFutureDate, ...props }, ref) => (
    <textarea
      {...props}
      ref={ref}
      disabled={isFutureDate || props.disabled}
      className={[
        "w-full px-3 py-2 rounded-md bg-black/40 border border-white/10",
        "focus:outline-none focus:ring-2 focus:ring-white/10",
        props.className ?? "",
      ].join(" ")}
    />
  )
);
TextArea.displayName = "TextArea";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  isFutureDate?: boolean;
};

const Select = ({ isFutureDate, ...props }: SelectProps) => (
  <select
    {...props}
    disabled={isFutureDate || props.disabled}
    className={[
      "w-full px-3 py-2 rounded-md bg-black/40 border border-white/10",
      "focus:outline-none focus:ring-2 focus:ring-white/10",
      props.className ?? "",
    ].join(" ")}
  />
);

type CardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  earned: boolean;
  hint?: string;
  score: number;
};

// Root cause (Bug B): components defined inside render remounted inputs on every change.
const Card = ({ title, subtitle, children, earned, hint, score }: CardProps) => (
  <div
    className={[
      "p-6 rounded-md border transition command-surface",
      earned ? "border-[color:var(--accent-40)] bg-[color:var(--accent-10)]" : "",
    ].join(" ")}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xl font-semibold">{title}</div>
        {hint ? <div className="text-gray-500 mt-2 text-sm">{hint}</div> : null}
      </div>
      <div className="shrink-0">
        <div
          className={[
            "px-3 py-2 rounded-md border text-xs uppercase tracking-[0.3em] text-gray-300",
            earned
              ? "border-[color:var(--accent-60)] text-[color:var(--accent)] bg-[color:var(--accent-10)]"
              : "border-white/10 bg-black/40",
          ].join(" ")}
        >
          {Math.round(score)}/25
        </div>
      </div>
    </div>

    <div className="mt-5">{children}</div>
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-gray-400 text-sm mb-1">{children}</div>
);

type StepsInputProps = {
  value: string;
  onChange: (value: string) => void;
  isFutureDate: boolean;
  debug: boolean;
  dateKey: string;
};

const StepsInput = ({ value, onChange, isFutureDate, debug, dateKey }: StepsInputProps) => {
  useEffect(() => {
    if (!debug) return;
    console.debug("[DailyLog] StepsInput mount", { dateKey });
    return () => {
      console.debug("[DailyLog] StepsInput unmount", { dateKey });
    };
  }, [debug, dateKey]);

  return (
    <Input
      inputMode="numeric"
      placeholder="e.g., 8000"
      isFutureDate={isFutureDate}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
};

function id() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function splitHoursToParts(raw?: string) {
  if (!raw) return { hoursText: undefined, minutesText: undefined };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { hoursText: raw, minutesText: undefined };
  const hours = Math.trunc(n);
  const minutes = Math.round((n - hours) * 60);
  return {
    hoursText: String(hours),
    minutesText: String(clampInt(minutes, 0, 59)),
  };
}


function isValidWorkout(activity: WorkoutActivity) {
  const minutes = intFromText(activity.minutesText) ?? 0;
  const seconds = intFromText(activity.secondsText) ?? 0;
  const calories = intFromText(activity.caloriesText) ?? 0;
  const intensity = intFromText(activity.intensityText) ?? 0;
  return minutes > 0 || seconds > 0 || calories > 0 || intensity > 0;
}

function isValidReading(event: ReadingEvent) {
  const total =
    event.pages ?? (event.fictionPages ?? 0) + (event.nonfictionPages ?? 0);
  return (total ?? 0) > 0 || !!event.title;
}

function totalPagesForDay(data: DayData) {
  const events = data.reading.events ?? [];
  const eventPages = events.reduce((sum, event) => sum + (event.pages ?? 0), 0);
  const eventFiction = events.reduce((sum, event) => sum + (event.fictionPages ?? 0), 0);
  const eventNonfiction = events.reduce((sum, event) => sum + (event.nonfictionPages ?? 0), 0);
  const pagesRaw = intFromText(data.reading.pagesText) ?? 0;
  const fictionRaw = intFromText(data.reading.fictionPagesText) ?? 0;
  const nonfictionRaw = intFromText(data.reading.nonfictionPagesText) ?? 0;
  const fiction = fictionRaw || eventFiction;
  const nonfiction = nonfictionRaw || eventNonfiction;
  return pagesRaw || eventPages || fiction + nonfiction;
}

function isValidDrinking(drinks: number) {
  return drinks > 0;
}

function hasMeaningfulData(data: DayData, drinkingEvents: DrinkingEvent[]) {
  const steps = intFromText(data.workouts.stepsText) ?? 0;
  if (steps > 0) return true;
  if (data.workouts.activities.some(isValidWorkout)) return true;

  const sleepHours = numFromText(data.sleep.hoursText) ?? 0;
  const sleepMinutes = intFromText(data.sleep.minutesText) ?? 0;
  const resting = intFromText(data.sleep.restingHrText) ?? 0;
  if (sleepHours > 0 || sleepMinutes > 0 || resting > 0) return true;

  const cooked = intFromText(data.diet.cookedMealsText) ?? 0;
  const restaurant = intFromText(data.diet.restaurantMealsText) ?? 0;
  const health = numFromText(data.diet.healthinessText) ?? 0;
  const protein = intFromText(data.diet.proteinText) ?? 0;
  const water = intFromText(data.diet.waterOzText) ?? 0;
  if (cooked > 0 || restaurant > 0 || health > 0 || protein > 0 || water > 0)
    return true;

  const readingEvents = data.reading.events ?? [];
  if (readingEvents.some(isValidReading)) return true;
  if (data.reading.title || (intFromText(data.reading.pagesText) ?? 0) > 0) return true;

  const calls =
    intFromText(data.community?.callsFriendsText) ??
    intFromText(data.community?.callsText) ??
    0;
  const callsFamily = intFromText(data.community?.callsFamilyText) ?? 0;
  const socialEvents = intFromText(data.community?.socialEventsText) ?? 0;
  if (calls > 0 || callsFamily > 0 || socialEvents > 0) return true;

  if (drinkingEvents.some((event) => event.drinks > 0)) return true;

  return false;
}

export default function DailyLog({
  dateKey,
  userId,
  title,
  embedded = false,
  showLabel = true,
}: {
  dateKey: string;
  userId: string;
  title?: string;
  embedded?: boolean;
  showLabel?: boolean;
}) {
  const debugEnabled =
    DEBUG_DAILY_LOG ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug"));
  const [data, setData] = useState<DayData>(() => makeEmptyDailyLog());
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const prevDateRef = useRef(dateKey);
  // Root cause (Bug A): stale async loads + reused component state could leak data across dates.
  const activeDateRef = useRef(dateKey);
  const [weeklyBase, setWeeklyBase] = useState({
    workouts_logged_weekly: 0,
    calls_friends_weekly: 0,
    calls_family_weekly: 0,
    social_events_weekly: 0,
    pages_weekly: 0,
  });
  const latestRef = useRef<{
    data: DayData;
    goals: ReturnType<typeof getDefaultGoalConfig>;
    drinking: DrinkingEvent[];
    dateKey: string;
  } | undefined>(undefined);
  const [goals, setGoals] = useState(getDefaultGoalConfig());
  const [drinkingEvents, setDrinkingEvents] = useState<DrinkingEvent[]>([]);
  const [drinkingOpen, setDrinkingOpen] = useState(false);
  const [drinkingTier, setDrinkingTier] = useState<1 | 2 | 3>(2);
  const drinkingDrinksRef = useRef<HTMLInputElement | null>(null);
  const drinkingNoteRef = useRef<HTMLInputElement | null>(null);
  const [drinkingEditId, setDrinkingEditId] = useState<string | null>(null);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [exerciseType, setExerciseType] = useState<ActivityType>("Weight Lifting");
  const [exerciseEnvironment, setExerciseEnvironment] = useState<
    "" | "indoor" | "outdoor"
  >("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const exerciseMinutesRef = useRef<HTMLInputElement | null>(null);
  const exerciseSecondsRef = useRef<HTMLInputElement | null>(null);
  const exerciseCaloriesRef = useRef<HTMLInputElement | null>(null);
  const exerciseIntensityRef = useRef<HTMLInputElement | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const readingTitleRef = useRef<HTMLInputElement | null>(null);
  const readingPagesRef = useRef<HTMLInputElement | null>(null);
  const readingFictionRef = useRef<HTMLInputElement | null>(null);
  const readingNonfictionRef = useRef<HTMLInputElement | null>(null);
  const readingQuoteRef = useRef<HTMLInputElement | null>(null);
  const readingNoteRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let mounted = true;
    activeDateRef.current = dateKey;
    setHydrated(false);
    setData(makeEmptyDailyLog());
    setDrinkingEvents([]);
    setDrinkingOpen(false);
    setDrinkingEditId(null);

    const load = async () => {
      if (debugEnabled) {
        console.debug("[DailyLog] load start", { dateKey, userId });
      }
      const { data: row } = await supabase
        .from("daily_logs")
        .select("date,data,steps")
        .eq("user_id", userId)
        .eq("date", dateKey)
        .maybeSingle();

      if (!mounted || activeDateRef.current !== dateKey) return;

      if (row?.data) {
        const parsed = row.data as DayData;
        // Root cause: stepsText was not hydrated from persisted data, so it reset to 0 on reopen.
        const legacySteps = textFromUnknown(
          row?.steps ??
            (parsed as DayData & { workouts?: { steps?: number } }).workouts?.steps ??
            parsed?.workouts?.stepsText
        );
        const legacySleep = textFromUnknown(
          (parsed as DayData & { sleep?: { hours?: number } }).sleep?.hours ??
            parsed?.sleep?.hoursText
        );
        const sleepParts = splitHoursToParts(legacySleep);
        const legacyReadingEvent =
          parsed?.reading?.events && parsed.reading.events.length > 0
            ? undefined
            : parsed?.reading?.title || parsed?.reading?.pagesText
              ? {
                  id: id(),
                  title: parsed?.reading?.title,
                  pages: intFromText(parsed?.reading?.pagesText),
                  fictionPages: intFromText(parsed?.reading?.fictionPagesText),
                  nonfictionPages: intFromText(parsed?.reading?.nonfictionPagesText),
                  quote: parsed?.reading?.quote,
                  note: parsed?.reading?.note,
                }
              : undefined;
        setData({
          ...makeEmptyDailyLog(),
          ...parsed,
          workouts: {
            stepsText: legacySteps,
            activities:
              parsed?.workouts?.activities?.map((activity) => ({
                id: activity.id ?? id(),
                type: activity.type ?? "Weight Lifting",
                minutesText: textFromUnknown(
                  (activity as WorkoutActivity & { minutes?: number }).minutes ??
                    activity.minutesText
                ),
                secondsText: textFromUnknown(
                  (activity as WorkoutActivity & { seconds?: number }).seconds ??
                    activity.secondsText
                ),
                caloriesText: textFromUnknown(
                  (activity as WorkoutActivity & { calories?: number }).calories ??
                    activity.caloriesText
                ),
                intensityText: textFromUnknown(
                  (activity as WorkoutActivity & { intensity?: number }).intensity ??
                    activity.intensityText
                ),
                environment: activity.environment,
              })) ?? [],
          },
          sleep: {
            hoursText: parsed?.sleep?.hoursText ?? sleepParts.hoursText,
            minutesText: parsed?.sleep?.minutesText ?? sleepParts.minutesText,
            restingHrText: parsed?.sleep?.restingHrText,
          },
          reading: {
            ...parsed?.reading,
            events: parsed?.reading?.events ?? (legacyReadingEvent ? [legacyReadingEvent] : []),
          },
          community: {
            ...parsed?.community,
          },
        });
      } else {
        setData(makeEmptyDailyLog());
      }

      setHydrated(true);
      if (debugEnabled) {
        console.debug("[DailyLog] load complete", {
          dateKey,
          userId,
          fetchedDate: row?.date ?? null,
          hasRow: Boolean(row?.data),
        });
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [dateKey, userId]);

  useEffect(() => {
    if (!debugEnabled) return;
    console.debug("[DailyLog] mount", { dateKey, userId });
    return () => {
      console.debug("[DailyLog] unmount", { dateKey, userId });
    };
  }, [dateKey, userId, debugEnabled]);

  const flushSave = async (snapshot?: {
    data: DayData;
    goals: ReturnType<typeof getDefaultGoalConfig>;
    drinking: DrinkingEvent[];
    dateKey: string;
  }) => {
    if (!snapshot) return;
    if (snapshot.dateKey > todayKey()) return;
    if (!hasMeaningfulData(snapshot.data, snapshot.drinking)) return;
    const scores = computeScores(snapshot.data, snapshot.goals, snapshot.drinking, weeklyActuals);
    const steps = intFromText(snapshot.data.workouts.stepsText);
    if (debugEnabled) {
      console.debug("[DailyLog] flush save", {
        dateKey: snapshot.dateKey,
        steps,
        totalScore: scores.totalScore,
      });
    }
    const { error } = await supabase
      .from("daily_logs")
      .upsert(
        {
          user_id: userId,
          date: snapshot.dateKey,
          data: snapshot.data,
          steps: steps ?? null,
          total_score: scores.totalScore,
          workout_score: scores.workoutScore,
          sleep_score: scores.sleepScore,
          diet_score: scores.dietScore,
          reading_score: scores.readingScore,
          community_score: scores.communityScore,
        },
        { onConflict: "user_id,date" }
      );
    if (error) {
      setSaveError(error.message);
    } else {
      setSaveError(null);
      dirtyRef.current = false;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("daily-log-saved", {
            detail: { date: snapshot.dateKey, scores },
          })
        );
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase
      .from("user_goals")
      .select("goals, enabled_categories")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data?.goals) {
          setGoals(normalizeGoalConfig(data.goals, data.enabled_categories));
        } else {
          setGoals(getDefaultGoalConfig());
        }
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    listDrinkingEvents(userId, dateKey).then((events) => {
      if (!mounted) return;
      setDrinkingEvents(events);
    });
    return () => {
      mounted = false;
    };
  }, [userId, dateKey]);

  useEffect(() => {
    let mounted = true;
    const loadWeeklyBase = async () => {
      const { startKey, endKey } = getWeekWindowFromKey(dateKey);
      const { data: rows, error } = await supabase
        .from("daily_logs")
        .select("date,data")
        .eq("user_id", userId)
        .gte("date", startKey)
        .lte("date", endKey);
      if (!mounted) return;
      if (error || !rows) {
        setWeeklyBase({
          workouts_logged_weekly: 0,
          calls_friends_weekly: 0,
          calls_family_weekly: 0,
          social_events_weekly: 0,
          pages_weekly: 0,
        });
        return;
      }

      let workouts = 0;
      let callsFriends = 0;
      let callsFamily = 0;
      let socials = 0;
      let pages = 0;
      rows.forEach((row) => {
        if (row.date === dateKey) return;
        const parsed = row.data as DayData;
        workouts += parsed?.workouts?.activities?.length ?? 0;
        callsFriends +=
          intFromText(parsed?.community?.callsFriendsText) ??
          intFromText(parsed?.community?.callsText) ??
          0;
        callsFamily += intFromText(parsed?.community?.callsFamilyText) ?? 0;
        socials += intFromText(parsed?.community?.socialEventsText) ?? 0;
        pages += totalPagesForDay(parsed);
      });

      setWeeklyBase({
        workouts_logged_weekly: workouts,
        calls_friends_weekly: callsFriends,
        calls_family_weekly: callsFamily,
        social_events_weekly: socials,
        pages_weekly: pages,
      });
    };

    loadWeeklyBase();
    return () => {
      mounted = false;
    };
  }, [userId, dateKey]);

  useEffect(() => {
    if (!hydrated) return;
    latestRef.current = {
      data,
      goals,
      drinking: drinkingEvents,
      dateKey,
    };
    dirtyRef.current = true;
  }, [data, goals, drinkingEvents, dateKey, hydrated]);

  useEffect(() => {
    if (!drinkingOpen) return;
    const event = drinkingEvents.find((item) => item.id === drinkingEditId);
    if (event) {
      requestAnimationFrame(() => {
        if (drinkingDrinksRef.current)
          drinkingDrinksRef.current.value = String(event.drinks);
        if (drinkingNoteRef.current) drinkingNoteRef.current.value = event.note ?? "";
        setDrinkingTier(event.tier);
      });
    } else {
      requestAnimationFrame(() => {
        if (drinkingDrinksRef.current) drinkingDrinksRef.current.value = "0";
        if (drinkingNoteRef.current) drinkingNoteRef.current.value = "";
      });
    }
  }, [drinkingOpen, drinkingEditId, drinkingEvents]);

  useEffect(() => {
    if (!exerciseOpen) return;
    requestAnimationFrame(() => {
      setExerciseType("Weight Lifting");
      setExerciseEnvironment("");
      setExerciseError(null);
      if (exerciseMinutesRef.current) exerciseMinutesRef.current.value = "";
      if (exerciseSecondsRef.current) exerciseSecondsRef.current.value = "";
      if (exerciseCaloriesRef.current) exerciseCaloriesRef.current.value = "";
      if (exerciseIntensityRef.current) exerciseIntensityRef.current.value = "";
    });
  }, [exerciseOpen]);

  useEffect(() => {
    if (!readingOpen) return;
    requestAnimationFrame(() => {
      if (readingTitleRef.current) readingTitleRef.current.value = "";
      if (readingPagesRef.current) readingPagesRef.current.value = "";
      if (readingFictionRef.current) readingFictionRef.current.value = "";
      if (readingNonfictionRef.current) readingNonfictionRef.current.value = "";
      if (readingQuoteRef.current) readingQuoteRef.current.value = "";
      if (readingNoteRef.current) readingNoteRef.current.value = "";
    });
  }, [readingOpen]);

  const isFutureDate = dateKey > todayKey();

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (isFutureDate) return;

    saveTimer.current = setTimeout(async () => {
      const meaningful = hasMeaningfulData(data, drinkingEvents);
      if (!meaningful) {
        await supabase
          .from("daily_logs")
          .delete()
          .eq("user_id", userId)
          .eq("date", dateKey);
        if (saveError) setSaveError(null);
        return;
      }

      const scores = computeScores(data, goals, drinkingEvents, weeklyActuals);
      const steps = intFromText(data.workouts.stepsText);
      if (debugEnabled) {
        console.debug("[DailyLog] autosave", {
          dateKey,
          steps,
          totalScore: scores.totalScore,
        });
      }
      const payload = {
        user_id: userId,
        date: dateKey,
        data,
        steps: steps ?? null,
        total_score: scores.totalScore,
        workout_score: scores.workoutScore,
        sleep_score: scores.sleepScore,
        diet_score: scores.dietScore,
        reading_score: scores.readingScore,
        community_score: scores.communityScore,
      };

      const { error } = await supabase
        .from("daily_logs")
        .upsert(payload, { onConflict: "user_id,date" });

      if (error) {
        setSaveError(error.message);
      } else {
        if (saveError) setSaveError(null);
        dirtyRef.current = false;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("daily-log-saved", {
              detail: { date: dateKey, scores },
            })
          );
        }
      }
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, dateKey, hydrated, userId, drinkingEvents, goals, isFutureDate]);

  useEffect(() => {
    if (prevDateRef.current !== dateKey) {
      flushSave(latestRef.current ?? undefined);
      prevDateRef.current = dateKey;
    }
  }, [dateKey]);

  useEffect(() => {
    return () => {
      if (!dirtyRef.current) return;
      flushSave(latestRef.current).catch((error) => {
        console.error("Daily log flush save failed", error?.message ?? error);
      });
    };
  }, [userId]);

  const totalWorkoutMinutes = useMemo(() => {
    return data.workouts.activities.reduce((sum, a) => {
      const minutes = intFromText(a.minutesText) ?? 0;
      const seconds = clampInt(intFromText(a.secondsText) ?? 0, 0, 59);
      return sum + minutes + seconds / 60;
    }, 0);
  }, [data.workouts.activities]);

  const sleepHours = numFromText(data.sleep.hoursText) ?? 0;
  const sleepMinutes = clampInt(intFromText(data.sleep.minutesText) ?? 0, 0, 59);
  const sleepTotalHours = sleepHours + sleepMinutes / 60;
  const cookedMeals = intFromText(data.diet.cookedMealsText) ?? 0;
  const restaurantMeals = intFromText(data.diet.restaurantMealsText) ?? 0;
  const totalMeals = cookedMeals + restaurantMeals;
  const readingEvents = (data.reading.events ?? []) as ReadingEvent[];
  const pagesRead = totalPagesForDay(data);
  const fictionPages = readingEvents.reduce(
    (sum, event) => sum + (event.fictionPages ?? 0),
    0
  );
  const nonfictionPages = readingEvents.reduce(
    (sum, event) => sum + (event.nonfictionPages ?? 0),
    0
  );
  const weeklyActuals = useMemo(
    () => ({
      workouts_logged_weekly: weeklyBase.workouts_logged_weekly + data.workouts.activities.length,
      calls_friends_weekly:
        weeklyBase.calls_friends_weekly +
        (intFromText(data.community?.callsFriendsText) ??
          intFromText(data.community?.callsText) ??
          0),
      calls_family_weekly:
        weeklyBase.calls_family_weekly +
        (intFromText(data.community?.callsFamilyText) ?? 0),
      social_events_weekly:
        weeklyBase.social_events_weekly +
        (intFromText(data.community?.socialEventsText) ?? 0),
      pages_weekly: weeklyBase.pages_weekly + totalPagesForDay(data),
    }),
    [
      weeklyBase,
      data.workouts.activities.length,
      data.community?.callsFriendsText,
      data.community?.callsFamilyText,
      data.community?.callsText,
      data.community?.socialEventsText,
      data.reading,
    ]
  );
  const scores = computeScores(data, goals, drinkingEvents, weeklyActuals);

  const enabledCategories = goals.enabledCategories ?? [];
  const completedCount =
    (enabledCategories.includes("exercise") && scores.workoutScore >= 25 ? 1 : 0) +
    (enabledCategories.includes("sleep") && scores.sleepScore >= 25 ? 1 : 0) +
    (enabledCategories.includes("diet") && scores.dietScore >= 25 ? 1 : 0) +
    (enabledCategories.includes("reading") && scores.readingScore >= 25 ? 1 : 0) +
    (enabledCategories.includes("community") && scores.communityScore >= 25 ? 1 : 0);
  const totalCategories = enabledCategories.length || 0;

  const removeActivity = (activityId: string) => {
    setData((prev) => ({
      ...prev,
      workouts: {
        ...prev.workouts,
        activities: prev.workouts.activities.filter((a) => a.id !== activityId),
      },
    }));
  };

  const content = (
    <div className="w-full max-w-4xl">
        <header className="mb-10">
          <div className="flex flex-col gap-3">
            {showLabel ? (
              <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
                Daily Log
              </div>
            ) : null}
            <h1 className="text-4xl md:text-5xl font-bold tracking-wide leading-none">
              {title ?? "Daily Log"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <div className="px-4 py-2 rounded-md command-surface">
                <span className="text-gray-400">Score</span>{" "}
                <span className="font-semibold">{formatScore(scores.totalScore)}/100</span>
              </div>

              <div className="px-4 py-2 rounded-md command-surface">
                <span className="text-gray-400">Full points</span>{" "}
                <span className="font-semibold">{completedCount}/{totalCategories}</span>
              </div>

              <div className="px-4 py-2 rounded-md command-surface text-gray-400">
                {dateKey}
              </div>

              <div className="px-4 py-2 rounded-md command-surface text-gray-400 min-w-[160px] text-center">
                Auto-save on
              </div>
            </div>
            {isFutureDate ? (
              <div className="mt-3 text-xs uppercase tracking-[0.3em] text-rose-300">
                Future days locked
              </div>
            ) : null}
            <div className="min-h-[40px]">
              {saveError ? (
                <div className="px-4 py-2 rounded-md bg-rose-950/40 border border-rose-800/60 text-rose-200 text-sm">
                  {saveError}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {enabledCategories.includes("exercise") ? (
            <Card
            title="Exercise"
            subtitle="Log activities; earn up to 25 points based on your goals."
            hint={`Total minutes today: ${formatScore(
              totalWorkoutMinutes
            )}  •  Score: ${formatScore(scores.workoutScore)}/25`}
            earned={scores.workoutScore >= 25}
            score={scores.workoutScore}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExerciseOpen(true)}
                disabled={isFutureDate}
                className="px-4 py-2 rounded-md border border-white/10 bg-slate-900 hover:border-white/20 transition"
              >
                Add workout
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Steps</Label>
                <StepsInput
                  debug={debugEnabled}
                  dateKey={dateKey}
                  isFutureDate={isFutureDate}
                  value={data.workouts.stepsText ?? ""}
                  onChange={(value) =>
                    setData((prev) => ({
                      ...prev,
                      workouts: { ...prev.workouts, stepsText: value },
                    }))
                  }
                />
              </div>
              <div className="md:col-span-2 text-gray-500 text-sm flex items-center">
                Workouts logged are counted from activities below.
              </div>
            </div>

            {exerciseOpen ? (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
                <div className="w-full max-w-3xl rounded-md border border-white/10 command-surface-elevated p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-semibold">Add workout</div>
                    <button
                      onClick={() => setExerciseOpen(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Activity</Label>
                      <Select
                        isFutureDate={isFutureDate}
                        value={exerciseType}
                        onChange={(e) =>
                          setExerciseType(e.target.value as ActivityType)
                        }
                      >
                        <option>Running</option>
                        <option>Walking</option>
                        <option>Treadmill Walking</option>
                        <option>Weight Lifting</option>
                        <option>Cycling</option>
                        <option>HIIT</option>
                        <option>Yoga</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Environment</Label>
                      <div className="flex items-center gap-2">
                        {(["indoor", "outdoor"] as const).map((value) => (
                          <button
                            key={value}
                            onClick={() => {
                              setExerciseEnvironment(value);
                              if (exerciseError) setExerciseError(null);
                            }}
                            className={[
                              "px-3 py-2 rounded-full border text-sm transition",
                              exerciseEnvironment === value
                                ? "border-[color:var(--accent-60)] text-[color:var(--accent)] bg-[color:var(--accent-10)]"
                                : "border-white/10 text-gray-400 hover:border-white/20",
                            ].join(" ")}
                          >
                            {value === "indoor" ? "Indoor" : "Outdoor"}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setExerciseEnvironment("");
                            if (exerciseError) setExerciseError(null);
                          }}
                          className="px-3 py-2 rounded-full border border-white/10 text-gray-400 hover:border-white/20 text-sm"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label>Minutes</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="e.g., 45"
                        ref={exerciseMinutesRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Seconds</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="e.g., 30"
                        ref={exerciseSecondsRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Calories</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="e.g., 320"
                        ref={exerciseCaloriesRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Intensity 1–9</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="1–9"
                        ref={exerciseIntensityRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={async () => {
                        const minutes = exerciseMinutesRef.current?.value ?? "";
                        const seconds = exerciseSecondsRef.current?.value ?? "";
                        const calories = exerciseCaloriesRef.current?.value ?? "";
                        const intensity = exerciseIntensityRef.current?.value ?? "";
                        const requiresEnvironment = goals.presetId === "75-hard";
                        if (requiresEnvironment && !exerciseEnvironment) {
                          setExerciseError("Select indoor or outdoor for 75 Hard.");
                          return;
                        }
                        const workoutId = id();
                        const loggedAt = new Date().toISOString();
                        const newWorkout: WorkoutActivity = {
                          id: workoutId,
                          type: exerciseType,
                          minutesText: minutes,
                          secondsText: seconds,
                          caloriesText: calories,
                          intensityText: intensity,
                          environment: exerciseEnvironment || undefined,
                          loggedAt,
                        };
                        setData((prev) => ({
                          ...prev,
                          workouts: {
                            ...prev.workouts,
                            activities: [
                              ...prev.workouts.activities,
                              newWorkout,
                            ],
                          },
                        }));
                        if (isValidWorkout(newWorkout)) {
                          const summaryParts = [
                            exerciseType,
                            exerciseEnvironment ? exerciseEnvironment : undefined,
                            minutes ? `${minutes} min` : undefined,
                            intensity ? `Intensity ${intensity}` : undefined,
                          ].filter(Boolean);
                          await upsertFeedItem({
                            user_id: userId,
                            event_date: dateKey,
                            event_type: "workout",
                            event_id: workoutId,
                            summary: summaryParts.join(" • "),
                            metadata: {
                              activityType: exerciseType,
                              minutes,
                              seconds,
                              calories,
                              intensity,
                              environment: exerciseEnvironment || undefined,
                            },
                          });
                        }
                        if (exerciseMinutesRef.current) exerciseMinutesRef.current.value = "";
                        if (exerciseSecondsRef.current) exerciseSecondsRef.current.value = "";
                        if (exerciseCaloriesRef.current) exerciseCaloriesRef.current.value = "";
                        if (exerciseIntensityRef.current)
                          exerciseIntensityRef.current.value = "";
                        if (exerciseError) setExerciseError(null);
                        setExerciseOpen(false);
                      }}
                      className="px-4 py-2 rounded-md border border-[color:var(--accent-40)] text-[color:var(--accent)] hover:border-[color:var(--accent-60)] transition"
                    >
                      Save workout
                    </button>
                    <button
                      onClick={() => setExerciseOpen(false)}
                      className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 transition"
                    >
                      Cancel
                    </button>
                  </div>
                  {exerciseError ? (
                    <div className="mt-3 text-sm text-rose-300">{exerciseError}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {data.workouts.activities.length === 0 ? (
              <div className="text-gray-500 mt-4 text-sm">
                No activities yet. Add one to start logging.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {data.workouts.activities.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-md bg-black/40 border border-white/10 flex items-center justify-between"
                  >
                    <div className="text-gray-200">
                      <div className="font-semibold">{a.type}</div>
                      <div className="text-gray-400 text-sm">
                        {a.minutesText || a.secondsText
                          ? `${a.minutesText ?? "0"}m ${a.secondsText ?? "0"}s`
                          : "No time logged"}
                        {a.caloriesText ? ` • ${a.caloriesText} cal` : ""}
                        {a.intensityText ? ` • Intensity ${a.intensityText}` : ""}
                        {a.environment ? ` • ${a.environment}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        removeActivity(a.id);
                        await deleteFeedItemByEvent("workout", a.id);
                      }}
                      className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 transition text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          ) : null}

          {enabledCategories.includes("sleep") ? (
          <Card
            title="Sleep"
            subtitle="Earn up to 25 points based on your goals."
            hint={`Hours today: ${formatScore(sleepTotalHours)} / 8  •  Score: ${formatScore(
              scores.sleepScore
            )}/25`}
            earned={scores.sleepScore >= 25}
            score={scores.sleepScore}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Hours slept</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 7"
                  isFutureDate={isFutureDate}
                  value={data.sleep.hoursText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      sleep: { ...prev.sleep, hoursText: value },
                    }));
                  }}
                />
              </div>

              <div>
                <Label>Minutes slept</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 30"
                  isFutureDate={isFutureDate}
                  value={data.sleep.minutesText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      sleep: { ...prev.sleep, minutesText: value },
                    }));
                  }}
                />
              </div>

              <div>
                <Label>Resting heart rate</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 52"
                  isFutureDate={isFutureDate}
                  value={data.sleep.restingHrText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      sleep: {
                        ...prev.sleep,
                        restingHrText: value,
                      },
                    }));
                  }}
                />
              </div>
            </div>
          </Card>
          ) : null}

          {enabledCategories.includes("diet") ? (
          <Card
            title="Diet"
            subtitle="Earn up to 25 points based on your goals."
            hint={`Cooked: ${cookedMeals}  •  Restaurant: ${restaurantMeals}  •  Score: ${formatScore(
              scores.dietScore
            )}/25${scores.dietPenaltyTotal > 0 ? `  •  Alcohol penalty: -${scores.dietPenaltyTotal}` : ""}`}
            earned={scores.dietScore >= 25}
            score={scores.dietScore}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label># meals cooked</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 2"
                  isFutureDate={isFutureDate}
                  value={data.diet.cookedMealsText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, cookedMealsText: value },
                    }));
                  }}
                />
              </div>

              <div>
                <Label># meals from restaurants</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  isFutureDate={isFutureDate}
                  value={data.diet.restaurantMealsText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      diet: {
                        ...prev.diet,
                        restaurantMealsText: value,
                      },
                    }));
                  }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Healthiness (1–10)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 7"
                  isFutureDate={isFutureDate}
                  value={data.diet.healthinessText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, healthinessText: value },
                    }));
                  }}
                />
              </div>
              <div>
                <Label>Protein grams</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 150"
                  isFutureDate={isFutureDate}
                  value={data.diet.proteinText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, proteinText: value },
                    }));
                  }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Water (oz)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 80"
                  isFutureDate={isFutureDate}
                  value={data.diet.waterOzText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, waterOzText: value },
                    }));
                  }}
                />
              </div>
            </div>

          </Card>
          ) : null}

          {enabledCategories.includes("community") ? (
          <Card
            title="Community"
            subtitle="Connection and social presence. Weekly targets count toward your score."
            hint={`Friend calls: ${weeklyActuals.calls_friends_weekly}  •  Family calls: ${weeklyActuals.calls_family_weekly}  •  Social events: ${weeklyActuals.social_events_weekly}  •  Score: ${formatScore(
              scores.communityScore
            )}/25`}
            earned={scores.communityScore >= 25}
            score={scores.communityScore}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Friend calls (Mon–Sun)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  isFutureDate={isFutureDate}
                  value={data.community?.callsFriendsText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      community: { ...(prev.community ?? {}), callsFriendsText: value },
                    }));
                  }}
                />
              </div>
              <div>
                <Label>Family calls (Mon–Sun)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  isFutureDate={isFutureDate}
                  value={data.community?.callsFamilyText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      community: { ...(prev.community ?? {}), callsFamilyText: value },
                    }));
                  }}
                />
              </div>
              <div>
                <Label>Social events attended (Mon–Sun)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  isFutureDate={isFutureDate}
                  value={data.community?.socialEventsText ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setData((prev) => ({
                      ...prev,
                      community: { ...(prev.community ?? {}), socialEventsText: value },
                    }));
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>Notes</Label>
              <TextArea
                rows={3}
                placeholder="Optional context"
                isFutureDate={isFutureDate}
                value={data.community?.note ?? ""}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setData((prev) => ({
                    ...prev,
                    community: { ...(prev.community ?? {}), note: value },
                  }));
                }}
              />
            </div>

            <div className="mt-6 p-4 rounded-md border border-white/10 bg-black/40">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Social + drinking</div>
                <button
                  onClick={() => setDrinkingOpen((prev) => !prev)}
                  disabled={isFutureDate}
                  className="px-3 py-2 rounded-md border border-white/10 bg-slate-900 hover:border-white/20 transition text-sm"
                >
                  {drinkingOpen ? "Close" : "Add drinking event"}
                </button>
              </div>

              {drinkingOpen ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
                  <div className="w-full max-w-2xl rounded-md border border-white/10 command-surface-elevated p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-semibold">
                        {drinkingEditId ? "Edit drinking event" : "Add drinking event"}
                      </div>
                      <button
                        onClick={() => {
                          setDrinkingOpen(false);
                          setDrinkingEditId(null);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        Close
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Tier</Label>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          {[1, 2, 3].map((tier) => (
                            <label
                              key={tier}
                              className="flex items-center gap-2 text-gray-300"
                            >
                              <input
                                type="radio"
                                name="drinking-tier"
                                checked={drinkingTier === tier}
                                onChange={() => setDrinkingTier(tier as 1 | 2 | 3)}
                              />
                              {tier === 1
                                ? "Tier 1 — Major event"
                                : tier === 2
                                  ? "Tier 2 — Social event"
                                  : "Tier 3 — Regular / casual"}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Drinks</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="0–20"
                          defaultValue="0"
                          ref={drinkingDrinksRef}
                          isFutureDate={isFutureDate}
                        />
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Input
                          placeholder="e.g., wedding"
                          ref={drinkingNoteRef}
                          isFutureDate={isFutureDate}
                        />
                      </div>
                      <div className="md:col-span-3 flex items-center gap-3">
                        <button
                          onClick={async () => {
                            const drinkValue = drinkingDrinksRef.current?.value ?? "0";
                            const noteValue = drinkingNoteRef.current?.value ?? "";
                            const drinks = Math.max(
                              0,
                              Math.min(20, Number(drinkValue) || 0)
                            );
                            if (drinkingEditId) {
                              const updated = await updateDrinkingEvent(drinkingEditId, {
                                tier: drinkingTier,
                                drinks,
                                note: noteValue.trim() || null,
                              });
                              if (updated) {
                                setDrinkingEvents((prev) =>
                                  prev.map((event) =>
                                    event.id === updated.id ? updated : event
                                  )
                                );
                                if (isValidDrinking(updated.drinks)) {
                                  await updateFeedItemByEvent("drinking", updated.id, {
                                    summary: `Tier ${updated.tier} • ${updated.drinks} drinks`,
                                    metadata: {
                                      tier: updated.tier,
                                      drinks: updated.drinks,
                                      note: updated.note,
                                    },
                                  });
                                } else {
                                  await deleteFeedItemByEvent("drinking", updated.id);
                                }
                                setDrinkingEditId(null);
                                setDrinkingOpen(false);
                              }
                            } else {
                              const created = await createDrinkingEvent({
                                user_id: userId,
                                date: dateKey,
                                tier: drinkingTier,
                                drinks,
                                note: noteValue.trim() || null,
                              });
                              if (created) {
                                setDrinkingEvents((prev) => [...prev, created]);
                                if (isValidDrinking(created.drinks)) {
                                  await upsertFeedItem({
                                    user_id: userId,
                                    event_date: dateKey,
                                    event_type: "drinking",
                                    event_id: created.id,
                                    summary: `Tier ${created.tier} • ${created.drinks} drinks`,
                                    metadata: {
                                      tier: created.tier,
                                      drinks: created.drinks,
                                      note: created.note,
                                    },
                                  });
                                }
                                if (drinkingDrinksRef.current)
                                  drinkingDrinksRef.current.value = "0";
                                if (drinkingNoteRef.current)
                                  drinkingNoteRef.current.value = "";
                                setDrinkingOpen(false);
                              }
                            }
                          }}
                          className="px-4 py-2 rounded-md border border-[color:var(--accent-40)] text-[color:var(--accent)] hover:border-[color:var(--accent-60)] transition"
                        >
                          {drinkingEditId ? "Save changes" : "Save drinking event"}
                        </button>
                        <button
                          onClick={() => {
                            setDrinkingOpen(false);
                            setDrinkingEditId(null);
                          }}
                          className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {drinkingEvents.length === 0 ? (
                  <div className="text-gray-500 text-sm">No drinking events yet.</div>
                ) : (
                  drinkingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-4 py-2 text-sm"
                    >
                      <div className="text-gray-200">
                        Tier {event.tier} • {event.drinks} drinks
                        {event.note ? ` • ${event.note}` : ""}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setDrinkingEditId(event.id);
                            setDrinkingOpen(true);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await deleteDrinkingEvent(event.id);
                            if (ok) {
                              setDrinkingEvents((prev) =>
                                prev.filter((item) => item.id !== event.id)
                              );
                              await deleteFeedItemByEvent("drinking", event.id);
                            }
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
          ) : null}

          {enabledCategories.includes("reading") ? (
          <Card
            title="Knowledge"
            subtitle="Log what you read; earn up to 25 points based on your goals."
            hint={`Pages today: ${pagesRead}  •  Score: ${formatScore(
              scores.readingScore
            )}/25`}
            earned={scores.readingScore >= 25}
            score={scores.readingScore}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReadingOpen(true)}
                disabled={isFutureDate}
                className="px-4 py-2 rounded-md border border-white/10 bg-slate-900 hover:border-white/20 transition"
              >
                Add reading event
              </button>
            </div>

            {readingOpen ? (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
                <div className="w-full max-w-3xl rounded-md border border-white/10 command-surface-elevated p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-semibold">Add reading event</div>
                    <button
                      onClick={() => setReadingOpen(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label>Book title</Label>
                      <Input
                        placeholder="e.g., Meditations"
                        ref={readingTitleRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Pages read</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="e.g., 20"
                        ref={readingPagesRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Fiction pages</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="e.g., 10"
                        ref={readingFictionRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Non-fiction pages</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="e.g., 10"
                        ref={readingNonfictionRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div>
                      <Label>Favorite quote</Label>
                      <Input
                        placeholder="Paste a line that hit."
                        ref={readingQuoteRef}
                        isFutureDate={isFutureDate}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Commentary</Label>
                      <TextArea
                        isFutureDate={isFutureDate}
                        rows={4}
                        placeholder="Quick thoughts, what you learned, what you’ll apply…"
                        ref={readingNoteRef}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={async () => {
                        const title = readingTitleRef.current?.value ?? "";
                        const pages = Number(readingPagesRef.current?.value ?? 0) || 0;
                        const fiction = Number(readingFictionRef.current?.value ?? 0) || 0;
                        const nonfiction =
                          Number(readingNonfictionRef.current?.value ?? 0) || 0;
                        const quote = readingQuoteRef.current?.value ?? "";
                        const note = readingNoteRef.current?.value ?? "";

                        const newEventId = id();
                        const loggedAt = new Date().toISOString();
                        const newEvent: ReadingEvent = {
                          id: newEventId,
                          title: title.trim() || undefined,
                          pages: pages || undefined,
                          fictionPages: fiction || undefined,
                          nonfictionPages: nonfiction || undefined,
                          quote: quote.trim() || undefined,
                          note: note.trim() || undefined,
                          loggedAt,
                        };

                        setData((prev) => ({
                          ...prev,
                          reading: {
                            ...prev.reading,
                            events: [...(prev.reading.events ?? []), newEvent],
                          },
                        }));
                        const totalPages =
                          newEvent.pages ??
                          (newEvent.fictionPages ?? 0) + (newEvent.nonfictionPages ?? 0);
                        if (isValidReading(newEvent)) {
                          await upsertFeedItem({
                            user_id: userId,
                            event_date: dateKey,
                            event_type: "reading",
                            event_id: newEventId,
                            summary: `Read ${totalPages || 0} pages${
                              newEvent.title ? ` • ${newEvent.title}` : ""
                            }`,
                            metadata: {
                              pages: newEvent.pages,
                              fiction_pages: newEvent.fictionPages,
                              nonfiction_pages: newEvent.nonfictionPages,
                              title: newEvent.title,
                            },
                          });
                        }

                        if (readingTitleRef.current) readingTitleRef.current.value = "";
                        if (readingPagesRef.current) readingPagesRef.current.value = "";
                        if (readingFictionRef.current) readingFictionRef.current.value = "";
                        if (readingNonfictionRef.current) readingNonfictionRef.current.value =
                          "";
                        if (readingQuoteRef.current) readingQuoteRef.current.value = "";
                        if (readingNoteRef.current) readingNoteRef.current.value = "";

                        setReadingOpen(false);
                      }}
                      className="px-4 py-2 rounded-md border border-[color:var(--accent-40)] text-[color:var(--accent)] hover:border-[color:var(--accent-60)] transition"
                    >
                      Save reading event
                    </button>
                    <button
                      onClick={() => setReadingOpen(false)}
                      className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {readingEvents.length === 0 ? (
                <div className="text-gray-500 text-sm">No reading events yet.</div>
              ) : (
                readingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border border-white/10 bg-black/40 px-4 py-3 text-sm"
                  >
                    <div className="text-gray-200 font-semibold">
                      {event.title || "Reading"}
                    </div>
                    <div className="text-gray-400 mt-1">
                      {event.pages ? `${event.pages} pages` : "Pages not set"}
                      {event.fictionPages
                        ? ` • Fiction ${event.fictionPages}`
                        : ""}
                      {event.nonfictionPages
                        ? ` • Non-fiction ${event.nonfictionPages}`
                        : ""}
                    </div>
                    {event.quote ? (
                      <div className="text-gray-400 mt-1">“{event.quote}”</div>
                    ) : null}
                    {event.note ? (
                      <div className="text-gray-500 mt-1">{event.note}</div>
                    ) : null}
                    <div className="mt-2">
                      <button
                        onClick={async () => {
                          setData((prev) => ({
                            ...prev,
                            reading: {
                              ...prev.reading,
                              events: (prev.reading.events ?? []).filter(
                                (item) => item.id !== event.id
                              ),
                            },
                          }));
                          await deleteFeedItemByEvent("reading", event.id);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
          ) : null}
        </div>
      </div>
  );

  if (embedded) {
    return <section className="text-white">{content}</section>;
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">{content}</main>
  );
}
