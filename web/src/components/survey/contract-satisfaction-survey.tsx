"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Answer = boolean | null;

const QUESTIONS: { key: "easy" | "liked" | "recommend"; label: string }[] = [
  { key: "easy", label: "¿Te pareció fácil?" },
  { key: "liked", label: "¿Te gustó?" },
  { key: "recommend", label: "¿Lo recomendarías?" },
];

/**
 * Encuesta de satisfacción de 3 preguntas (lean startup) que se muestra al
 * terminar un contrato. Cada pregunta se responde con 👍 / 👎. Envía a
 * `/api/survey/contract`. Es aditiva: no interfiere con el flujo del contrato.
 */
export function ContractSatisfactionSurvey({ contractId }: { contractId?: string }) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, Answer>>({ easy: null, liked: null, recommend: null });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const allAnswered = QUESTIONS.every((q) => answers[q.key] !== null);

  function pick(key: string, value: boolean) {
    if (sent || busy) return;
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!allAnswered || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/survey/contract", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({
          contractId,
          easy: Boolean(answers.easy),
          liked: Boolean(answers.liked),
          recommend: Boolean(answers.recommend),
        }),
      });
      if (res.ok) setSent(true);
      else setSent(true); // no molestamos al usuario si falla; es opcional
    } catch {
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
        ¡Gracias por tu opinión! 🙌 Nos ayuda muchísimo a mejorar.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
      <p className="text-sm font-semibold text-slate-900">¿Nos ayudas con 3 preguntas rápidas?</p>
      <div className="mt-3 space-y-2">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-700">{q.label}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => pick(q.key, true)}
                aria-pressed={answers[q.key] === true}
                aria-label={`${q.label} Sí`}
                className={`rounded-full border px-2.5 py-1 text-base transition ${
                  answers[q.key] === true ? "border-emerald-500 bg-emerald-100" : "border-slate-300 bg-white hover:border-emerald-400"
                }`}
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => pick(q.key, false)}
                aria-pressed={answers[q.key] === false}
                aria-label={`${q.label} No`}
                className={`rounded-full border px-2.5 py-1 text-base transition ${
                  answers[q.key] === false ? "border-rose-500 bg-rose-100" : "border-slate-300 bg-white hover:border-rose-400"
                }`}
              >
                👎
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!allAnswered || busy}
        className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? "Enviando…" : "Enviar"}
      </button>
    </div>
  );
}
