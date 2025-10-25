"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <main className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-neutral-100 text-center">
      <h1 className="text-4xl font-bold mb-2">FORCE3</h1>
      <p className="text-neutral-400 mb-8">Strength • Endurance • Discipline</p>
      <button
        onClick={() => router.push("/questionnaire")}
        className="px-6 py-3 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-lg text-lg"
      >
        Get started
      </button>
    </main>
  );
}
