import { NextResponse } from "next/server";
import OpenAI from "openai";

// Force Node runtime (not Edge) so env + SDK work reliably
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY (check .env.local and restart dev server)" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { profile, questions } = body || {};
    if (!profile) {
      return NextResponse.json({ error: "Missing profile in request body" }, { status: 400 });
    }

    const coachName = process.env.COACH_NAME || "Coach Ricky";
    const model = process.env.COACH_MODEL || "gpt-4o-mini";

    const client = new OpenAI({ apiKey });

    const prompt = `
You are ${coachName}, a marathon coach. The runner provided:

PROFILE:
${JSON.stringify(profile, null, 2)}

QUESTIONS:
${JSON.stringify(questions, null, 2)}

Task: Produce a safe, progressive 16-week marathon plan for a sub-3 goal (adapt to inputs).
- Respect "doublesEnabled" (AM longer than PM if true)
- Respect "noDeadlift" (exclude deadlifts from strength)
- Include bike from week 2 if possible
- Use ${profile?.units?.distance || "mi"} for distances
- Show week-by-week bullets. Keep it concise and practical.
`;

    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a pragmatic, safety-first running coach." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const content = resp.choices?.[0]?.message?.content || "No plan generated.";
    return NextResponse.json({ plan: content });
  } catch (err: any) {
    // Surface a readable error to the client
    const msg = typeof err?.message === "string" ? err.message : String(err);
    return NextResponse.json({ error: `Coach error: ${msg}` }, { status: 500 });
  }
}

// Optional GET to sanity check the route + env
export async function GET() {
  return NextResponse.json({ ok: true, env: !!process.env.OPENAI_API_KEY });
}
