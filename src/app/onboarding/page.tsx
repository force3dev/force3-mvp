"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// small fade helper
const FadeIn = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.4 }}
  >
    {children}
  </motion.div>
);

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

export default function ForceOnboarding(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [coachName, setCoachName] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<any | null>(null);

  // --- load questions
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/coach");
        const data = await res.json();
        setCoachName(data.coach);
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const setAnswer = (id: string, value: any) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const toggleMulti = (id: string, value: string) =>
    setAnswers((prev) => {
      const cur: string[] = Array.isArray(prev[id]) ? prev[id] : [];
      const has = cur.includes(value);
      const next = has ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [id]: next };
    });

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
      setPlan(data?.plan ?? data);
      localStorage.setItem("force3_plan", JSON.stringify(data?.plan ?? data));
      window.location.href = "/dashboard";
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
    else handleSubmit();
  };

  // --- loading
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#121212] via-[#1E1E1E] to-[#E63946] text-white">
        <p className="text-lg animate-pulse">Loading your AI coach...</p>
      </div>
    );

  // --- plan view
  if (plan)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#121212] via-[#1E1E1E] to-[#E63946] text-white p-6">
        <FadeIn>
          <div className="w-full max-w-3xl bg-[#1E1E1E]/80 border border-[#E63946]/40 backdrop-blur-lg rounded-3xl p-8 shadow-2xl">
            <h1 className="text-3xl font-heading font-bold text-center mb-4 text-[#E63946]">
              {plan.title || "Your Personalized Plan"}
            </h1>
            {plan.summary && (
              <p className="opacity-80 text-center mb-8">{plan.summary}</p>
            )}

            {Array.isArray(plan.sections) &&
              plan.sections.map((s: any, i: number) => (
                <motion.div
                  key={i}
                  className="border border-[#E63946]/40 rounded-2xl p-4 mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="font-heading text-xl mb-2 text-[#E63946] font-semibold">
                    {s.heading}
                  </h2>
                  {Array.isArray(s.bullets) && (
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {s.bullets.map((b: string, j: number) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}

            <div className="text-center mt-8">
              <Button
                onClick={() => {
                  setPlan(null);
                  setCurrentIndex(0);
                }}
                className="bg-[#E63946] text-black hover:brightness-110 transition rounded-full px-6 py-2 font-semibold"
              >
                Back to Questions
              </Button>
            </div>
          </div>
        </FadeIn>
      </div>
    );

  // --- questionnaire view
  const q = questions[currentIndex];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#121212] via-[#1E1E1E] to-[#E63946]">
      <div className="w-full max-w-2xl bg-[#1E1E1E]/90 border border-[#E63946]/40 backdrop-blur-lg rounded-3xl p-8 text-white shadow-2xl">
        <h1 className="text-3xl font-heading font-bold text-center mb-2 tracking-tight text-[#E63946]">
          FORCE3
        </h1>
        <p className="text-center text-gray-400 mb-6">
          Strength • Endurance • Discipline
        </p>

        <Card className="bg-[#1E1E1E] border border-[#E63946]/40 rounded-2xl shadow-xl">
          <CardContent className="p-6">
            <h2 className="text-xl font-heading mb-4 text-[#E63946] text-center">
              Meet {coachName || "Your AI Coach"} 👋
            </h2>

            <AnimatePresence mode="wait">
              <FadeIn key={q?.id}>
                <div className="mb-3">
                  <Label className="text-white text-lg font-semibold">
                    {q?.label}
                  </Label>
                  {q?.help && (
                    <p className="text-sm text-gray-400 mt-1">{q.help}</p>
                  )}
                </div>

                {q?.type === "text" ||
                q?.type === "date" ||
                q?.type === "number" ? (
                  <Input
                    type={
                      q.type === "number"
                        ? "number"
                        : q.type === "date"
                        ? "date"
                        : "text"
                    }
                    placeholder={q?.placeholder || "Type your answer..."}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="bg-[#1E1E1E] border-[#E63946]/40 text-white placeholder-gray-400"
                  />
                ) : q?.type === "select" ? (
                  <>
                    <Select
                      value={answers[q.id] ?? ""}
                      onValueChange={(val) => setAnswer(q.id, val)}
                    >
                      <SelectTrigger className="bg-[#1E1E1E] border-[#E63946]/40 text-white">
                        <SelectValue
                          placeholder="Select..."
                          className="text-white placeholder-gray-400"
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1E1E1E] text-white">
                        {q.options?.map((o) => (
                          <SelectItem
                            key={o.value}
                            value={o.value}
                            className="text-white hover:bg-[#E63946]/40"
                          >
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : q?.type === "multi_choice" ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options?.map((o) => {
                      const selected = Array.isArray(answers[q.id])
                        ? answers[q.id].includes(o.value)
                        : false;
                      return (
                        <motion.button
                          layout
                          type="button"
                          key={o.value}
                          onClick={() => toggleMulti(q.id, o.value)}
                          whileTap={{ scale: 0.95 }}
                          className={`px-3 py-1 rounded-full border text-sm font-medium transition ${
                            selected
                              ? "bg-[#E63946] text-black border-[#E63946]"
                              : "bg-transparent text-white border-[#E63946]/40 hover:bg-[#E63946]/20"
                          }`}
                        >
                          {o.label}
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    placeholder={q?.placeholder || "Type your answer..."}
                    value={answers[q?.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="bg-[#1E1E1E] border-[#E63946]/40 text-white placeholder-gray-400"
                  />
                )}

                {currentIndex === questions.length - 1 && (
                  <div className="mt-4">
                    <Label className="text-white">
                      Tell me more you’d like me to know
                    </Label>
                    <Input
                      placeholder="Anything else about your goals, schedule, or injuries..."
                      value={answers["other_notes"] ?? ""}
                      onChange={(e) => setAnswer("other_notes", e.target.value)}
                      className="mt-1 bg-[#1E1E1E] border-[#E63946]/40 text-white placeholder-gray-400"
                    />
                  </div>
                )}
              </FadeIn>
            </AnimatePresence>

            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="pt-5 text-center"
            >
              <Button
                onClick={handleNext}
                disabled={submitting}
                className="bg-[#E63946] text-black hover:brightness-110 transition rounded-full px-6 py-2 font-semibold"
              >
                {currentIndex < questions.length - 1
                  ? "Next Question"
                  : submitting
                  ? "Building your plan..."
                  : "Generate My Plan"}
              </Button>
              <p className="text-sm text-gray-400 mt-2">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
