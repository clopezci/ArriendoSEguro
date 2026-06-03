"use client";

import { useState } from "react";
import { CONTACT_TOPICS } from "@/lib/contact/topics";

type Status = "idle" | "sending" | "done" | "error";

const initial = {
  name: "",
  email: "",
  phone: "",
  topic: "" as (typeof CONTACT_TOPICS)[number] | "",
  message: "",
  consent: false,
};

export function ContactForm() {
  const [values, setValues] = useState({ ...initial });
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

    if (!values.name.trim() || !values.email.trim() || !values.topic || values.message.trim().length < 10) {
      setStatus("error");
      setMessage("Completa tu nombre, correo, tema y un mensaje de al menos 10 caracteres.");
      return;
    }
    if (!values.consent) {
      setStatus("error");
      setMessage("Debes autorizar el tratamiento de tus datos para enviarnos el mensaje.");
      return;
    }

    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          topic: values.topic,
          message: values.message.trim(),
          consent: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        emailNotice?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(
          data.error && data.error !== "Validación"
            ? data.error
            : "No se pudo enviar el mensaje. Revisa los datos e inténtalo de nuevo.",
        );
        return;
      }
      setStatus("done");
      setMessage(
        [data.message, data.emailNotice].filter(Boolean).join("\n\n") ||
          "¡Gracias! Recibimos tu mensaje.",
      );
      setValues({ ...initial });
    } catch {
      setStatus("error");
      setMessage("Error de conexión. Revisa tu red e inténtalo de nuevo.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="contact-name">
            Nombre
          </label>
          <input
            id="contact-name"
            className="input mt-1"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            autoComplete="name"
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="contact-email">
            Correo electrónico
          </label>
          <input
            id="contact-email"
            type="email"
            className="input mt-1"
            placeholder="tu@correo.com"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            autoComplete="email"
            maxLength={160}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="contact-phone">
            Teléfono (opcional)
          </label>
          <input
            id="contact-phone"
            className="input mt-1"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-800" htmlFor="contact-topic">
            Tema
          </label>
          <select
            id="contact-topic"
            className="input mt-1"
            value={values.topic}
            onChange={(e) =>
              setValues((v) => ({ ...v, topic: e.target.value as typeof v.topic }))
            }
          >
            <option value="" disabled>
              Selecciona un tema
            </option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="contact-message">
          Mensaje
        </label>
        <textarea
          id="contact-message"
          className="input mt-1 min-h-32"
          placeholder="Cuéntanos en qué te ayudamos"
          value={values.message}
          onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
          maxLength={5000}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300"
          checked={values.consent}
          onChange={(e) => setValues((v) => ({ ...v, consent: e.target.checked }))}
        />
        Autorizo el tratamiento de mis datos para responder esta solicitud, conforme al{" "}
        <a href="/legal/aviso-privacidad" className="text-violet-700 underline">
          aviso de privacidad
        </a>
        .
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-11 w-full rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Enviando…" : "Enviar mensaje"}
      </button>

      {status === "done" && (
        <p
          role="status"
          aria-live="polite"
          className="whitespace-pre-line rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </p>
      )}
      {status === "error" && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"
        >
          {message}
        </p>
      )}
    </form>
  );
}
