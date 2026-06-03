"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { REPORT_CATEGORIES } from "@/lib/reports/report-categories";

type Status = "idle" | "sending" | "done" | "error";

export function ReportForm() {
  const { user } = useAuth();
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number] | "">("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    if (!category || message.trim().length < 10) {
      setStatus("error");
      setFeedback("Elige una categoría y describe el problema (mínimo 10 caracteres).");
      return;
    }
    setStatus("sending");
    setFeedback("");
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (user) Object.assign(headers, await buildAuthHeaders(user));
      const res = await fetch("/api/reports/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: user ? undefined : email.trim() || undefined,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setFeedback(
          data.error && data.error !== "Validación"
            ? data.error
            : "No se pudo enviar el reporte. Revisa los datos e inténtalo de nuevo.",
        );
        return;
      }
      setStatus("done");
      setFeedback(data.message ?? "¡Gracias! Recibimos tu reporte.");
      setCategory("");
      setMessage("");
      setEmail("");
    } catch {
      setStatus("error");
      setFeedback("Error de conexión. Inténtalo de nuevo.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-6"
    >
      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="report-category">
          Tipo de reporte
        </label>
        <select
          id="report-category"
          className="input mt-1"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {REPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="report-message">
          Describe lo que pasó
        </label>
        <textarea
          id="report-message"
          className="input mt-1 min-h-32"
          placeholder="¿Qué intentabas hacer? ¿Qué esperabas y qué pasó? Si puedes, indica en qué pantalla."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
        />
      </div>

      {!user && (
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="report-email">
            Tu correo (opcional, para responderte)
          </label>
          <input
            id="report-email"
            type="email"
            className="input mt-1"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={160}
          />
        </div>
      )}
      {user && (
        <p className="text-xs text-slate-500">
          Enviaremos tu reporte asociado a tu cuenta para poder darte seguimiento.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-11 w-full rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Enviando…" : "Enviar reporte"}
      </button>

      {status === "done" && (
        <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {feedback}
        </p>
      )}
      {status === "error" && (
        <p role="alert" aria-live="assertive" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
          {feedback}
        </p>
      )}
    </form>
  );
}
