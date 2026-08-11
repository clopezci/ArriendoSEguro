"use client";

import { useCallback, useRef, useState } from "react";
import type { LeadFormInput } from "@/lib/validations/lead-form";

/**
 * Estado interno del formulario: los selects empiezan en cadena vacía para
 * forzar a la persona a elegir conscientemente cada respuesta. Se valida
 * antes de enviar y se vuelve a este estado tras un envío exitoso.
 */
type LeadFormState = {
  q1PropertySituation: LeadFormInput["q1PropertySituation"] | "";
  q2RentalChannel: LeadFormInput["q2RentalChannel"] | "";
  q3MainConcern: LeadFormInput["q3MainConcern"] | "";
  q4LowCostApp: LeadFormInput["q4LowCostApp"] | "";
  q4NoReason: NonNullable<LeadFormInput["q4NoReason"]> | "";
  q4NoReasonOther: string;
  q5WillingToPay: LeadFormInput["q5WillingToPay"] | "";
  q6ValuedModule: LeadFormInput["q6ValuedModule"] | "";
  q6Other: string;
  sourcePage: LeadFormInput["sourcePage"];
  email: string;
  contactConsent: boolean;
};

type FieldKey =
  | "q1PropertySituation"
  | "q2RentalChannel"
  | "q3MainConcern"
  | "q4LowCostApp"
  | "q4NoReason"
  | "q4NoReasonOther"
  | "q5WillingToPay"
  | "q6ValuedModule"
  | "q6Other";

/**
 * Orden lógico de las preguntas en pantalla. Lo usamos para que, al validar,
 * el "primer campo en rojo" que enfocamos sea el primero que la persona ve
 * desplazándose desde arriba (ideal en móvil y dentro de la PWA).
 */
const FIELD_ORDER: FieldKey[] = [
  "q1PropertySituation",
  "q2RentalChannel",
  "q3MainConcern",
  "q4LowCostApp",
  "q4NoReason",
  "q4NoReasonOther",
  "q5WillingToPay",
  "q6ValuedModule",
  "q6Other",
];

const initial: LeadFormState = {
  q1PropertySituation: "",
  q2RentalChannel: "",
  q3MainConcern: "",
  q4LowCostApp: "",
  q4NoReason: "",
  q4NoReasonOther: "",
  q5WillingToPay: "",
  q6ValuedModule: "",
  q6Other: "",
  sourcePage: "landing",
  email: "",
  contactConsent: false,
};

/**
 * Clases que se agregan al campo cuando está en estado inválido.
 * Mantenemos el estilo base del proyecto (clase utilitaria `input`) y solo
 * superponemos un borde y anillo rojos para que sea fácil de ubicar.
 */
const INVALID_INPUT_CLASS = "border-rose-500 ring-1 ring-rose-500 focus:border-rose-500 focus:ring-rose-500";

