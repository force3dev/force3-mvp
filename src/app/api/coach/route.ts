// app/api/coach/route.ts
export const runtime = "nodejs";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -------------------- Types -------------------- */
type QuestionOption = { value: string; label: string };
type Question =
  | {
      id: string;
      type:
        | "single_choice"
        | "multi_choice"
        | "number"
        | "text"
        | "select"
        | "date";
      label: string;
      required?: boolean;
      placeholder?: string;
      options?: QuestionOption[];
      help?: string;
      min?: number;
      max?: number;
    };

type Answers = Record<string, any>;

type PostBody =
  | {
      stage?: "answers" | "chat";
      answers?: Answers;
      message?: string;
      brief?: boolean;
    };

/* -------------------- Height options (cm / ft'in") -------------------- */
const HEIGHT_OPTIONS: QuestionOption[] = [
  { value: `150 cm / 4'11"`, label: `150 cm / 4'11"` },
  { value: `155 cm / 5'1"`, label: `155 cm / 5'1"` },
  { value: `160 cm / 5'3"`, label: `160 cm / 5'3"` },
  { value: `165 cm / 5'5"`, label: `165 cm / 5'5"` },
  { value: `170 cm / 5'7"`, label: `170 cm / 5'7"` },
  { value: `175 cm / 5'9"`, label: `175 cm / 5'9"` },
  { value: `180 cm / 5'11"`, label: `180 cm / 5'11"` },
  { value: `185 cm / 6'1"`, label: `185 cm / 6'1"` },
  { value: `190 cm / 6'3"`, label: `190 cm / 6'3"` },
  { value: `195 cm / 6'5"`, label: `195 cm / 6'5"` },
  { value: `200 cm / 6'7"`, label: `200 cm / 6'7"` },
];

