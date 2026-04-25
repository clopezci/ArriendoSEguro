"use client";

import { useState } from "react";
import type { LeadFormInput } from "@/lib/validations/lead-form";

const initial: LeadFormInput = {
  q1PropertySituation: "evaluating",
  q2RentalChannel: "never",
  q3MainConcern: "all",
  q4LowCostApp: "maybe",
  q4NoReason: undefined,
  q4NoReasonOther: "",
  q5WillingToPay: "under_50",
  q6ValuedModule: "integrated",
  q6Other: "",
  sourcePage: "landing",
  email: "",
  contactConsent: false,
};

export function LeadMarketForm({
  sourcePage = "landing",
}: {
  sourcePage?: LeadFormInput["sourcePage"];
}) {
  const [values, setValues] = useState<LeadFormInput>({ ...initial, sourcePage });
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
          sourcePage,
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
          "Gracias por ayudarnos a validar Arriendo Seguro. Tus respuestas nos permitirán construir una herramienta más útil para arrendar directamente con mayor claridad y tranquilidad de forma fácil."
      );
    } catch {
      setStatus("error");
      setMessage("Error de conexión. Revisa tu red e inténtalo de nuevo.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-6 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Validación de interés
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Estamos validando Arriendo Seguro, una plataforma para formalizar arriendos ya acordados
        entre personas particulares. Tus respuestas nos ayudarán a construir una solución útil,
        clara y de bajo costo.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <Field label="1. ¿Actualmente tienes una propiedad para arrendar o la arrendarás pronto?">
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
              <option value="no_property">No tengo propiedad para arrendar</option>
            </select>
          </Field>

          <Field label="2. Cuando has arrendado o pensado arrendar, ¿por cuál medio lo harías principalmente?">
            <select
              className="input"
              value={values.q2RentalChannel}
              onChange={(e) =>
                setValues((v) => ({ ...v, q2RentalChannel: e.target.value as LeadFormInput["q2RentalChannel"] }))
              }
            >
              <option value="agency">Por inmobiliaria o agencia</option>
              <option value="direct">Directamente entre particulares</option>
              <option value="both">Ambas opciones</option>
              <option value="never">Aún no he arrendado</option>
            </select>
          </Field>

          <Field label="3. ¿Qué es lo que más te preocupa al arrendar una propiedad?">
            <select
              className="input"
              value={values.q3MainConcern}
              onChange={(e) =>
                setValues((v) => ({ ...v, q3MainConcern: e.target.value as LeadFormInput["q3MainConcern"] }))
              }
            >
              <option value="unclear_contract">No tener un contrato claro</option>
              <option value="counterparty_validation">No validar bien a la otra parte</option>
              <option value="payment_risk">Problemas con pagos o incumplimientos</option>
              <option value="delivery_state">Problemas con la entrega o estado del inmueble</option>
              <option value="conflict_resolution">No saber qué hacer si hay un conflicto</option>
              <option value="all">Todo lo anterior</option>
            </select>
          </Field>

          <Field label="4. ¿Usarías una app de bajo costo que te ayude a formalizar un arriendo ya acordado con contrato, firma electrónica, inventario, soportes y más adelante acceso a especialistas si lo deseas?">
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

          {values.q4LowCostApp === "no" && (
            <>
              <Field label="Si respondiste NO, ¿por qué no la usarías?">
                <select
                  className="input"
                  value={values.q4NoReason ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      q4NoReason: (e.target.value || undefined) as LeadFormInput["q4NoReason"],
                      q4NoReasonOther: e.target.value === "other" ? v.q4NoReasonOther : "",
                    }))
                  }
                >
                  <option value="">Selecciona una opción</option>
                  <option value="price">Precio</option>
                  <option value="hard_to_use">Me parece difícil de usar</option>
                  <option value="not_needed">No lo considero necesario</option>
                  <option value="prefer_agency">Prefiero una agencia</option>
                  <option value="other">Otro</option>
                </select>
              </Field>
              {values.q4NoReason === "other" && (
                <div>
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                    Cuéntanos cuál
                  </label>
                  <textarea
                    className="input mt-1 min-h-24"
                    placeholder="Escribe aquí tu motivo"
                    value={values.q4NoReasonOther ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, q4NoReasonOther: e.target.value }))}
                    maxLength={280}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-5">
          <Field label="5. ¿Qué valor te parecería razonable pagar una sola vez por contrato registrado, por este servicio?">
            <select
              className="input"
              value={values.q5WillingToPay}
              onChange={(e) =>
                setValues((v) => ({ ...v, q5WillingToPay: e.target.value as LeadFormInput["q5WillingToPay"] }))
              }
            >
              <option value="under_50">Menos de $50.000</option>
              <option value="range_50_70">Entre $50.000 y $70.000</option>
              <option value="range_70_100">Entre $70.000 y $100.000</option>
              <option value="would_not_pay">No pagaría por este servicio</option>
            </select>
          </Field>

          <Field label="6. ¿Qué debería contener la aplicación para que sea valiosa para ti?">
            <select
              className="input"
              value={values.q6ValuedModule}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  q6ValuedModule: e.target.value as LeadFormInput["q6ValuedModule"],
                  q6Other: e.target.value === "other" ? v.q6Other : "",
                }))
              }
            >
              <option value="guided_contract">Generación automática del contrato guiándote fácilmente</option>
              <option value="signature">Firma electrónica</option>
              <option value="inventory">Inventario y actas</option>
              <option value="payments">Registro de pagos</option>
              <option value="evaluation">Evaluación estructurada de la experiencia</option>
              <option value="integrated">Todo integrado</option>
              <option value="other">Otro</option>
            </select>
          </Field>

          {values.q6ValuedModule === "other" && (
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                ¿Qué debería contener?
              </label>
              <textarea
                className="input mt-1 min-h-24"
                placeholder="Escribe aquí tu idea"
                value={values.q6Other ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, q6Other: e.target.value }))}
                maxLength={280}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              Correo electrónico para recibir acceso temprano (opcional)
            </label>
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
            Acepto ser contactado para acceso temprano y novedades del producto (consentimiento
            básico para contacto informativo).
          </label>
        </div>
      </div>

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
            setValues({ ...initial, sourcePage });
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