export function LeadMarketForm({
  sourcePage = "landing",
}: {
  sourcePage?: LeadFormInput["sourcePage"];
}) {
  const [values, setValues] = useState<LeadFormState>({ ...initial, sourcePage });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<Set<FieldKey>>(new Set());

  /**
   * Mapa de referencias a cada campo controlable. Lo usamos para hacer
   * scroll suave + foco al primer error al enviar; pensado mobile-first
   * (el formulario es largo en pantallas pequeñas / PWA instalada).
   */
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const setFieldRef = useCallback(
    (key: FieldKey) => (el: HTMLElement | null) => {
      fieldRefs.current[key] = el;
    },
    [],
  );

  function focusFirstInvalid(invalid: Set<FieldKey>) {
    const firstKey = FIELD_ORDER.find((k) => invalid.has(k));
    if (!firstKey) return;
    const el = fieldRefs.current[firstKey];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof (el as HTMLElement & { focus?: () => void }).focus === "function") {
      try {
        (el as HTMLElement).focus({ preventScroll: true });
      } catch {
        (el as HTMLElement).focus();
      }
    }
  }

  function resetForm() {
    setValues({ ...initial, sourcePage });
    setInvalidFields(new Set());
  }

  function clearFieldError(key: FieldKey) {
    setInvalidFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function inputClass(key: FieldKey, base = "input"): string {
    return invalidFields.has(key) ? `${base} ${INVALID_INPUT_CLASS}` : base;
  }

  /**
   * Recorre todas las preguntas obligatorias y devuelve los campos vacíos.
   * Devuelve también un mensaje resumen para el banner superior.
   */
  function collectInvalidFields(): { fields: Set<FieldKey>; summary: string } {
    const fields = new Set<FieldKey>();

    if (!values.q1PropertySituation) fields.add("q1PropertySituation");
    if (!values.q2RentalChannel) fields.add("q2RentalChannel");
    if (!values.q3MainConcern) fields.add("q3MainConcern");
    if (!values.q4LowCostApp) fields.add("q4LowCostApp");

    if (values.q4LowCostApp === "no") {
      if (!values.q4NoReason) fields.add("q4NoReason");
      if (values.q4NoReason === "other" && (values.q4NoReasonOther ?? "").trim().length < 2) {
        fields.add("q4NoReasonOther");
      }
    }

    if (!values.q5WillingToPay) fields.add("q5WillingToPay");
    if (!values.q6ValuedModule) fields.add("q6ValuedModule");
    if (values.q6ValuedModule === "other" && (values.q6Other ?? "").trim().length < 2) {
      fields.add("q6Other");
    }

    const count = fields.size;
    const summary =
      count === 0
        ? ""
        : count === 1
          ? "Falta responder 1 pregunta. Revisa la respuesta marcada en rojo."
          : `Faltan ${count} respuestas. Revisa las preguntas marcadas en rojo.`;
    return { fields, summary };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

    const { fields: invalid, summary } = collectInvalidFields();
    if (invalid.size > 0) {
      setInvalidFields(invalid);
      setStatus("error");
      setMessage(summary);
      // En móviles / PWA el formulario es largo: llevamos a la persona
      // directamente al primer campo en rojo y le damos foco.
      requestAnimationFrame(() => focusFirstInvalid(invalid));
      return;
    }

    setInvalidFields(new Set());
    setStatus("sending");
    setMessage("");
    try {
      // Sanitizar el body: el schema del servidor (Zod) trata estas claves como
      // enum opcional o string opcional. Si enviamos "" cuando no aplica, falla
      // la validación y la API responde { error: "Validación" }. Aquí mandamos
      // `undefined` (lo cual JSON.stringify omite) para mantener el contrato limpio.
      const body = {
        q1PropertySituation: values.q1PropertySituation,
        q2RentalChannel: values.q2RentalChannel,
        q3MainConcern: values.q3MainConcern,
        q4LowCostApp: values.q4LowCostApp,
        q4NoReason:
          values.q4LowCostApp === "no" && values.q4NoReason
            ? values.q4NoReason
            : undefined,
        q4NoReasonOther:
          values.q4LowCostApp === "no" &&
          values.q4NoReason === "other" &&
          values.q4NoReasonOther.trim() !== ""
            ? values.q4NoReasonOther.trim()
            : undefined,
        q5WillingToPay: values.q5WillingToPay,
        q6ValuedModule: values.q6ValuedModule,
        q6Other:
          values.q6ValuedModule === "other" && values.q6Other.trim() !== ""
            ? values.q6Other.trim()
            : undefined,
        sourcePage,
        email: values.email,
        contactConsent: values.contactConsent ?? false,
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // Algunas respuestas de error (p. ej. 500 sin handler) llegan como HTML.
      // Parseamos defensivamente para no caer al catch con "Error de conexión".
      const rawText = await res.text();
      let data: {
        ok?: boolean;
        message?: string;
        error?: string;
        stored?: boolean;
        duplicate?: boolean;
        emailNotice?: string;
        issues?: { fieldErrors?: Record<string, string[]> };
      } = {};
      try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setStatus("error");
        if (data.error === "Validación") {
          // Mostrar un mensaje útil en lugar de la palabra suelta "Validación"
          // (suele indicar que faltó algún dato obligatorio en el formulario).
          const fieldErrors = data.issues?.fieldErrors ?? {};
          const detalles = Object.entries(fieldErrors)
            .map(([campo, msgs]) => `${campo}: ${(msgs ?? []).join(", ")}`)
            .filter((s) => s.trim().length > 0)
            .join(" | ");
          setMessage(
            detalles
              ? `Hay un dato inválido en el formulario. ${detalles}`
              : "Hay un dato inválido en el formulario. Vuelve a revisar tus respuestas e inténtalo de nuevo.",
          );
        } else if (data.error) {
          setMessage(data.error);
        } else if (res.status >= 500) {
          // Caso típico cuando el backend cayó (p. ej. Firestore inalcanzable
          // por SSL/red local) y devolvió HTML en vez de JSON.
          setMessage(
            "Hubo un problema temporal en nuestro servicio. Por favor inténtalo de nuevo en unos minutos.",
          );
        } else {
          setMessage("No se pudo enviar. Intenta de nuevo.");
        }
        return;
      }
      if (data.duplicate) {
        setStatus("done");
        setMessage(
          data.message ??
            "Ese correo ya figura en nuestra lista. No duplicamos registros con el mismo e-mail."
        );
        resetForm();
        return;
      }
      setStatus("done");
      const baseDone =
        data.message ??
        "¡Encuesta enviada con éxito! Gracias por ayudarnos a validar ArriendoSeguro. Tus respuestas nos permitirán construir una herramienta más útil para arrendar directamente con mayor claridad y tranquilidad.";
      setMessage(
        typeof data.emailNotice === "string" && data.emailNotice.trim() !== ""
          ? `${baseDone}\n\n${data.emailNotice.trim()}`
          : baseDone,
      );
      resetForm();
    } catch {
      setStatus("error");
      setMessage("Error de conexión. Revisa tu red e inténtalo de nuevo.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-4 space-y-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-300 dark:bg-white/90 sm:p-6"
    >
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-900">
        Validación de interés
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-700">
        Estamos validando ArriendoSeguro, una plataforma para formalizar arriendos ya acordados
        entre personas particulares. Tus respuestas nos ayudarán a construir una solución útil,
        clara y de bajo costo.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <Field
            label="1. ¿Actualmente tienes una propiedad para arrendar o la arrendarás pronto?"
            invalid={invalidFields.has("q1PropertySituation")}
            errorMessage="Selecciona una opción para continuar."
          >
            <select
              ref={setFieldRef("q1PropertySituation")}
              className={inputClass("q1PropertySituation")}
              aria-invalid={invalidFields.has("q1PropertySituation")}
              value={values.q1PropertySituation}
              onChange={(e) => {
                clearFieldError("q1PropertySituation");
                setValues((v) => ({ ...v, q1PropertySituation: e.target.value as LeadFormState["q1PropertySituation"] }));
              }}
            >
              <option value="" disabled>Selecciona una opción</option>
              <option value="yes_rented_before">Sí, y ya la he arrendado antes</option>
              <option value="yes_first_time">Sí, pero sería mi primera vez</option>
              <option value="evaluating">Estoy evaluándolo</option>
              <option value="no_property">No tengo propiedad para arrendar</option>
            </select>
          </Field>

          <Field
            label="2. Cuando has arrendado o pensado arrendar, ¿por cuál medio lo harías principalmente?"
            invalid={invalidFields.has("q2RentalChannel")}
            errorMessage="Selecciona una opción para continuar."
          >
            <select
              ref={setFieldRef("q2RentalChannel")}
              className={inputClass("q2RentalChannel")}
              aria-invalid={invalidFields.has("q2RentalChannel")}
              value={values.q2RentalChannel}
              onChange={(e) => {
                clearFieldError("q2RentalChannel");
                setValues((v) => ({ ...v, q2RentalChannel: e.target.value as LeadFormState["q2RentalChannel"] }));
              }}
            >
              <option value="" disabled>Selecciona una opción</option>
              <option value="agency">Por inmobiliaria o agencia</option>
              <option value="direct">Directamente entre particulares</option>
              <option value="both">Ambas opciones</option>
              <option value="never">Aún no he arrendado</option>
            </select>
          </Field>

          <Field
            label="3. ¿Qué es lo que más te preocupa al arrendar una propiedad?"
            invalid={invalidFields.has("q3MainConcern")}
            errorMessage="Selecciona una opción para continuar."
          >
            <select
              ref={setFieldRef("q3MainConcern")}
              className={inputClass("q3MainConcern")}
              aria-invalid={invalidFields.has("q3MainConcern")}
              value={values.q3MainConcern}
              onChange={(e) => {
                clearFieldError("q3MainConcern");
                setValues((v) => ({ ...v, q3MainConcern: e.target.value as LeadFormState["q3MainConcern"] }));
              }}
            >
              <option value="" disabled>Selecciona una opción</option>
              <option value="unclear_contract">No tener un contrato claro</option>
              <option value="counterparty_validation">No validar bien a la otra parte</option>
              <option value="payment_risk">Problemas con pagos o incumplimientos</option>
              <option value="delivery_state">Problemas con la entrega o estado del inmueble</option>
              <option value="conflict_resolution">No saber qué hacer si hay un conflicto</option>
              <option value="all">Todo lo anterior</option>
            </select>
          </Field>

          <Field
            label="4. ¿Usarías una app de bajo costo que te ayude a formalizar un arriendo ya acordado con contrato, firma electrónica, inventario, soportes y más adelante acceso a especialistas si lo deseas?"
            invalid={invalidFields.has("q4LowCostApp")}
            errorMessage="Selecciona una opción para continuar."
          >
            <select
              ref={setFieldRef("q4LowCostApp")}
              className={inputClass("q4LowCostApp")}
              aria-invalid={invalidFields.has("q4LowCostApp")}
              value={values.q4LowCostApp}
              onChange={(e) => {
                clearFieldError("q4LowCostApp");
                clearFieldError("q4NoReason");
                clearFieldError("q4NoReasonOther");
                setValues((v) => ({
                  ...v,
                  q4LowCostApp: e.target.value as LeadFormState["q4LowCostApp"],
                  q4NoReason: e.target.value === "no" ? v.q4NoReason : "",
                  q4NoReasonOther: e.target.value === "no" ? v.q4NoReasonOther : "",
                }));
              }}
            >
              <option value="" disabled>Selecciona una opción</option>
              <option value="yes">Sí</option>
              <option value="maybe">Tal vez</option>
              <option value="no">No</option>
            </select>
          </Field>

          {values.q4LowCostApp === "no" && (
            <>
              <Field
                label="Si respondiste NO, ¿por qué no la usarías?"
                invalid={invalidFields.has("q4NoReason")}
                errorMessage="Cuéntanos por qué no la usarías."
              >
                <select
                  ref={setFieldRef("q4NoReason")}
                  className={inputClass("q4NoReason")}
                  aria-invalid={invalidFields.has("q4NoReason")}
                  value={values.q4NoReason}
                  onChange={(e) => {
                    clearFieldError("q4NoReason");
                    clearFieldError("q4NoReasonOther");
                    setValues((v) => ({
                      ...v,
                      q4NoReason: e.target.value as LeadFormState["q4NoReason"],
                      q4NoReasonOther: e.target.value === "other" ? v.q4NoReasonOther : "",
                    }));
                  }}
                >
                  <option value="" disabled>Selecciona una opción</option>
                  <option value="price">Precio</option>
                  <option value="hard_to_use">Me parece difícil de usar</option>
                  <option value="not_needed">No lo considero necesario</option>
                  <option value="prefer_agency">Prefiero una agencia</option>
                  <option value="other">Otro</option>
                </select>
              </Field>
              {values.q4NoReason === "other" && (
                <Field
                  label="Cuéntanos cuál"
                  invalid={invalidFields.has("q4NoReasonOther")}
                  errorMessage="Escribe brevemente tu motivo."
                >
                  <textarea
                    ref={setFieldRef("q4NoReasonOther")}
                    className={inputClass("q4NoReasonOther", "input min-h-24")}
                    aria-invalid={invalidFields.has("q4NoReasonOther")}
                    placeholder="Escribe aquí tu motivo"
                    value={values.q4NoReasonOther}
                    onChange={(e) => {
                      clearFieldError("q4NoReasonOther");
                      setValues((v) => ({ ...v, q4NoReasonOther: e.target.value }));
                    }}
                    maxLength={280}
                  />
                </Field>
              )}
            </>
          )}
        </div>

        <div className="space-y-5">
          <Field
            label="5. ¿Qué valor te parecería razonable pagar una sola vez por contrato registrado, por este servicio?"
            invalid={invalidFields.has("q5WillingToPay")}
            errorMessage="Selecciona una opción para continuar."
          >
            <select
              ref={setFieldRef("q5WillingToPay")}
              className={inputClass("q5WillingToPay")}
              aria-invalid={invalidFields.has("q5WillingToPay")}
              value={values.q5WillingToPay}
              onChange={(e) => {
                clearFieldError("q5WillingToPay");
                setValues((v) => ({ ...v, q5WillingToPay: e.target.value as LeadFormState["q5WillingToPay"] }));
              }}
            >
              <option value="" disabled>Selecciona una opción</option>
              <option value="early_bird_50">~$49.900 COP (precio lanzamiento, primeros inscritos)</option>
              <option value="list_90">Cerca de $89.900 (precio de lista)</option>
              <option value="under_50">Menos de $50.000</option>
              <option value="range_50_70">Entre $50.000 y $70.000</option>
              <option value="range_70_100">Entre $70.000 y $100.000</option>
              <option value="would_not_pay">No pagaría por este servicio</option>
            </select>
          </Field>

          <Field
            label="6. ¿Qué debería contener la aplicación para que sea valiosa para ti?"
            invalid={invalidFields.has("q6ValuedModule")}
            errorMessage="Selecciona una opción para continuar."
          >
            <select
              ref={setFieldRef("q6ValuedModule")}
              className={inputClass("q6ValuedModule")}
              aria-invalid={invalidFields.has("q6ValuedModule")}
              value={values.q6ValuedModule}
              onChange={(e) => {
                clearFieldError("q6ValuedModule");
                clearFieldError("q6Other");
                setValues((v) => ({
                  ...v,
                  q6ValuedModule: e.target.value as LeadFormState["q6ValuedModule"],
                  q6Other: e.target.value === "other" ? v.q6Other : "",
                }));
              }}
            >
              <option value="" disabled>Selecciona una opción</option>
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
            <Field
              label="¿Qué debería contener?"
              invalid={invalidFields.has("q6Other")}
              errorMessage="Escribe qué debería contener la aplicación."
            >
              <textarea
                ref={setFieldRef("q6Other")}
                className={inputClass("q6Other", "input min-h-24")}
                aria-invalid={invalidFields.has("q6Other")}
                placeholder="Escribe aquí tu idea"
                value={values.q6Other}
                onChange={(e) => {
                  clearFieldError("q6Other");
                  setValues((v) => ({ ...v, q6Other: e.target.value }));
                }}
                maxLength={280}
              />
            </Field>
          )}

          <label className="block">
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-800">
              Correo electrónico para recibir acceso temprano (opcional)
            </span>
            <input
              type="email"
              className="input mt-1"
              placeholder="tu@correo.com"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              autoComplete="email"
            />
          </label>

          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={values.contactConsent}
              onChange={(e) => setValues((v) => ({ ...v, contactConsent: e.target.checked }))}
            />
            Acepto ser contactado para acceso temprano y novedades del producto (consentimiento
            básico para contacto informativo).
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          disabled={status === "sending"}
          className="min-h-11 w-full rounded-lg bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {status === "sending" ? "Enviando…" : "Enviar respuestas"}
        </button>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setStatus("idle");
            setMessage("");
          }}
          className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-300 dark:text-slate-800 dark:hover:bg-slate-200 sm:w-auto"
        >
          Limpiar
        </button>
      </div>

      {status === "done" && (
        <p
          role="status"
          aria-live="polite"
          className="whitespace-pre-line rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-100/50 dark:text-emerald-800"
        >
          {message}
        </p>
      )}
      {status === "error" && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/50 dark:text-rose-800"
        >
          {message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  invalid = false,
  errorMessage,
  children,
}: {
  label: string;
  invalid?: boolean;
  errorMessage?: string;
  children: React.ReactNode;
}) {
  // Usamos <label> como envoltorio: el control queda como descendiente y así
  // queda ASOCIADO a su etiqueta (nombre accesible), sin cambiar el diseño.
  return (
    <label className="block">
      <span
        className={
          invalid
            ? "block text-sm font-medium text-rose-700 dark:text-rose-700"
            : "block text-sm font-medium text-slate-800 dark:text-slate-800"
        }
      >
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {invalid && errorMessage && (
        <span className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-700">{errorMessage}</span>
      )}
    </label>
  );
}