/* -------------------- Questionnaire (GET) -------------------- */
const QUESTIONNAIRE: Question[] = [
  { id: "name", type: "text", label: "Your name (optional)", placeholder: "Ricardo" },

  {
    id: "sex",
    type: "select",
    label: "Sex",
    required: true,
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other / prefer not to say" },
    ],
  },

  { id: "age", type: "number", label: "Age", required: true, min: 12, max: 100 },

  {
    id: "units",
    type: "select",
    label: "Units",
    required: true,
    options: [
      { value: "metric", label: "Metric (cm, kg, km)" },
      { value: "imperial", label: "Imperial (in, lb, mi)" },
    ],
  },

  // ✅ Q5 → Height as dropdown (cm + inches)
  {
    id: "height",
    type: "select",
    label: "What is your height?",
    required: true,
    options: HEIGHT_OPTIONS,
  },

  {
    id: "weight",
    type: "number",
    label: "Weight",
    required: true,
    help: "Enter kilograms if metric, or pounds if imperial.",
  },

  {
    id: "primary_goals",
    type: "multi_choice",
    label: "Primary goals",
    required: true,
    options: [
      { value: "fat_loss", label: "Fat loss" },
      { value: "general_fitness", label: "General fitness" },
      { value: "muscle_gain", label: "Build muscle" },
      { value: "hybrid", label: "Hybrid (mix cardio + strength)" },
      { value: "endurance", label: "Endurance focus" },
      { value: "performance_sport", label: "Sport performance" },
      { value: "mobility", label: "Mobility / injury prevention" },
    ],
  },

  {
    id: "modalities",
    type: "multi_choice",
    label: "What types of training do you want?",
    required: true,
    options: [
      { value: "strength", label: "Strength / Lifting" },
      { value: "run", label: "Running" },
      { value: "bike", label: "Cycling" },
      { value: "swim", label: "Swimming" },
      { value: "hiit", label: "HIIT / conditioning" },
      { value: "mobility", label: "Mobility / flexibility" },
      { value: "walk", label: "Walking / low impact" },
    ],
  },

  {
    id: "experience",
    type: "select",
    label: "Training experience",
    required: true,
    options: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
    ],
  },

  {
    id: "availability",
    type: "number",
    label: "How many days/week can you train?",
    required: true,
    min: 1,
    max: 7,
  },

  // ✅ Q14 → Exercise Frequency (capitalized)
  {
    id: "exercise_frequency",
    type: "select",
    label: "Exercise Frequency",
    options: [
      { value: "1-2", label: "1–2 times per week" },
      { value: "3-4", label: "3–4 times per week" },
      { value: "5-6", label: "5–6 times per week" },
      { value: "every_day", label: "Every day" },
    ],
  },

  // ✅ Q15 → Current Goal (capitalized + "Other")
  {
    id: "current_goal",
    type: "select",
    label: "Current Goal",
    options: [
      { value: "build_muscle", label: "Build Muscle" },
      { value: "lose_fat", label: "Lose Fat" },
      { value: "improve_endurance", label: "Improve Endurance" },
      { value: "maintain_fitness", label: "Maintain Fitness" },
      { value: "other", label: "Other" },
    ],
  },

  {
    id: "split_pref",
    type: "select",
    label: "Preferred strength split (optional)",
    options: [
      { value: "full_body", label: "Full body" },
      { value: "upper_lower", label: "Upper / Lower" },
      { value: "push_pull_legs", label: "Push / Pull / Legs" },
      { value: "no_pref", label: "No preference" },
    ],
  },

  {
    id: "cardio_intensity",
    type: "select",
    label: "Preferred cardio intensity (optional)",
    options: [
      { value: "low", label: "Low (easy / steady)" },
      { value: "mixed", label: "Mixed (steady + intervals)" },
      { value: "high", label: "High (tempo / VO2)" },
      { value: "no_pref", label: "No preference" },
    ],
  },

  {
    id: "preferred_rest_days",
    type: "multi_choice",
    label: "Preferred rest days (optional)",
    options: [
      { value: "Mon", label: "Mon" }, { value: "Tue", label: "Tue" },
      { value: "Wed", label: "Wed" }, { value: "Thu", label: "Thu" },
      { value: "Fri", label: "Fri" }, { value: "Sat", label: "Sat" },
      { value: "Sun", label: "Sun" },
    ],
  },

  {
    id: "equipment",
    type: "multi_choice",
    label: "Available equipment",
    options: [
      { value: "gym", label: "Gym access" },
      { value: "dumbbells", label: "Dumbbells" },
      { value: "barbell", label: "Barbell" },
      { value: "machines", label: "Machines" },
      { value: "bands", label: "Resistance bands" },
      { value: "treadmill", label: "Treadmill" },
      { value: "bike_trainer", label: "Indoor bike" },
      { value: "pool", label: "Pool" },
      { value: "none", label: "Bodyweight only" },
    ],
  },

  {
    id: "constraints",
    type: "multi_choice",
    label: "Injuries / constraints",
    options: [
      { value: "no_deadlifts", label: "No deadlifts" },
      { value: "knee_pain", label: "Knee pain" },
      { value: "back_pain", label: "Back pain" },
      { value: "shoulder_pain", label: "Shoulder pain" },
      { value: "low_impact_only", label: "Low impact only" },
      { value: "none", label: "None" },
    ],
  },

  {
    id: "recent_strength",
    type: "text",
    label: "Recent strength PRs (optional)",
    placeholder: "e.g., Bench 225x5, Squat 275x3",
  },
  {
    id: "recent_cardio",
    type: "text",
    label: "Recent cardio baseline (optional)",
    placeholder: "e.g., 3 mi easy ~10:00/mi; FTP 220W",
  },

  // ✅ Q18 → Diet Type (expanded)
  {
    id: "diet_type",
    type: "select",
    label: "Diet Type",
    options: [
      { value: "regular", label: "Regular" },
      { value: "vegetarian", label: "Vegetarian" },
      { value: "vegan", label: "Vegan" },
      { value: "pescatarian", label: "Pescatarian" },
      { value: "keto", label: "Keto" },
      { value: "paleo", label: "Paleo" },
      { value: "mediterranean", label: "Mediterranean" },
      { value: "intermittent_fasting", label: "Intermittent Fasting" },
      { value: "other", label: "Other" },
    ],
  },

  {
    id: "nutrition_pref",
    type: "multi_choice",
    label: "Nutrition preferences (optional)",
    options: [
      { value: "high_protein", label: "High-protein" },
      { value: "mediterranean", label: "Mediterranean-ish" },
      { value: "vegetarian", label: "Vegetarian" },
      { value: "no_strict_rules", label: "No strict rules" },
    ],
  },

  {
    id: "other_notes",
    type: "text",
    label: "Tell me more you’d like me to know",
    placeholder:
      "Travel schedule, disliked movements, time of day you train, injuries, foods you avoid, etc.",
    help: "Anything important or personal preferences that should shape your plan.",
  },
];

/* -------------------- Persona / Prompt -------------------- */
const COACH_NAME = process.env.COACH_NAME?.trim() || "Coach";

const SYS_PROMPT = `
You are ${COACH_NAME}, a generalized hybrid fitness coach for FORCE3.
Audience: anyone from lifting-only to multi-sport (run, bike, swim, HIIT, mobility).
Tone: supportive, concise, actionable; avoid fluff.
Always read and incorporate profile.other_notes into the plan (preferences, travel, schedule quirks).

Return VALID JSON with keys:
- "title": string
- "summary": string
- "sections": array of objects with:
  - "heading": string
  - optional "bullets": string[]
  - optional "table": { "columns": string[], "rows": string[][] }
- "next_actions": string[] (1–5 items)

PLANNING RULES:
- Build plans ONLY for the modalities the user selected (strength, run, bike, swim, hiit, mobility, walk).
- Match weekly volume and difficulty to experience + days/week and exercise_frequency/current_goal.
- Strength: follow preferred split (or choose sensible one). Replace excluded movements (e.g., if "no_deadlifts").
- Cardio: include intensity guidance (RPE/HR or pace/watts if provided).
- Mobility: add short sessions 2–5x/week.
- Nutrition: include high-level guidance only if relevant, respect diet_type.
- Respect preferred rest days.
- Use user's units; state assumptions when unclear.
- Always include actionable next steps.
`;

