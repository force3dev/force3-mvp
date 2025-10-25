"use client";
import { useRouter } from "next/navigation";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Dumbbell,
  Footprints,
  Calendar as CalIcon,
  Trophy,
  AlertCircle,
  Check,
  X,
} from "lucide-react";

/**
 * FORCE3 – Lite (UI Upgrades Bundle)
 * - Persist “Today” completion across refresh
 * - “Edit Today” drawer (add/remove/reorder/tweak sets/reps & run)
 * - Undo snackbar for logs
 * - Weekly progress vs plan (mileage & sets)
 * - Plan → Today: preload today from any week
 * - Theme settings: Accent (Blue/Mint/Purple) & Density (Cozy/Compact)
 */

// ---------- Utilities ----------
const STORAGE_KEY = "force3_local_state_lite_v2";
const TODAY_STORE = "force3_today_done_v1";

type Units = { weight: "lb" | "kg"; distance: "mi" | "km" };

type Profile = {
  name: string;
  goal: string;
  noDeadlift: boolean;
  doubleRuns: boolean;
  sports: string;
  units: Units;
};

type Log =
  | {
      id: string;
      type: "strength";
      date: string;
      exercise: string;
      sets: number;
      reps: number;
      weight: number;
      completed: boolean;
    }
  | {
      id: string;
      type: "run";
      date: string;
      runType: string;
      session: "AM" | "PM" | "Solo";
      distance: number;
      duration: number;
      pace: string;
    }
  | {
      id: string;
      type: "wellness";
      date: string;
      sleep: number;
      calories: number;
      protein: number;
      notes?: string;
    };


type StrengthTemplateItem = { name: string; sets: number; reps: number; suggested?: number };
type TodayTemplate = {
  strength: StrengthTemplateItem[];
  run: { type: string; distance: number } | null;
};
type TodayDone = { strength: boolean[]; run: boolean };

type State = {
  betaCode: string;
  authed: boolean;
  profile: Profile;
  logs: Log[];
  // UI theme
  settings: {
    accent: "blue" | "mint" | "purple";
    density: "cozy" | "compact";
  };
  // Today template (editable)
  today?: TodayTemplate;
};

const defaultExercises = [
  { name: "Bench Press", bodypart: "Push" },
  { name: "Incline DB Press", bodypart: "Push" },
  { name: "Overhead Press", bodypart: "Push" },
  { name: "Lat Pulldown", bodypart: "Pull" },
  { name: "Barbell Row", bodypart: "Pull" },
  { name: "Seated Cable Row", bodypart: "Pull" },
  { name: "Back Squat", bodypart: "Legs" },
  { name: "Leg Press", bodypart: "Legs" },
  { name: "Bulgarian Split Squat", bodypart: "Legs" },
];

const runTypes = ["Long", "Easy", "Tempo", "Intervals", "Fartlek", "Recovery"];

