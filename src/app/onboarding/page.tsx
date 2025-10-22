"use client";
import React, { useState, useEffect } from "react";

export default function Force3Onboarding() {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [coachName, setCoachName] = useState<string>("");
  const [plan, setPlan] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // fetch questions on first load
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch("/api/coach");
        const data = await res.json();
        setCoachName(data.coach);
        setQuestions(data.questions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  function handleChange(id: string, value: any) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setPlan(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "answers", answers }),
      });
      const data = await res.json();
      setPlan(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6">Loading questions...</div>;

  if (plan) {
    // ---------- Plan view ----------
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">{plan.title}</h1>
        <p className="opacity-80">{plan.summary}</p>

        {Array.isArray(plan.sections) &&
          plan.sections.map((s: any, i: number) => (
            <div key={i} className="border rounded-xl p-4 space-y-2">
              <h2 className="font-semibold">{s.heading}</h2>
              {s.bullets && (
                <ul className="list-disc ml-5">
                  {s.bullets.map((b: string, j: number) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
              {s.table && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        {s.table.columns.map((c: string, j: number) => (
                          <th key={j} className="text-left pr-4 py-1">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((r: string[], k: number) => (
                        <tr key={k}>
                          {r.map((cell, m) => (
                            <td key={m} className="pr-4 py-1 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

        {plan.next_actions && (
          <div className="flex flex-wrap gap-2">
            {plan.next_actions.map((a: string, i: number) => (
              <span
                key={i}
                className="px-3 py-1 border rounded-full text-sm bg-gray-50"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        <button
          className="border rounded-xl px-4 py-2 mt-4"
          onClick={() => {
            setPlan(null);
            setAnswers({});
          }}
        >
          Start Over
        </button>
      </div>
    );
  }

  // ---------- Question view ----------
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-center">
        Meet {coachName || "Coach"} 👋
      </h1>
      <p className="text-center opacity-70">
        Answer a few questions so I can build your personalized plan.
      </p>

      <form className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="space-y-1">
            <label className="font-medium">{q.label}</label>
            {q.help && <p className="text-sm opacity-70">{q.help}</p>}

            {q.type === "text" && (
              <input
                type="text"
                placeholder={q.placeholder}
                className="border rounded-xl px-3 py-2 w-full"
                value={answers[q.id] || ""}
                onChange={(e) => handleChange(q.id, e.target.value)}
              />
            )}

            {q.type === "number" && (
              <input
                type="number"
                className="border rounded-xl px-3 py-2 w-full"
                value={answers[q.id] || ""}
                onChange={(e) => handleChange(q.id, e.target.value)}
              />
            )}

            {q.type === "select" && (
              <select
                className="border rounded-xl px-3 py-2 w-full"
                value={answers[q.id] || ""}
                onChange={(e) => handleChange(q.id, e.target.value)}
              >
                <option value="">Select...</option>
                {q.options?.map((o: any) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

            {q.type === "multi_choice" && (
              <div className="flex flex-wrap gap-2">
                {q.options?.map((o: any) => {
                  const selected = answers[q.id]?.includes(o.value);
                  return (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => {
                        const current = new Set(answers[q.id] || []);
                        if (selected) current.delete(o.value);
                        else current.add(o.value);
                        handleChange(q.id, Array.from(current));
                      }}
                      className={`px-3 py-1 rounded-full border ${
                        selected ? "bg-gray-200" : ""
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </form>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full mt-4 border rounded-xl py-3 font-semibold"
      >
        {submitting ? "Building your plan..." : "Generate My Plan"}
      </button>
    </div>
  );
}