/* -------------------- Helpers -------------------- */
function parseHeightMixed(value: any): { height_cm: number | null; height_text: string | null } {
  if (value == null) return { height_cm: null, height_text: null };

  // If number provided (older clients), assume cm
  if (typeof value === "number") return { height_cm: value, height_text: `${value} cm` };

  const str = String(value);

  // Try to parse "### cm"
  const cmMatch = str.match(/(\d{2,3})\s*cm/i);
  if (cmMatch) {
    const cm = Number(cmMatch[1]);
    return { height_cm: isNaN(cm) ? null : cm, height_text: str };
  }

  // Try to parse feet'inches" e.g., 5'11"
  const ftInMatch = str.match(/(\d)'\s*(\d{1,2})"?/);
  if (ftInMatch) {
    const ft = Number(ftInMatch[1]);
    const inch = Number(ftInMatch[2]);
    if (!isNaN(ft) && !isNaN(inch)) {
      const totalIn = ft * 12 + inch;
      const cm = Math.round(totalIn * 2.54);
      return { height_cm: cm, height_text: str };
    }
  }

  // Fallback, no parse
  return { height_cm: null, height_text: str };
}

function mapAnswersToProfile(answers: Answers) {
  const { height_cm, height_text } = parseHeightMixed(answers.height);

  return {
    name: answers.name || "Athlete",
    sex: answers.sex || "other",
    age: Number(answers.age) || null,
    units: answers.units || "metric",

    // Height parsed from dropdown
    height_cm,
    height_text,

    weight: Number(answers.weight) || null,
    goals: answers.primary_goals || [],
    modalities: answers.modalities || [],
    experience: answers.experience || "beginner",
    weekly_availability: Number(answers.availability) || 3,

    // New fields
    exercise_frequency: answers.exercise_frequency || null,
    current_goal: answers.current_goal || null,
    diet_type: answers.diet_type || null,

    split_pref: answers.split_pref || "no_pref",
    cardio_intensity: answers.cardio_intensity || "no_pref",
    preferred_rest_days: answers.preferred_rest_days || [],
    equipment: answers.equipment || [],
    constraints: answers.constraints || [],
    recent_strength: answers.recent_strength || null,
    recent_cardio: answers.recent_cardio || null,
    nutrition_pref: answers.nutrition_pref || [],
    other_notes: answers.other_notes || "",
  };
}

/* -------------------- GET: return questionnaire -------------------- */
export async function GET() {
  try {
    return new Response(JSON.stringify({ coach: COACH_NAME, questions: QUESTIONNAIRE }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "GET failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/* -------------------- POST: create plan or chat -------------------- */
export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY. Add it to .env.local and restart." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as PostBody;
    const stage = body?.stage || "answers";

    if (stage === "answers") {
      const profile = mapAnswersToProfile(body?.answers || {});
      const messages = [
        { role: "system" as const, content: SYS_PROMPT },
        {
          role: "user" as const,
          content: JSON.stringify({
            task:
              "Create a personalized plan ONLY for the selected modalities. Be sure to incorporate 'other_notes' preferences.",
            brief: !!body?.brief,
            profile,
          }),
        },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.4,
        max_tokens: 1200,
      });

      const content =
        completion.choices?.[0]?.message?.content ??
        '{"title":"Plan","summary":"No content","sections":[],"next_actions":[]}';

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {
          title: `${COACH_NAME} Plan`,
          summary: "Structured JSON was expected.",
          sections: [{ heading: "Content", bullets: [content] }],
          next_actions: ["Review and request adjustments."],
        };
      }

      // Return the plan object directly (frontend already handles both direct and {plan})
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (stage === "chat") {
      const message = body?.message || "Hello, coach.";
      const messages = [
        { role: "system" as const, content: SYS_PROMPT },
        { role: "user" as const, content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 700,
      });

      const content =
        completion.choices?.[0]?.message?.content ??
        '{"title":"Coach","summary":"No content","sections":[],"next_actions":[]}';

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {
          title: `${COACH_NAME} Reply`,
          summary: "Structured JSON was expected.",
          sections: [{ heading: "Message", bullets: [content] }],
          next_actions: ["Ask a follow-up.", "Provide more details."],
        };
      }

      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown stage." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const msg = err?.message || "Unknown server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
