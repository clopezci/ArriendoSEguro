"use client";

import { useState } from "react";
import Link from "next/link";

type Source = { law: string; ref: string; title: string; url: string };

const SUGERIDAS = [
  "¿Cuánto pueden subirme el arriendo cada año?",
  "¿Me pueden pedir depósito o meses de garantía?",
  "¿Cuál es el canon máximo permitido por ley?",
  "¿Puedo subarrendar el apartamento?",
  "¿Cómo termino el contrato antes de tiempo?",
  "¿La firma electrónica del contrato es válida?",
];

export default function ConsultaLegalPage() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [error, setError] = useState("");

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 5) { setError("Escribe una pregunta un poco más larga."); return; }
    setBusy(true); setError(""); setAnswer(""); setSources([]);
    try {
      const res = await fetch("/api/legal/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const j = (await res.json()) as { success?: boolean; answer?: string; sources?: Source[]; disclaimer?: string; error?: string };
      if (!res.ok || !j.success) { setError(j.error ?? "No se pudo consultar en este momento."); return; }
      setAnswer(j.answer ?? "");
      setSources(j.sources ?? []);
      setDisclaimer(j.disclaimer ?? "");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Asistente legal · orientativo</p>
      <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Pregúntale a la IA sobre tu arriendo</h1>
      <p className="mt-2 text-sm text-slate-600">
        Respuestas con <strong>respaldo en la norma</strong> (Ley 820 de 2003, Código Civil, Ley 527 de 1999,
        Ley 1581 de 2012, Decreto 1074 de 2015). La IA cita el artículo y no inventa: si algo no está en la ley que
        conoce, te lo dice.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(question); }}
        className="mt-5 rounded-2xl border-2 border-violet-200 bg-white p-3 shadow-sm"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ej.: ¿Cuánto me pueden subir el arriendo este año?"
          rows={3}
          maxLength={600}
          className="w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">{question.length}/600</span>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? "Consultando…" : "Preguntar"}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGERIDAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setQuestion(s); void ask(s); }}
            disabled={busy}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-violet-500 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {answer && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Respuesta</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{answer}</p>

          {sources.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fuentes</p>
              <ul className="mt-2 space-y-1.5">
                {sources.map((s, i) => (
                  <li key={`${s.law}-${i}`} className="text-sm">
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
                      {s.law}, {s.ref}
                    </a>{" "}
                    <span className="text-slate-500">— {s.title} ↗</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {disclaimer && <p className="mt-4 text-[12px] leading-relaxed text-slate-500">{disclaimer}</p>}
        </section>
      )}

      <p className="mt-8 text-center text-xs text-slate-500">
        ¿Necesitas ayuda con tu contrato?{" "}
        <Link href="/nuevo" className="font-semibold text-violet-700 hover:underline">Créalo en ArriendoSeguro →</Link>
      </p>
    </main>
  );
}
