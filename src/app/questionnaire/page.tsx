"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type QuestionOption = { value: string; label: string };
type Question = {
  id: string;
  type: "single_choice" | "multi_choice" | "number" | "text" | "select" | "date";
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: QuestionOption[];
  help?: string;
  min?: number;
  max?: number;
};

const QUESTIONNAIRE: Question[] = [
  { id: "name", type: "text", label: "What's your name?", required: true },
  { id: "age", type: "number", label: "How old are you?", min: 13, max: 100 },
  { id: "gender", type: "single_choice", label: "Gender", options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other / Prefer not to say" },
  ]},
  { id: "goal", type: "select", label: "Primary fitness goal", options: [
      { value: "fat_loss", label: "Aggressive fat loss" },
      { value: "recomposition", label: "Recomposition" },
      { value: "muscle_gain", label: "Muscle gain" },
      { value: "marathon", label: "Marathon performance" },
  ]},
  { id: "experience", type: "select", label: "Training experience", options: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
  ]},
  { id: "sports", type: "text", label: "Other sports or activities?" },
  { id: "injuries", type: "text", label: "Any injuries or restrictions?" },
  { id: "noDeadlift", type: "single_choice", label: "Include deadlifts?", options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
  ]},
  { id: "doubleRuns", type: "single_choice", label: "Include double-run days?", options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
  ]},
  { id: "unitsWeight", type: "select", label: "Weight unit", options: [
      { value: "lb", label: "lb" },
      { value: "kg", label: "kg" },
  ]},
  { id: "unitsDistance", type: "select", label: "Distance unit", options: [
      { value: "mi", label: "mi" },
      { value: "km", label: "km" },
  ]},
  { id: "trainingDays", type: "number", label: "How many days/week can you train?", min: 1, max: 7 },
  { id: "sleep", type: "number", label: "Average sleep hours/night", min: 3, max: 12 },
  { id: "diet", type: "text", label: "Any dietary preferences?" },
  { id: "equipment", type: "text", label: "Available equipment?" },
  { id: "motivation", type: "text", label: "Why are you training?" },
  { id: "email", type: "text", label: "Email (optional)" },
  { id: "beta", type: "text", label: "Beta access code", required: true, placeholder: "FORCE3BETA" },
];

const STORAGE_KEY = "force3_local_state_lite_v2";

export default function Questionnaire() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [index, setIndex] = useState(0);

  const current = QUESTIONNAIRE[index];
  const updateAnswer = (id: string, value: any) => setAnswers((a) => ({ ...a, [id]: value }));

  const handleNext = () => {
    if (index < QUESTIONNAIRE.length - 1) setIndex(index + 1);
    else finish();
  };

  const finish = () => {
    const code = answers.beta?.trim() ?? "";
    const name = answers.name ?? "";
    const goal = answers.goal ?? "Aggressive fat loss";
    const noDeadlift = answers.noDeadlift === "no";
    const doubleRuns = answers.doubleRuns === "yes";
    const weightUnit = answers.unitsWeight ?? "lb";
    const distUnit = answers.unitsDistance ?? "mi";
    const sports = answers.sports ?? "";

    const state = {
      betaCode: "FORCE3BETA",
      authed: code === "FORCE3BETA",
      profile: {
        name,
        goal,
        sports,
        noDeadlift,
        doubleRuns,
        units: { weight: weightUnit, distance: distUnit },
      },
      logs: [],
      settings: { accent: "blue", density: "cozy" },
      today: undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md w-full space-y-4 border border-neutral-800 bg-neutral-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">{current.label}</h2>
        {current.type === "text" && (
          <input
            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2"
            placeholder={current.placeholder}
            value={answers[current.id] ?? ""}
            onChange={(e) => updateAnswer(current.id, e.target.value)}
          />
        )}
        {current.type === "number" && (
          <input
            type="number"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2"
            value={answers[current.id] ?? ""}
            onChange={(e) => updateAnswer(current.id, e.target.value)}
          />
        )}
        {current.type === "select" && (
          <select
            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2"
            value={answers[current.id] ?? ""}
            onChange={(e) => updateAnswer(current.id, e.target.value)}
          >
            <option value="">Select...</option>
            {current.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {current.type === "single_choice" && (
          <div className="flex flex-col gap-2">
            {current.options?.map((opt) => (
              <label key={opt.value} className="flex items-center justify-between text-sm">
                <span>{opt.label}</span>
                <input
                  type="radio"
                  name={current.id}
                  checked={answers[current.id] === opt.value}
                  onChange={() => updateAnswer(current.id, opt.value)}
                />
              </label>
            ))}
          </div>
        )}
        <button
          onClick={handleNext}
          className="w-full px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-md mt-4"
        >
          {index < QUESTIONNAIRE.length - 1 ? "Next" : "Finish"}
        </button>
        <p className="text-xs text-neutral-500">
          {index + 1} / {QUESTIONNAIRE.length}
        </p>
      </div>
    </main>
  );
}