function loadState(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}
function saveState(next: State) {

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

/* Persist “Today” completion flags */
function loadTodayStore(): Record<string, TodayDone> {
  try {
    const raw = localStorage.getItem(TODAY_STORE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveTodayStore(obj: Record<string, TodayDone>) {
  try {
    localStorage.setItem(TODAY_STORE, JSON.stringify(obj));
  } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function suggestWeight(history: Log[], exerciseName: string, unit: "lb" | "kg") {
  const last = [...history]
    .filter(
      (h) => h.type === "strength" && h.exercise === exerciseName && h.completed
    )
    .sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0] as Log | undefined;
  if (!last || last.type !== "strength") return unit === "lb" ? 45 : 20;
  const bump = unit === "lb" ? 2.5 : 1.25;
  const next =
    (last.weight || (unit === "lb" ? 45 : 20)) + bump;
  return Math.round(next * 2) / 2;
}

// ---------- Plan generator ----------
type WeekPlan = { weeklyMiles: number; summary: string; days: string[] };

function dayStrength(profile: Profile, label: string) {
  const sets = profile.noDeadlift
    ? "Bench/Row/Squat + accessories (no deadlift)"
    : "Bench/Row/Squat/Deadlift + accessories";
  return `${label} • Strength: ${sets}`;
}

function generatePlan(profile: Profile): WeekPlan[] {
  const useKm = profile.units.distance === "km";
  const milesToUnit = (m: number) =>
    useKm ? `${Math.round(m * 1.60934)} km` : `${Math.round(m)} mi`;

  const weeklyMiles = [35, 38, 41, 44, 48, 52, 55, 58, 62, 65, 67, 70, 60, 50, 38, 26];

  const weeks: WeekPlan[] = [];
  for (let w = 1; w <= 16; w++) {
    const wm = weeklyMiles[w - 1];
    const hasMP = w >= 10 && w <= 15;
    const hasTempo = w >= 6;
    const block =
      w <= 4 ? "Base" : w <= 8 ? "Build" : w <= 12 ? "Peak" : w <= 15 ? "Taper" : "Race";

    const lrMiles = w === 16 ? 0 : Math.min(Math.round(wm * 0.33), 22);
    const remaining = Math.max(wm - lrMiles, 0);
    const workoutMiles = w === 16 ? 3 : hasMP ? 12 : hasTempo ? 10 : 8;

    let easy1 = Math.max(Math.round(remaining * 0.3), 5);
    let easy2 = Math.max(Math.round(remaining * 0.22), 4);
    let easy3 = Math.max(Math.round(remaining * 0.2), 4);
    let recov = Math.max(Math.round(remaining * 0.12), 3);
    const planned = lrMiles + workoutMiles + easy1 + easy2 + easy3 + recov;
    const delta = wm - planned;
    if (delta !== 0) easy1 = Math.max(3, easy1 + delta);

    const days: string[] = [];

    days.push(dayStrength(profile, `Mon: Strength (Upper/Push-Pull) + Easy ${milesToUnit(4)}`));
    if (hasMP) {
      days.push(`Tue: Marathon-pace workout ${milesToUnit(workoutMiles)} (e.g., 2×6 @ MP w/ 1 easy)`);
    } else if (hasTempo) {
      days.push(`Tue: Tempo ${milesToUnit(workoutMiles)} (e.g., 2×3 @ T w/ 1 easy)`);
    } else {
      days.push(`Tue: Aerobic intervals ${milesToUnit(workoutMiles)} (e.g., 6×1 @ HM effort)`);
    }
    const bikeMin = w >= 2 ? (w < 6 ? 45 : 60) : 0;
    days.push(
      dayStrength(
        profile,
        bikeMin
          ? `Wed: Strength (Lower/Legs) + Bike ${bikeMin}min`
          : `Wed: Strength (Lower/Legs)`
      )
    );
    days.push(`Thu: Easy ${milesToUnit(easy1)} conversational`);
    if (profile.doubleRuns) {
      const am = Math.max(4, Math.round(easy2 * 0.65));
      const pm = Math.max(3, easy2 - am);
      days.push(`Fri: AM ${milesToUnit(am)} easy • PM ${milesToUnit(pm)} easy (doubles; AM longer)`);
    } else {
      days.push(`Fri: Easy ${milesToUnit(easy2)} + drills/strides`);
    }
    if (w === 16) {
      days.push(`Sat: OFF / travel / gear prep`);
    } else if (hasMP && w >= 11) {
      days.push(`Sat: Long run ${milesToUnit(lrMiles)} w/ last 4–6 @ MP`);
    } else {
      days.push(`Sat: Long run ${milesToUnit(lrMiles)} steady`);
    }
    days.push(`Sun: Recovery ${milesToUnit(recov)} + mobility`);

    const summary =
      block === "Race"
        ? "Race week (taper)"
        : block === "Taper"
        ? "Taper & sharpen"
        : block === "Peak"
        ? "Peak volume + MP work"
        : block === "Build"
        ? "Build aerobic & tempo"
        : "Base & consistency";

    weeks.push({ weeklyMiles: wm, summary, days });
  }
  return weeks;
}

function getPlannedWeeklyMileage(profile: Profile, date = new Date()): number {
  const plans = generatePlan(profile);
  const weekIdx = getWeekIndex({ date });
  const w = plans[Math.min(plans.length - 1, weekIdx)];
  return w?.weeklyMiles ?? 0;
}
function getWeekIndex({ date = new Date() }: { date?: Date; } = {}): number {
  // naive: 0..15 inside the 16-week block (just map current week-of-year % 16)
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = (date.getTime() - start.getTime()) / (24 * 3600 * 1000);
  const week = Math.floor(diff / 7);
  return week % 16;
}

function formatDistance(miles: number, unit: "mi" | "km") {
  if (unit === "mi") return `${miles.toFixed(0)} mi`;
  const km = miles * 1.60934;
  return `${km.toFixed(0)} km`;
}

// ---------- Root Component ----------
export default function DashboardPage() {
  const router = useRouter();

  // Hydration guard
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
// Add:
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

// Keep your persisted/state init EXACTLY as-is:
const persisted = typeof window !== "undefined" ? loadState() : null;
const [state, setState] = useState<State>(
  persisted || {
    betaCode: "FORCE3BETA",
    authed: false,
    profile: {
      name: "",
      goal: "Aggressive fat loss",
      noDeadlift: true,
      doubleRuns: true,
      sports: "Running, lifting",
      units: { weight: "lb", distance: "mi" },
    },
    logs: [],
    settings: { accent: "blue", density: "cozy" },
    today: undefined,
  }
);

// Redirect to questionnaire if not onboarded
useEffect(() => {
  if (!hydrated) return;
  if (!state.authed || !state.profile?.name) {
    router.replace("/questionnaire");
  }
}, [hydrated, state.authed, state.profile?.name, router]);
  const [tab, setTab] = useState<
    "dashboard" | "strength" | "runs" | "wellness" | "settings" | "plan"
  >("dashboard");

  // Persist full app state
  useEffect(() => { saveState(state); }, [state]);

  // Apply theme (accent & density) via CSS variables
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    // Accent
    const accents: Record<State["settings"]["accent"], { primary: string; primaryFg: string }> = {
      blue:   { primary: "oklch(0.61 0.12 254)", primaryFg: "oklch(0.985 0.002 247.839)" },
      mint:   { primary: "oklch(0.85 0.08 180)", primaryFg: "oklch(0.14 0.02 180)" },
      purple: { primary: "oklch(0.62 0.16 300)", primaryFg: "oklch(0.985 0.002 247.839)" },
    };
    const a = accents[state.settings.accent];
    root.style.setProperty("--primary", a.primary);
    root.style.setProperty("--primary-foreground", a.primaryFg);
    // Density (just a subtle global scale we read in classnames)
    root.dataset.density = state.settings.density;
  }, [state.settings, hydrated]);

  const weekly = useMemo(() => summarizeWeekly(state.logs), [state.logs]);

  if (!hydrated) return <div className="p-4 text-neutral-400">Loading…</div>;

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <header className="px-4 pt-6 pb-3 border-b border-neutral-900">
        <h1 className="text-2xl font-bold tracking-tight">
          FORCE3 <span className="text-neutral-400 text-sm">Lite</span>
        </h1>
        <p className="text-neutral-400 text-sm">Strength • Endurance • Discipline</p>
      </header>

<main
  className="px-4 pb-24 max-w-3xl mx-auto"
  style={{ opacity: mounted ? 1 : 0, transition: "opacity .5s ease" }}
>
       <>
  <Tabs value={tab} onChange={setTab} />
  {tab === "dashboard" && (
    <Dashboard
      state={state}
      weekly={weekly}
      setState={setState}
    />
  )}
  {tab === "strength" && <StrengthLogger state={state} setState={setState} />}
  {tab === "runs" && <RunLogger state={state} setState={setState} />}
  {tab === "wellness" && <AdvancedWellness state={state} setState={setState} />}
  {tab === "settings" && <SettingsBackup state={state} setState={setState} />}
  {tab === "plan" && <PlanTab state={state} setState={setState} />}
</>
      </main>
    </div>
  );
}

/* ===================== Tabs ===================== */
function Tabs({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  const items: { key: any; label: string; hotkey: string }[] = [
    { key: "dashboard", label: "Dashboard", hotkey: "1" },
    { key: "strength",  label: "Strength",  hotkey: "2" },
    { key: "runs",      label: "Runs",      hotkey: "3" },
    { key: "wellness",  label: "Wellness",  hotkey: "4" },
    { key: "settings",  label: "Settings",  hotkey: "5" },
    { key: "plan",      label: "Plan",      hotkey: "6" },
  ];

  // Hotkeys 1..6
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const item = items.find((it) => it.hotkey === e.key);
      if (item) onChange(item.key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sticky top-0 z-20 pt-4">
      <div className="border border-neutral-800/70 rounded-xl overflow-hidden bg-neutral-900/70 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/50 shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-6">
          {items.map((it) => {
            const active = value === it.key;
            const dense = document.documentElement.dataset.density === "compact";
            const pad = dense ? "py-1.5" : "py-2";
            return (
              <button
                key={it.key}
                onClick={() => onChange(it.key)}
                className={[
                  "relative text-sm transition-colors", pad,
                  active
                    ? "text-white bg-neutral-800/70"
                    : "text-neutral-300 hover:bg-neutral-800/50",
                ].join(" ")}
                title={`${it.label} (press ${it.hotkey})`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {it.label}
                  <kbd className="ml-1 hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-neutral-700/70 text-neutral-400">
                    {it.hotkey}
                  </kbd>
                </span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-white/80" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================== Small UI primitives ===================== */
function Card({ children, className = "" }: { children: any; className?: string }) {
  return (
    <div className={`border border-neutral-800 bg-neutral-900 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}
function CardBody({ children, className = "" }: { children: any; className?: string }) {
  const dense = document.documentElement.dataset.density === "compact";
  return <div className={`${dense ? "p-4" : "p-5"} ${className}`}>{children}</div>;
}
function Stat({ icon, label, value }: { icon: any; label: string; value: string }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
      <Icon className="size-5 text-neutral-300" />
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: any;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const map: Record<string, string> = {
    neutral: "bg-neutral-800 text-neutral-200",
    success: "bg-emerald-600/20 text-emerald-200 border border-emerald-700/40",
    warning: "bg-amber-600/20 text-amber-200 border border-amber-700/40",
    danger:  "bg-rose-600/20 text-rose-200 border border-rose-700/40",
    info:    "bg-sky-600/20 text-sky-200 border border-sky-700/40",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${map[tone]}`}>
      {children}
    </span>
  );
}
function SectionHeader({ title, right }: { title: string; right?: any }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      {right}
    </div>
  );
}
function ProgressBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const tone =
    pct >= 90 ? "var(--primary)" :
    pct >= 60 ? "oklch(0.82 .12 90)" :
    "rgba(255,255,255,0.18)";
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(1)} / {target.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded bg-neutral-800 overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

/* ===================== Beta & Onboarding ===================== */
function BetaGate({ state, setState }: { state: State; setState: any }) {
  const [code, setCode] = useState("");
  return (
    <div className="mt-6 border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-2">Beta Access</h2>
      <p className="text-sm text-neutral-400 mb-3">
        Enter the access code (default: <span className="font-mono">FORCE3BETA</span>).
      </p>
      <div className="flex gap-2">
        <input
          className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
          placeholder="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className="px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md"
          onClick={() => setState({ ...state, authed: code.trim() === state.betaCode })}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
function Onboarding({ state, setState }: { state: State; setState: any }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState(state.profile.goal);
  const [sports, setSports] = useState(state.profile.sports);
  const [noDeadlift, setNoDeadlift] = useState(true);
  const [doubleRuns, setDoubleRuns] = useState(true);
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");
  const [distUnit, setDistUnit] = useState<"mi" | "km">("mi");

  return (
    <div className="mt-6 border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-3">Let’s personalize FORCE3</h2>
      <div className="grid grid-cols-1 gap-3">
        <Labeled label="Your name">
          <input
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ricky"
          />
        </Labeled>
        <Labeled label="Primary goal">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          >
            <option>Aggressive fat loss</option>
            <option>Recomposition</option>
            <option>Muscle gain</option>
            <option>Marathon performance</option>
          </select>
        </Labeled>
        <Labeled label="Other sports / context">
          <input
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={sports}
            onChange={(e) => setSports(e.target.value)}
            placeholder="Running, cycling, swimming"
          />
        </Labeled>

        <ToggleRow
          label="No Deadlift rule"
          sub="Deadlifts are hidden from plans & suggestions."
          checked={noDeadlift}
          onChange={setNoDeadlift}
        />
        <ToggleRow
          label="Double run days"
          sub="AM run will be the longer primary session."
          checked={doubleRuns}
          onChange={setDoubleRuns}
        />

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Weight unit">
            <select
              className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as any)}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </Labeled>
          <Labeled label="Distance unit">
            <select
              className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
              value={distUnit}
              onChange={(e) => setDistUnit(e.target.value as any)}
            >
              <option value="mi">mi</option>
              <option value="km">km</option>
            </select>
          </Labeled>
        </div>

        <button
          className="mt-2 px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md disabled:opacity-50"
          onClick={() =>
            setState({
              ...state,
              profile: {
                name: name.trim(),
                goal,
                sports,
                noDeadlift,
                doubleRuns,
                units: { weight: weightUnit, distance: distUnit },
              },
            })
          }
          disabled={!name.trim()}
        >
          Finish setup
        </button>
      </div>
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <div className="text-neutral-300 mb-1 text-sm">{label}</div>
      {children}
    </label>
  );
}
function ToggleRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-neutral-300">{label}</div>
        {sub && <div className="text-xs text-neutral-500">{sub}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-white size-5"
      />
    </div>
  );
}

/* ===================== Dashboard ===================== */
function Dashboard({
  state,
  weekly,
  setState,
}: {
  state: State;
  weekly: { strengthSets: number; mileage: number; streak: number };
  setState: any;
}) {
  const name = state.profile.name || "Athlete";
  const recent = [...state.logs]
    .sort(
      (a, b) => new Date((b as any).date).getTime() - new Date((a as any).date).getTime()
    )
    .slice(0, 8);

  // Ensure Today template exists (boot a default based on profile)
  useEffect(() => {
    if (state.today) return;
    const defaultToday: TodayTemplate = {
      strength: [
        { name: "Bench Press", sets: 5, reps: 5 },
        { name: "Barbell Row", sets: 4, reps: 8 },
        { name: "Back Squat", sets: 5, reps: 3 },
      ],
      run: state.profile.doubleRuns ? { type: "Easy", distance: 4 } : { type: "Easy", distance: 5 },
    };
    setState((s: State) => ({ ...s, today: defaultToday }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-4 mt-4">
      {/* Hero */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-neutral-400">Welcome back</div>
              <div className="text-2xl font-bold">Hi, {name} 👋</div>
              <div className="mt-1 text-sm text-neutral-400">Goal: {state.profile.goal}</div>
            </div>
            <div className="hidden sm:flex gap-3">
              <Badge>{state.profile.units.distance.toUpperCase()} units</Badge>
              <Badge>{state.profile.doubleRuns ? "Doubles ON" : "Doubles OFF"}</Badge>
              <Badge>{state.profile.noDeadlift ? "No Deadlift" : "All lifts"}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat icon={Dumbbell}  label="Strength sets (wk)" value={`${weekly.strengthSets}`} />
        <Stat icon={Footprints} label="Mileage (wk)" value={`${weekly.mileage.toFixed(1)} ${state.profile.units.distance}`} />
        <Stat icon={Activity}   label="Streak" value={`${weekly.streak} days`} />
      </div>

      {/* Weekly progress vs plan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ProgressBar
          label={`Mileage (${state.profile.units.distance})`}
          value={weekly.mileage}
          target={getPlannedWeeklyMileage(state.profile)}
        />
        <ProgressBar
          label="Strength sets"
          value={weekly.strengthSets}
          target={24}
        />
      </div>

      {/* Today checklist */}
      {state.today && (
        <TodayChecklist state={state} setState={setState} />
      )}

      {/* Recent activity */}
      <Card>
        <CardBody>
          <SectionHeader title="Recent activity" right={<Badge>{recent.length} items</Badge>} />
          {recent.length === 0 ? (
            <div className="text-neutral-400 text-sm">No logs yet — add your first workout or run.</div>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {recent.map((item: any) => (
                <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {item.type === "strength" ? (
                      <Dumbbell className="size-4 text-neutral-300" />
                    ) : item.type === "run" ? (
                      <Footprints className="size-4 text-neutral-300" />
                    ) : (
                      <Activity className="size-4 text-neutral-300" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {item.type === "strength" &&
                          `${item.exercise} — ${item.sets}×${item.reps} @ ${item.weight}${state.profile.units.weight}`}
                        {item.type === "run" &&
                          `${item.runType} ${item.session} — ${item.distance}${state.profile.units.distance} • ${item.duration} min${
                            item.pace ? ` • ${item.pace}/${state.profile.units.distance}` : ""
                          }`}
                        {item.type === "wellness" &&
                          `Wellness — Sleep ${item.sleep}h • kcal ${item.calories} • Protein ${item.protein}g`}
                      </div>
                      <div className="text-xs text-neutral-500">{item.date}</div>
                    </div>
                  </div>
                  {item.type === "strength" && item.completed && <Badge tone="success">Completed</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ===================== Today Checklist (with persist + edit + undo) ===================== */
function TodayChecklist({ state, setState }: { state: State; setState: any }) {
  const date = todayISO();
  // Template (editable, local in app state)
  const strengthTemplate = state.today?.strength ?? [];
  const parsedRun = state.today?.run ?? null;

  // Persisted completion flags
  const [done, setDone] = useState<TodayDone>(() => {
    const store = typeof window !== "undefined" ? loadTodayStore() : {};
    const saved = store[date];
    const base: TodayDone = {
      strength: new Array(strengthTemplate.length).fill(false),
      run: false,
    };
    return saved ?? base;
  });
  function persistDone(next: TodayDone) {
    setDone(next);
    const store = loadTodayStore();
    store[date] = next;
    saveTodayStore(store);
  }

  // Reconcile with existing logs (favor true)
  useEffect(() => {
    const base: TodayDone = {
      strength: strengthTemplate.map((ex) =>
        state.logs.some(
          (l: any) =>
            l.type === "strength" &&
            l.date === date &&
            l.exercise === ex.name &&
            l.completed
        )
      ),
      run: parsedRun ? state.logs.some((l: any) => l.type === "run" && l.date === date) : false,
    };
    setDone((prev) => {
      const next: TodayDone = {
        strength: base.strength.map((v, i) => v || prev.strength[i] || false),
        run: base.run || prev.run,
      };
      const store = loadTodayStore();
      store[date] = next;
      saveTodayStore(store);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, strengthTemplate.length, parsedRun ? parsedRun.type : "no-run", state.logs.length]);

  // Edit drawer local copies
  const [localStrength, setLocalStrength] = useState<StrengthTemplateItem[] | null>(null);
  const [localRun, setLocalRun] = useState<{ type: string; distance: number } | null>(null);
  const currentStrength = localStrength ?? strengthTemplate;
  const currentRun = localRun ?? parsedRun;

  // Undo snackbar
  const [undo, setUndo] = useState<{ id: string; type: "strength" | "run" | null } | null>(null);
  const [undoTimer, setUndoTimer] = useState<any>(null);
  function showUndo(id: string, type: "strength" | "run") {
    if (undoTimer) clearTimeout(undoTimer);
    setUndo({ id, type });
    const t = setTimeout(() => setUndo(null), 6000);
    setUndoTimer(t);
  }

  const [editing, setEditing] = useState(false);

  // Progress %
  const total =
    currentStrength.length + (currentRun ? 1 : 0) || 1;
  const doneCount =
    (done.strength.filter(Boolean).length ?? 0) + (done.run ? 1 : 0);
  const pct = Math.round((doneCount / total) * 100);

  function completeStrength(i: number) {
    const ex = currentStrength[i];
    const entry: Log = {
      id: uid(),
      type: "strength",
      date,
      exercise: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.suggested ?? 0,
      completed: true,
    };
    setState((s: State) => ({ ...s, logs: [...s.logs, entry] }));
    persistDone({
      ...done,
      strength: done.strength.map((v, idx) => (idx === i ? true : v)),
    });
    showUndo(entry.id, "strength");
  }
  function completeRun() {
    if (!currentRun) return;
    const entry: Log = {
      id: uid(),
      type: "run",
      date,
      runType: currentRun.type,
      session: state.profile.doubleRuns ? "AM" : "Solo",
      distance: currentRun.distance,
      duration: Math.round(currentRun.distance * 9),
      pace: "9:00",
    };
    setState((s: State) => ({ ...s, logs: [...s.logs, entry] }));
    persistDone({ ...done, run: true });
    showUndo(entry.id, "run");
  }
  function markAllDone() {
    currentStrength.forEach((_, i) => {
      if (!done.strength[i]) completeStrength(i);
    });
    if (currentRun && !done.run) completeRun();
  }

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Today"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-2 py-1 rounded-md border border-neutral-700 text-neutral-100 hover:bg-neutral-900 text-sm"
              >
                Edit
              </button>
              <Badge tone={pct === 100 ? "success" : pct === 0 ? "danger" : "info"}>{pct}%</Badge>
              <button
                onClick={markAllDone}
                className="px-2 py-1 rounded-md bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-sm flex items-center gap-1"
              >
                <Check className="size-4" /> Mark all done
              </button>
            </div>
          }
        />

        {/* Strength list */}
        <div className="grid gap-2 mb-3">
          <div className="text-sm text-neutral-400">Strength</div>
          {currentStrength.length === 0 ? (
            <div className="text-xs text-neutral-500">No strength scheduled.</div>
          ) : (
            currentStrength.map((ex, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2"
              >
                <div className="text-sm">
                  <div className="font-medium">{ex.name}</div>
                  <div className="text-neutral-400 text-xs">{ex.sets}×{ex.reps}</div>
                </div>
                <div className="flex items-center gap-2">
                  {done.strength[i] ? (
                    <Badge tone="success">Done</Badge>
                  ) : (
                    <>
                      <button
                        onClick={() => completeStrength(i)}
                        className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-900 text-xs"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() =>
                          persistDone({
                            ...done,
                            strength: done.strength.map((v, idx) => (idx === i ? false : v)),
                          })
                        }
                        className="px-2 py-1 rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs flex items-center gap-1"
                      >
                        <X className="size-4" /> Skip
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Run */}
        <div className="grid gap-2">
          <div className="text-sm text-neutral-400">Run</div>
          {!currentRun ? (
            <div className="text-xs text-neutral-500">No run scheduled.</div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">{currentRun.type}</div>
                <div className="text-neutral-400 text-xs">
                  {currentRun.distance} {state.profile.units.distance}
                </div>
              </div>
              <div>
                {done.run ? (
                  <Badge tone="success">Done</Badge>
                ) : (
                  <button
                    onClick={completeRun}
                    className="px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-900 text-xs"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Undo snackbar */}
        {undo && (
          <div className="fixed bottom-4 right-4 z-50 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm shadow flex items-center gap-3">
            <span>Logged {undo.type === "run" ? "run" : "strength"} — undo?</span>
            <button
  className="px-2 py-1 rounded-md border border-neutral-600 hover:bg-neutral-800 text-xs"
  onClick={() => {
    setState((s: State) => ({ ...s, logs: s.logs.filter((l: any) => l.id !== undo!.id) }));
    setUndo(null);
  }}
>
  Undo
</button>

          </div>
        )}

        {/* Edit Today Drawer */}
        {editing && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-neutral-950 border-l border-neutral-800 shadow-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold">Edit Today</div>
                <button
                  onClick={() => {
                    // commit edits to app state
                    setState((s: State) => ({
                      ...s,
                      today: {
                        strength: localStrength ?? strengthTemplate,
                        run: localRun ?? parsedRun,
                      },
                    }));
                    setEditing(false);
                  }}
                  className="px-2 py-1 rounded-md bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                >
                  Save
                </button>
              </div>

              {/* Strength editor */}
              <div className="mb-4">
                <div className="text-sm font-semibold mb-2">Strength</div>
                <ul className="space-y-2">
                  {(localStrength ?? strengthTemplate).map((ex, i) => (
                    <li key={i} className="rounded-md border border-neutral-800 p-2">
                      <div className="text-sm font-medium mb-2">{ex.name}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-neutral-400">
                          Sets
                          <input
                            type="number"
                            className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1"
                            value={ex.sets}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value || "1"));
                              const next = (localStrength ?? strengthTemplate).map((t, idx) =>
                                idx === i ? { ...t, sets: v } : t
                              );
                              setLocalStrength(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-neutral-400">
                          Reps
                          <input
                            type="number"
                            className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1"
                            value={ex.reps}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value || "1"));
                              const next = (localStrength ?? strengthTemplate).map((t, idx) =>
                                idx === i ? { ...t, reps: v } : t
                              );
                              setLocalStrength(next);
                            }}
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <button
                          className="text-xs px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-900"
                          onClick={() => {
                            const next = (localStrength ?? strengthTemplate).filter((_, idx) => idx !== i);
                            setLocalStrength(next);
                            // also trim done flags shape
                            persistDone({
                              ...done,
                              strength: done.strength.filter((_, idx) => idx !== i),
                            });
                          }}
                        >
                          Remove
                        </button>
                        {i > 0 && (
                          <button
                            className="text-xs px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-900"
                            onClick={() => {
                              const next = [...(localStrength ?? strengthTemplate)];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              setLocalStrength(next);
                              const d = [...done.strength];
                              [d[i - 1], d[i]] = [d[i], d[i - 1]];
                              persistDone({ ...done, strength: d });
                            }}
                          >
                            Move up
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Add new exercise */}
                <AddExerciseRow
                  onAdd={(name, sets, reps) => {
                    const next = [...(localStrength ?? strengthTemplate), { name, sets, reps }];
                    setLocalStrength(next);
                    persistDone({ ...done, strength: [...done.strength, false] });
                  }}
                />
              </div>

              {/* Run editor */}
              <div className="mb-2">
                <div className="text-sm font-semibold mb-2">Run</div>
                {currentRun ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-neutral-400 col-span-1">
                      Type
                      <select
                        className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1"
                        value={(localRun ?? currentRun).type}
                        onChange={(e) =>
                          setLocalRun({ ...(localRun ?? currentRun)!, type: e.target.value })
                        }
                      >
                        {runTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-neutral-400 col-span-1">
                      Distance ({state.profile.units.distance})
                      <input
                        type="number"
                        step="0.1"
                        className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1"
                        value={(localRun ?? currentRun).distance}
                        onChange={(e) =>
                          setLocalRun({
                            ...(localRun ?? currentRun)!,
                            distance: parseFloat(e.target.value || "0"),
                          })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500">No run scheduled.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AddExerciseRow({
  onAdd,
}: {
  onAdd: (name: string, sets: number, reps: number) => void;
}) {
  const [name, setName] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(8);
  return (
    <div className="mt-3 grid grid-cols-6 gap-2">
      <input
        className="col-span-3 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sm"
        placeholder="Exercise name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="number"
        className="col-span-1 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sm"
        value={sets}
        onChange={(e) => setSets(Math.max(1, parseInt(e.target.value || "1")))}
      />
      <input
        type="number"
        className="col-span-1 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sm"
        value={reps}
        onChange={(e) => setReps(Math.max(1, parseInt(e.target.value || "1")))}
      />
      <button
        className="col-span-1 px-2 py-1 rounded-md border border-neutral-700 hover:bg-neutral-900 text-sm"
        onClick={() => {
          if (!name.trim()) return;
          onAdd(name.trim(), sets, reps);
          setName("");
          setSets(3);
          setReps(8);
        }}
      >
        Add
      </button>
    </div>
  );
}

/* ===================== Strength Logger ===================== */
function StrengthLogger({ state, setState }: { state: State; setState: any }) {
  const units = state.profile.units.weight;
  const [date, setDate] = useState(todayISO());
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(8);
  const [weight, setWeight] = useState(0);
  const [completed, setCompleted] = useState(true);

  useEffect(() => {
    if (exercise) setWeight(suggestWeight(state.logs, exercise, units));
  }, [exercise, units, state.logs]);

  const allowedExercises = defaultExercises.filter((ex) =>
    state.profile.noDeadlift ? ex.name !== "Deadlift" : true
  );

  return (
    <div className="mt-4 border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Log Strength</h3>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Date">
          <input
            type="date"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labeled>
        <div className="col-span-2">
          <Labeled label="Exercise">
            <select
              className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            >
              <option value="" disabled>
                Choose exercise
              </option>
              {allowedExercises.map((e) => (
                <option key={e.name} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        <Labeled label="Sets">
          <input
            type="number"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={sets}
            onChange={(e) => setSets(parseInt(e.target.value || "0"))}
          />
        </Labeled>
        <Labeled label="Reps">
          <input
            type="number"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={reps}
            onChange={(e) => setReps(parseInt(e.target.value || "0"))}
          />
        </Labeled>
        <div className="col-span-2">
          <Labeled label={`Weight (${units})`}>
            <input
              type="number"
              step="0.5"
              className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value || "0"))}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Suggested based on last session. Bump by +2.5lb / +1.25kg when completed.
            </p>
          </Labeled>
        </div>
        <div className="flex items-center gap-2 col-span-2">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="accent-white"
          />
          <span className="text-sm text-neutral-300">Mark as completed</span>
        </div>
        <div className="col-span-2">
          <button
            className="w-full px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md"
            disabled={!exercise}
            onClick={() => {
              const entry: Log = {
                id: uid(),
                type: "strength",
                date,
                exercise,
                sets,
                reps,
                weight,
                completed,
              };
              setState({ ...state, logs: [...state.logs, entry] });
            }}
          >
            Add Strength Entry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Run Logger ===================== */
function RunLogger({ state, setState }: { state: State; setState: any }) {
  const units = state.profile.units.distance;
  const [date, setDate] = useState(todayISO());
  const [runType, setRunType] = useState("Easy");
  const [session, setSession] = useState(state.profile.doubleRuns ? "AM" : "Solo");
  const [distance, setDistance] = useState(3);
  const [duration, setDuration] = useState(25);
  const [pace, setPace] = useState("");

  useEffect(() => {
    if (!pace && distance > 0 && duration > 0) {
      const per = duration / distance; // min per unit
      setPace(`${per.toFixed(1)} min`);
    }
  }, [distance, duration]);

  return (
    <div className="mt-4 border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Log Run</h3>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Date">
          <input
            type="date"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labeled>
        <Labeled label="Type">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={runType}
            onChange={(e) => setRunType(e.target.value)}
          >
            {runTypes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Session">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={session}
            onChange={(e) => setSession(e.target.value as any)}
          >
            {state.profile.doubleRuns ? (
              <>
                <option value="AM">AM (primary)</option>
                <option value="PM">PM (secondary)</option>
              </>
            ) : (
              <option value="Solo">Solo</option>
            )}
          </select>
        </Labeled>
        <Labeled label={`Distance (${units})`}>
          <input
            type="number"
            step="0.1"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={distance}
            onChange={(e) => setDistance(parseFloat(e.target.value || "0"))}
          />
        </Labeled>
        <Labeled label="Duration (min)">
          <input
            type="number"
            step="1"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={duration}
            onChange={(e) => setDuration(parseFloat(e.target.value || "0"))}
          />
        </Labeled>
        <div className="col-span-2">
          <Labeled label="Pace (auto)">
            <input
              className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
              readOnly
              value={pace ? `${pace}/${units}` : ""}
            />
          </Labeled>
        </div>
        <div className="col-span-2">
          <button
            className="w-full px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md"
            onClick={() => {
              const entry: Log = {
                id: uid(),
                type: "run",
                date,
                runType,
                session: session as any,
                distance,
                duration,
                pace: pace?.replace(" min", ""),
              };
              const sameDayRuns = state.logs.filter((l: any) => l.type === "run" && l.date === date);
              const totalOther = sameDayRuns.reduce((m: number, r: any) => Math.max(m, r.distance || 0), 0);
              if (state.profile.doubleRuns && session === "PM" && distance >= totalOther) {
                alert("Reminder: Longer run should be AM (primary). Consider swapping.");
              }
              setState({ ...state, logs: [...state.logs, entry] });
            }}
          >
            Add Run
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Wellness ===================== */
function AdvancedWellness({ state, setState }: { state: State; setState: any }) {
  const [date, setDate] = useState(todayISO());
  const [sleep, setSleep] = useState(7.0);
  const [calories, setCalories] = useState(2200);
  const [protein, setProtein] = useState(150);
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Sleep & Nutrition</h3>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Date">
          <input
            type="date"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labeled>
        <Labeled label="Sleep (h)">
          <input
            type="number"
            step="0.1"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={sleep}
            onChange={(e) => setSleep(parseFloat(e.target.value || "0"))}
          />
        </Labeled>
        <Labeled label="Calories">
          <input
            type="number"
            step="1"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={calories}
            onChange={(e) => setCalories(parseInt(e.target.value || "0"))}
          />
        </Labeled>
        <Labeled label="Protein (g)">
          <input
            type="number"
            step="1"
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={protein}
            onChange={(e) => setProtein(parseInt(e.target.value || "0"))}
          />
        </Labeled>
        <div className="col-span-2">
          <Labeled label="Notes">
            <textarea
              className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you felt, HRV, soreness…"
            />
          </Labeled>
        </div>
        <div className="col-span-2">
          <button
            className="w-full px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md"
            onClick={() => {
              const entry: Log = { id: uid(), type: "wellness", date, sleep, calories, protein, notes };
              setState({ ...state, logs: [...state.logs, entry] });
            }}
          >
            Add Wellness
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Settings (incl. Theme) ===================== */
function SettingsBackup({ state, setState }: { state: State; setState: any }) {
  const [weightUnit, setWeightUnit] = useState(state.profile.units.weight);
  const [distUnit, setDistUnit] = useState(state.profile.units.distance);
  const [accent, setAccent] = useState<State["settings"]["accent"]>(state.settings.accent);
  const [density, setDensity] = useState<State["settings"]["density"]>(state.settings.density);

  useEffect(() => {
    setWeightUnit(state.profile.units.weight);
    setDistUnit(state.profile.units.distance);
  }, [state.profile.units]);

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `force3_backup_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleImport(evt: any) {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || ""));
        if (parsed?.logs && parsed?.profile) {
          saveState(parsed);
          window.location.reload();
        } else alert("Invalid file");
      } catch {
        alert("Import failed");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mt-4 border border-neutral-800 bg-neutral-900 rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">Settings</h3>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Weight unit">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={weightUnit}
            onChange={(e) => {
              const v = e.target.value as Units["weight"];
              setWeightUnit(v);
              setState({
                ...state,
                profile: { ...state.profile, units: { ...state.profile.units, weight: v } },
              });
            }}
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </Labeled>

        <Labeled label="Distance unit">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={distUnit}
            onChange={(e) => {
              const v = e.target.value as Units["distance"];
              setDistUnit(v);
              setState({
                ...state,
                profile: { ...state.profile, units: { ...state.profile.units, distance: v } },
              });
            }}
          >
            <option value="mi">mi</option>
            <option value="km">km</option>
          </select>
        </Labeled>

        <Labeled label="Accent color">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={accent}
            onChange={(e) => {
              const v = e.target.value as State["settings"]["accent"];
              setAccent(v);
              setState({ ...state, settings: { ...state.settings, accent: v } });
            }}
          >
            <option value="blue">Electric Blue</option>
            <option value="mint">Mint</option>
            <option value="purple">Purple</option>
          </select>
        </Labeled>

        <Labeled label="Density">
          <select
            className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full"
            value={density}
            onChange={(e) => {
              const v = e.target.value as State["settings"]["density"];
              setDensity(v);
              setState({ ...state, settings: { ...state.settings, density: v } });
            }}
          >
            <option value="cozy">Cozy</option>
            <option value="compact">Compact</option>
          </select>
        </Labeled>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={handleExport} className="px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md">
          Export JSON
        </button>
        <label className="text-sm cursor-pointer border border-neutral-700 rounded-md px-3 py-2">
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </label>
        <button
          className="ml-auto px-3 py-2 bg-red-500 text-white rounded-md"
          onClick={() => {
            if (confirm("Reset all data?")) {
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(TODAY_STORE);
              window.location.reload();
            }
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ===================== Plan Tab (Coach Ricky + Versions + Week Editor + Pace + Constraints + Notes + Export) ===================== */
function PlanTab({ state, setState }: { state: State; setState: any }) {
  const basePlan = useMemo(() => generatePlan(state.profile), [state.profile]);

  /* ---------- Coach Ricky (AI) ---------- */
  const [baseMileage, setBaseMileage] = useState<number>(30);
  const [longestRun, setLongestRun] = useState<number>(10);
  const [recent5k, setRecent5k] = useState<string>("20:00");
  const [goalTime, setGoalTime] = useState<string>("3:00:00");
  const [raceDate, setRaceDate] = useState<string>("");
  const [injuries, setInjuries] = useState<string>("");
  const [gymAccess, setGymAccess] = useState<boolean>(true);
  const [preferredRest, setPreferredRest] = useState<string>("Mon");

  // Constraints (micro-toggles)
  const [noBackToBackIntensity, setNoBackToBackIntensity] = useState(true);
  const [capLongRun, setCapLongRun] = useState<number>(22);
  const [neverDeadlift, setNeverDeadlift] = useState(state.profile.noDeadlift);

  const [coachPlan, setCoachPlan] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorNote, setErrorNote] = useState<string>("");

  async function askCoachStreaming() {
    setLoading(true);
    setErrorNote("");
    setCoachPlan("");

    const questions = {
      baseMileage,
      longestRun,
      recent5k,
      goalTime,
      raceDate,
      injuries,
      gymAccess,
      preferredRest,
      doublesEnabled: state.profile.doubleRuns,
      noDeadlift: neverDeadlift,
      units: state.profile.units,
      goal: state.profile.goal,
      constraints: {
        noBackToBackIntensity,
        capLongRun,
      },
    };

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: state.profile, questions }),
      });

      // Friendly errors
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setErrorNote("Coach Ricky can't access the API. Check your API key and project access.");
        } else if (res.status === 429) {
          setErrorNote("Rate limit or billing quota reached. Try again later or enable billing.");
        } else {
          setErrorNote(`Coach error: ${res.status} ${res.statusText}`);
        }
        try {
          const j = await res.json();
          if (j?.error) setErrorNote((p) => `${p}\n${j.error}`);
        } catch {}
        setLoading(false);
        return;
      }

      // Try streaming first
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          setCoachPlan((prev) => prev + chunk);
        }
        // If server returned JSON instead of raw text, fallback parse
        try {
          const maybeJson = JSON.parse(full);
          if (maybeJson?.plan) setCoachPlan(String(maybeJson.plan));
        } catch {
          /* ignore — it was streamed text */
        }
      } else {
        // Non-streaming JSON response
        const data = await res.json();
        setCoachPlan(String(data.plan || ""));
      }
    } catch (e: any) {
      setErrorNote(`Network error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Plan Versions (localStorage) ---------- */
  type PlanVersion = { id: string; name: string; content: string; createdAt: string };
  const VERS_KEY = "force3_plan_versions_v1";

  function loadVersions(): PlanVersion[] {
    try {
      const raw = localStorage.getItem(VERS_KEY);
      return raw ? (JSON.parse(raw) as PlanVersion[]) : [];
    } catch {
      return [];
    }
  }
  function saveVersions(list: PlanVersion[]) {
    try { localStorage.setItem(VERS_KEY, JSON.stringify(list)); } catch {}
  }

  const [versions, setVersions] = useState<PlanVersion[]>(() => loadVersions());
  const [versionName, setVersionName] = useState("");

  function saveCurrentAsVersion() {
    if (!coachPlan.trim()) { alert("Nothing to save — ask Coach Ricky or paste your plan text first."); return; }
    const v: PlanVersion = { id: uid(), name: versionName.trim() || `Plan ${new Date().toLocaleString()}`, content: coachPlan, createdAt: new Date().toISOString() };
    const list = [v, ...versions].slice(0, 50);
    setVersions(list); saveVersions(list); setVersionName("");
  }
  function deleteVersion(id: string) {
    const list = versions.filter(v => v.id !== id);
    setVersions(list); saveVersions(list);
  }
  function loadVersion(id: string) {
    const v = versions.find(x => x.id === id);
    if (v) setCoachPlan(v.content);
  }
  function useVersionForToday(id: string) {
    const v = versions.find(x => x.id === id);
    if (!v) return;
    // very simple parse: try to find “strength” lines and one “run” with distance
    const strength: StrengthTemplateItem[] = [];
    v.content.split(/\r?\n/).forEach(line => {
      const m = line.match(/(bench|row|squat|press|pull|deadlift|db|curl|pushdown)/i);
      const sr = line.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (m && sr) strength.push({ name: capitalize(m[1]), sets: parseInt(sr[1]), reps: parseInt(sr[2]) });
    });
    const runM = v.content.match(/(\bLong\b|\bEasy\b|\bTempo\b|\bIntervals?\b|\bRecovery\b).*?(\d+(\.\d+)?)\s*(mi|km)/i);
    const run = runM ? { type: runM[1], distance: convertDistance(parseFloat(runM[2]), (runM[4] as any), state.profile.units.distance) } : null;

    setState((s: State) => ({ ...s, today: { strength: strength.slice(0, 5), run } }));
    alert("Applied saved plan to Today.");
  }

  function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  function convertDistance(val: number, from: "mi" | "km", to: "mi" | "km") {
    if (from === to) return Math.round(val);
    return from === "mi" ? Math.round(val * 1.60934) : Math.round(val / 1.60934);
  }

  /* ---------- Week Grid Editor (Mon–Sun) ---------- */
  type DayItem = { kind: "run" | "strength" | "rest"; label: string };
  type WeekGrid = { days: { name: string; items: DayItem[] }[] };

  const defaultWeek: WeekGrid = {
    days: [
      { name: "Mon", items: [{ kind: "strength", label: "Upper (Bench/Row), easy 4" }] },
      { name: "Tue", items: [{ kind: "run", label: "Tempo 6" }] },
      { name: "Wed", items: [{ kind: "strength", label: "Lower (Squat), bike 45m" }] },
      { name: "Thu", items: [{ kind: "run", label: "Easy 6" }] },
      { name: "Fri", items: [{ kind: "run", label: state.profile.doubleRuns ? "AM 5 / PM 3" : "Easy 7" }] },
      { name: "Sat", items: [{ kind: "run", label: "Long 14" }] },
      { name: "Sun", items: [{ kind: "run", label: "Recovery 4 + mobility" }] },
    ],
  };
  const [week, setWeek] = useState<WeekGrid>(defaultWeek);

  function addItem(dayIdx: number, kind: DayItem["kind"], text: string) {
    if (!text.trim()) return;
    setWeek(w => {
      const next = structuredClone(w);
      next.days[dayIdx].items.push({ kind, label: text.trim() });
      return next;
    });
  }
  function removeItem(dayIdx: number, idx: number) {
    setWeek(w => {
      const next = structuredClone(w);
      next.days[dayIdx].items.splice(idx, 1);
      return next;
    });
  }
  function moveItem(dayIdx: number, idx: number, dir: -1 | 1) {
    setWeek(w => {
      const next = structuredClone(w);
      const arr = next.days[dayIdx].items;
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return w;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return next;
    });
  }
  function applyWeekToToday() {
    // Build a Today template from Monday strength + Saturday/Sunday run heuristics
    const mon = week.days.find(d => d.name === "Mon");
    const sat = week.days.find(d => d.name === "Sat");
    const sun = week.days.find(d => d.name === "Sun");

    const strength: StrengthTemplateItem[] = [];
    (mon?.items || []).forEach(it => {
      if (it.kind === "strength") {
        // Try parse sets x reps
        const m = it.label.match(/(\d+)\s*[x×]\s*(\d+)/i);
        strength.push({
          name: it.label.replace(/-\s*\d+\s*[x×]\s*\d+/i, "").replace(/\s+\d+\s*[x×]\s*\d+/i, "").trim(),
          sets: m ? parseInt(m[1]) : 4,
          reps: m ? parseInt(m[2]) : 8,
        });
      }
    });

    // Prefer Sat long run, else Sun
    const longStr = (sat?.items || []).find(i => /long/i.test(i.label))?.label
      || (sun?.items || []).find(i => /long/i.test(i.label))?.label
      || (sat?.items[0]?.label || sun?.items[0]?.label || "");

    const runMatch = longStr.match(/(Long|Easy|Tempo|Intervals?|Recovery).*?(\d+(\.\d+)?)/i);
    const run = runMatch ? {
      type: runMatch[1][0].toUpperCase() + runMatch[1].slice(1).toLowerCase(),
      distance: parseFloat(runMatch[2] || "0"),
    } : null;

    setState((s: State) => ({ ...s, today: { strength, run } }));
    alert("Applied Week Grid → Today.");
  }

  /* ---------- Pace Helper ---------- */
  const [paceGoal, setPaceGoal] = useState<{ mp: string; hmp: string; k10: string }>({ mp: "", hmp: "", k10: "" });

  function hhmmssToSeconds(s: string) {
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(s) || 0;
  }
  function formatPace(secPerUnit: number, unit: "mi" | "km") {
    if (!secPerUnit || !isFinite(secPerUnit)) return "";
    const m = Math.floor(secPerUnit / 60);
    const s = Math.round(secPerUnit % 60).toString().padStart(2, "0");
    return `${m}:${s}/${unit}`;
  }
  function computePaces() {
    // marathon time to pace per mile/km
    const total = hhmmssToSeconds(goalTime || "0");
    if (!total) { setPaceGoal({ mp: "", hmp: "", k10: "" }); return; }
    const marathonDistance = state.profile.units.distance === "mi" ? 26.2 : 42.195; // convert to user's display unit
    const per = total / marathonDistance;
    const mp = formatPace(per, state.profile.units.distance);
    const hmp = formatPace(per * 0.95, state.profile.units.distance); // HM quicker ~5%
    const k10 = formatPace(per * 0.9, state.profile.units.distance);  // 10K quicker ~10%
    setPaceGoal({ mp, hmp, k10 });
  }

  /* ---------- Week Notes (localStorage per week) ---------- */
  const NOTES_KEY = "force3_week_notes_v1";
  function loadNotes(): string[] {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]"); } catch { return []; }
  }
  function saveNotes(arr: string[]) {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(arr)); } catch {}
  }
  const [weekNotes, setWeekNotes] = useState<string[]>(() => {
    const arr = loadNotes();
    return Array.from({ length: 16 }, (_, i) => arr[i] || "");
  });
  function setNote(i: number, text: string) {
    setWeekNotes(prev => {
      const next = [...prev];
      next[i] = text;
      saveNotes(next);
      return next;
    });
  }

  /* ---------- Export helpers ---------- */
  function copyPlanMarkdown() {
    const text = coachPlan.trim() || basePlanToMarkdown(basePlan);
    navigator.clipboard.writeText(text).then(() => alert("Plan copied to clipboard (Markdown)."));
  }
  function copyWeekChecklist(i: number) {
    const w = basePlan[i];
    const md = `### Week ${i + 1} — ${w.summary}\n\n- ${w.days.join("\n- ")}`;
    navigator.clipboard.writeText(md).then(() => alert(`Week ${i + 1} copied.`));
  }
  function basePlanToMarkdown(plan: WeekPlan[]) {
    return plan.map((w, i) => `## Week ${i + 1} — ${w.summary}\n\n- ${w.days.join("\n- ")}\n`).join("\n");
  }

  return (
    <div id="plan-anchor" className="mt-4 grid gap-4">
      {/* Header */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide">Plan</div>
              <div className="text-2xl font-bold">16-Week Marathon</div>
              <div className="text-sm text-neutral-400 mt-1">
                {state.profile.doubleRuns ? "Doubles on" : "Singles only"} • {state.profile.noDeadlift ? "No deadlift" : "All lifts"} • Units: {state.profile.units.distance}/{state.profile.units.weight}
              </div>
            </div>
            <Trophy className="hidden sm:block size-7 text-neutral-300" />
          </div>
        </CardBody>
      </Card>

      {/* Coach Ricky form + constraints + actions */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Ask Coach Ricky (AI)"
            right={<Badge>{loading ? "Working…" : "Personalize"}</Badge>}
          />
          <div className="grid md:grid-cols-2 gap-3">
            <Labeled label={`Current weekly mileage (${state.profile.units.distance})`}>
              <input type="number" className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={baseMileage} onChange={e=>setBaseMileage(parseFloat(e.target.value||"0"))} />
            </Labeled>
            <Labeled label={`Longest recent run (${state.profile.units.distance})`}>
              <input type="number" className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={longestRun} onChange={e=>setLongestRun(parseFloat(e.target.value||"0"))} />
            </Labeled>
            <Labeled label="Recent 5K (mm:ss, optional)">
              <input className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={recent5k} onChange={e=>setRecent5k(e.target.value)} />
            </Labeled>
            <Labeled label="Goal marathon time (hh:mm:ss)">
              <input className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={goalTime} onChange={e=>setGoalTime(e.target.value)} onBlur={computePaces} />
            </Labeled>
            <Labeled label="Race date (optional)">
              <input type="date" className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={raceDate} onChange={e=>setRaceDate(e.target.value)} />
            </Labeled>
            <Labeled label="Preferred rest day">
              <select className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={preferredRest} onChange={e=>setPreferredRest(e.target.value)}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </Labeled>

            {/* Constraints */}
            <div className="col-span-2 grid md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="checkbox" className="accent-white size-5" checked={noBackToBackIntensity} onChange={e=>setNoBackToBackIntensity(e.target.checked)} />
                No back-to-back intensity
              </label>
              <Labeled label={`Cap long run (${state.profile.units.distance})`}>
                <input type="number" className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" value={capLongRun} onChange={e=>setCapLongRun(parseFloat(e.target.value||"0"))} />
              </Labeled>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="checkbox" className="accent-white size-5" checked={neverDeadlift} onChange={e=>setNeverDeadlift(e.target.checked)} />
                Never schedule deadlifts
              </label>
            </div>

            {/* Context */}
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input id="gym" type="checkbox" className="accent-white size-5" checked={gymAccess} onChange={e=>setGymAccess(e.target.checked)} />
              I have gym access
            </label>
            <Labeled label="Injuries / notes (optional)">
              <input className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 w-full" placeholder="ITB tightness, past shin splints…" value={injuries} onChange={e=>setInjuries(e.target.value)} />
            </Labeled>
          </div>

          {/* Pace helper */}
          <div className="mt-3 grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
              <div className="text-xs text-neutral-400">MP</div>
              <div className="text-lg font-semibold">{paceGoal.mp || "—"}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
              <div className="text-xs text-neutral-400">HMP</div>
              <div className="text-lg font-semibold">{paceGoal.hmp || "—"}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
              <div className="text-xs text-neutral-400">10K</div>
              <div className="text-lg font-semibold">{paceGoal.k10 || "—"}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={askCoachStreaming} disabled={loading} className="px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md disabled:opacity-60">
              {loading ? "Asking Coach Ricky…" : "Ask Coach Ricky"}
            </button>
            <button onClick={()=>setCoachPlan("")} className="px-3 py-2 rounded-md border border-neutral-700 text-neutral-200">Clear</button>
            <button onClick={copyPlanMarkdown} className="px-3 py-2 rounded-md border border-neutral-700 text-neutral-200">Copy plan (Markdown)</button>
          </div>

          {errorNote && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-700/40 bg-rose-600/10 p-3 text-sm">
              <AlertCircle className="size-5 text-rose-300 mt-0.5" />
              <div className="whitespace-pre-wrap text-rose-200">{errorNote}</div>
            </div>
          )}

          {coachPlan && (
            <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-neutral-400">Coach Ricky result</div>
                <div className="flex items-center gap-2">
                  <input className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sm" placeholder="Version name (optional)" value={versionName} onChange={e=>setVersionName(e.target.value)} />
                  <button className="px-2 py-1 rounded-md border border-neutral-700 text-sm hover:bg-neutral-900" onClick={saveCurrentAsVersion}>Save version</button>
                  <button className="px-2 py-1 rounded-md border border-neutral-700 text-sm hover:bg-neutral-900" onClick={()=>useVersionForToday(versions[0]?.id || "")}>Use latest → Today</button>
                </div>
              </div>
              <textarea className="w-full min-h-48 bg-transparent outline-none text-sm text-neutral-200" value={coachPlan} onChange={e=>setCoachPlan(e.target.value)} />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Versions list */}
      {versions.length > 0 && (
        <Card>
          <CardBody>
            <SectionHeader title="Saved plan versions" right={<Badge>{versions.length}</Badge>} />
            <ul className="divide-y divide-neutral-800">
              {versions.map(v=>(
                <li key={v.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{v.name}</div>
                    <div className="text-xs text-neutral-500">{new Date(v.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 rounded-md border border-neutral-700 text-xs hover:bg-neutral-900" onClick={()=>loadVersion(v.id)}>Load</button>
                    <button className="px-2 py-1 rounded-md border border-neutral-700 text-xs hover:bg-neutral-900" onClick={()=>useVersionForToday(v.id)}>Use → Today</button>
                    <button className="px-2 py-1 rounded-md border border-neutral-700 text-xs hover:bg-neutral-900" onClick={()=>{ if(confirm("Delete this saved version?")) deleteVersion(v.id); }}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Week Grid Editor */}
      <Card>
        <CardBody>
          <SectionHeader title="Week grid editor (Mon–Sun)" right={<button className="px-2 py-1 rounded-md border border-neutral-700 text-xs hover:bg-neutral-900" onClick={applyWeekToToday}>Apply week → Today</button>} />
          <div className="grid sm:grid-cols-2 gap-3">
            {week.days.map((d, di)=>(
              <div key={d.name} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                <div className="font-semibold mb-2">{d.name}</div>
                <ul className="space-y-2">
                  {d.items.map((it, i)=>(
                    <li key={i} className="rounded-md border border-neutral-800 p-2 flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="opacity-70 mr-2">[{it.kind}]</span>{it.label}
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="px-2 py-0.5 rounded border border-neutral-700 text-xs" onClick={()=>moveItem(di, i, -1)}>↑</button>
                        <button className="px-2 py-0.5 rounded border border-neutral-700 text-xs" onClick={()=>moveItem(di, i, +1)}>↓</button>
                        <button className="px-2 py-0.5 rounded border border-neutral-700 text-xs" onClick={()=>removeItem(di, i)}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
                {/* Add row */}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <select id={`kind-${di}`} className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sm">
                    <option value="run">Run</option>
                    <option value="strength">Strength</option>
                    <option value="rest">Rest</option>
                  </select>
                  <input id={`text-${di}`} className="col-span-2 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sm" placeholder={d.name === "Sat" ? "Long 14" : "Easy 6 / Bench 5x5"} />
                  <button
                    className="col-span-3 px-2 py-1 rounded-md border border-neutral-700 text-sm hover:bg-neutral-900"
                    onClick={()=>{
                      const kind = (document.getElementById(`kind-${di}`) as HTMLSelectElement).value as DayItem["kind"];
                      const text = (document.getElementById(`text-${di}`) as HTMLInputElement).value;
                      addItem(di, kind, text);
                      (document.getElementById(`text-${di}`) as HTMLInputElement).value = "";
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Baseline plan with notes + export per week */}
      <Card>
        <CardBody className="pt-4">
          <SectionHeader title="Baseline plan (local rules)" right={<CalIcon className="size-4 text-neutral-400" />} />
          <div className="grid gap-2">
            {basePlan.map((week, i)=>{
              return (
                <details key={i} className="group rounded-lg border border-neutral-800 bg-neutral-950">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 hover:bg-neutral-900 rounded-lg">
                    <div className="font-semibold">Week {i + 1} — {week.summary}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-neutral-400">{formatDistance(week.weeklyMiles, state.profile.units.distance)} / wk</div>
                      <button className="px-2 py-1 rounded-md border border-neutral-700 text-xs hover:bg-neutral-900" onClick={(e) => { e.preventDefault(); copyWeekChecklist(i); } }>Copy week</button>
                      <button className="px-2 py-1 rounded-md border border-neutral-700 text-xs hover:bg-neutral-900" onClick={(e) => { e.preventDefault(); setState((s: State) => ({ ...s, today: { strength: [{ name: "Bench Press", sets: 5, reps: 5 }, { name: "Barbell Row", sets: 4, reps: 8 }], run: { type: /Long/i.test(week.days.join(" ")) ? "Long" : "Easy", distance: /(\d+(\.\d+)?)\s*(mi|km)/i.test(week.days.join(" ")) ? convertDistance(parseFloat(week.days.join(" ").match(/(\d+(\.\d+)?)\s*(mi|km)/i)![1]), (week.days.join(" ").match(/(\d+(\.\d+)?)\s*(mi|km)/i)![3] as any), state.profile.units.distance) : 8 } } })); alert("Loaded this week into Today."); } }>Use this week → Today</button>
                    </div>
                  </summary>
                  <div className="px-4 pb-4">
                    <ul className="text-sm text-neutral-300 list-disc ml-5 space-y-1">{week.days.map((d, j) => <li key={j}>{d}</li>)}</ul>
                    <div className="mt-3">
                      <div className="text-xs text-neutral-400 mb-1">Notes</div>
                      <textarea className="w-full min-h-20 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1 text-sm" value={weekNotes[i] || ""} onChange={e => setNote(i, e.target.value)} placeholder="Fueling, shoes, route, logistics…" />
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
          <div className="mt-3">
            <button className="px-3 py-2 rounded-md border border-neutral-700 text-neutral-200" onClick={copyPlanMarkdown}>
              Copy entire baseline plan (Markdown)
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


/* ===================== Weekly Summary ===================== */
function summarizeWeekly(logs: Log[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);

  const inWeek = logs.filter((l) => {
    const d = new Date(l.date);
    return d >= start && d <= now;
  });

  const strengthSets = inWeek
    .filter((l) => l.type === "strength")
    .reduce((sum, l: any) => sum + (l.sets || 0), 0);

  const mileage = inWeek
    .filter((l) => l.type === "run")
    .reduce((sum, l: any) => sum + (l.distance || 0), 0);

  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const has = logs.some((l: any) => l.date === iso);
    if (has) streak++;
    else break;
  }

  return { strengthSets, mileage, streak };
}

