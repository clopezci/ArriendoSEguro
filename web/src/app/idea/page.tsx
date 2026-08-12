"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { TopBackNav } from "@/components/nav/top-back-nav";

export default function IdeaPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (idea.trim().length < 10 || name.trim().length < 2) {
      setErr("Escribe tu nombre y una idea un poco más larga (mínimo 10 caracteres).");
      return;
    }
    setBusy(true);
    setErr("");
    setOkMsg("");
    try {
      const res = await fetch("/api/ideas/create", {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? await buildAuthHeaders(user) : {}) },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), idea: idea.trim() }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "No se pudo enviar tu idea. Intenta de nuevo.");
        return;
      }
      setOkMsg(j.message ?? "¡Gracias! Recibimos tu idea.");
      setName("");
      setContact("");
      setIdea("");
    } catch {
      setErr("Error de red. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBackNav />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Construyamos juntos</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Déjanos tu idea o necesidad</h1>
          <p className="mt-2 text-slate-700">
            ¿Tienes una idea o una necesidad que te ayude a administrar tu arriendo y que además le pueda servir a muchos?
            Cuéntanosla. Si nos sirve para la comunidad, <strong>la construimos sin costo</strong>.
          </p>
        </header>

        {okMsg ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900">
            <p className="text-lg font-semibold">¡Gracias! 🙌</p>
            <p className="mt-1 text-sm">{okMsg}</p>
            <Link href="/nuevo" className="mt-4 inline-block rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tu nombre</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                placeholder="¿Cómo te llamas?"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Correo o teléfono (para avisarte si la hacemos)</span>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={160}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                placeholder="Opcional"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tu idea o necesidad</span>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={5}
                maxLength={4000}
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                placeholder="Describe qué necesitas o qué te gustaría que hiciéramos…"
              />
            </label>
            {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {busy ? "Enviando…" : "Enviar mi idea"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
