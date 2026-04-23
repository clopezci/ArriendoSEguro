"use client";

import { useState } from "react";
import type { LeadFormInput } from "@/lib/validations/lead-form";

const initial: LeadFormInput = {
  q1PropertySituation: "evaluating",
  q2RentalChannel: "never",
  q3MainConcern: "all",
  q4LowCostApp: "maybe",
  q5WillingToPay: "range_20_40",
  q6ValuedModule: "integrated",
  email: "",
  contactConsent: false,
};

export function LeadMarketForm() {
  const [values, setValues] = useState<LeadFormInput>(initial);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          contactConsent: values.contactConsent ?? false,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        stored?: boolean;
        duplicate?: boolean;
      };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      if (data.duplicate) {
        setStatus("done");
        setMessage(
          data.message ??
            "Ese correo ya figura en nuestra lista. No duplicamos registros con el mismo e-mail."
        );
        return;
      }
      setStatus("done");
      setMessage(
        data.message ??
          "Gracias. Tu respuesta quedó registrada; te avisaremos del acceso temprano."
      );
    } catch {
      setStatus("error");
      setMessage("Error de conexión. Revisa tu red e inténtalo de nuevo.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 space-y-6 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50"
    >
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Validación de interés (6 preguntas)
      </h3>

      <Field label="¿Tienes una vivienda para arrendar o la arrendarás pronto?">
        <select
          className="input"
          value={values.q1PropertySituation}
          onChange={(e) =>
            setValues((v) => ({ ...v, q1PropertySituation: e.target.value as LeadFormInput["q1PropertySituation"] }))
          }
        >
          <option value="yes_rented_before">Sí, y ya la he arrendado antes</option>
          <option value="yes_first_time">Sí, pero sería mi primera vez</option>
          <option value="evaluating">Estoy evaluándolo</option>
        </select>
      </Field>

      <Field label="Cuando has arrendado, ¿por cuál medio lo has hecho principalmente?">
        <select
          className="input"
          value={values.q2RentalChannel}
          onChange={(e) =>
            setValues((v) => ({ ...v, q2RentalChannel: e.target.value as LeadFormInput["q2RentalChannel"] }))
          }
        >
          <option value="agency">Inmobiliaria o agencia</option>
          <option value="direct">Directo, persona a persona</option>
          <option value="both">Ambas</option>
          <option value="never">Aún no he arrendado</option>
        </select>
      </Field>

      <Field label="¿Qué te preocupa más al arrendar?">
        <select
          className="input"
          value={values.q3MainConcern}
          onChange={(e) =>
            setValues((v) => ({ ...v, q3MainConcern: e.target.value as LeadFormInput["q3MainConcern"] }))
          }
        >
          <option value="unclear_contract">Falta de contrato claro</option>
          <option value="counterparty_validation">Falta de validación de la otra parte</option>
          <option value="payment_risk">Riesgo de incumplimientos o pagos</option>
          <option value="delivery_state">Problemas con entrega o estado del inmueble</option>
          <option value="all">Todo lo anterior</option>
        </select>
      </Field>

      <Field label="¿Usarías una app de costo bajo (vs. agencia) con modelos predefinidos de contratos, firma, inventario de tu propiedad, acompañamiento y mucho más?">
        <select
          className="input"
          value={values.q4LowCostApp}
          onChange={(e) =>
            setValues((v) => ({ ...v, q4LowCostApp: e.target.value as LeadFormInput["q4LowCostApp"] }))
          }
        >
          <option value="yes">Sí</option>
          <option value="maybe">Tal vez</option>
          <option value="no">No</option>
        </select>
      </Field>

      <Field label="Si costara mucho menos que una inmobiliaria, ¿qué rango te parece razonable?">
        <select
          className="input"
          value={values.q5WillingToPay}
          onChange={(e) =>
            setValues((v) => ({ ...v, q5WillingToPay: e.target.value as LeadFormInput["q5WillingToPay"] }))
          }
        >
          <option value="range_20_40">Entre $20.000 y $40.000</option>
          <option value="range_40_60">Entre $40.000 y $60.000</option>
          <option value="range_60_80">Entre $60.000 y $80.000</option>
        </select>
      </Field>

      <Field label="¿Qué módulo valorarías más?">
        <select
          className="input"
          value={values.q6ValuedModule}
          onChange={(e) =>
            setValues((v) => ({ ...v, q6ValuedModule: e.target.value as LeadFormInput["q6ValuedModule"] }))
          }
        >
          <option value="contract">Contrato automático</option>
          <option value="signature">Firma electrónica</option>
          <option value="inventory">Inventario y actas</option>
          <option value="payments">Registro de pagos</option>
          <option value="evaluation">Evaluación estructurada</option>
          <option value="integrated">Todo integrado</option>
        </select>
      </Field>

      <div>
        <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Correo (opcional)</label>
        <input
          type="email"
          className="input mt-1"
          placeholder="tu@correo.com"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          autoComplete="email"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300"
          checked={values.contactConsent ?? false}
          onChange={(e) => setValues((v) => ({ ...v, contactConsent: e.target.checked }))}
        />
        Acepto ser contactado para acceso temprano y novedades del producto (tratamos tus datos con
        finalidad limitada, según el aviso de privacidad que publicaremos con la app).
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={status === "sending" || status === "done"}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? "Enviando…" : "Enviar respuestas"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValues(initial);
            setStatus("idle");
            setMessage("");
          }}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Limpiar
        </button>
      </div>

      {status === "done" && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
          {message}
        </p>
      )}
      {status === "error" && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          {message}
        </p>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
