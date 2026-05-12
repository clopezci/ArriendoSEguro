"use client";

import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseNotificationAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, codebtorSchema, updateDraft } from "@/features/contracts/wizard-state";
import {
  sanitizeCodebtorFromForm,
  sanitizeCodebtorEconomicSupportFromForm,
  PARTY_FIELD_LABELS,
} from "@/features/contracts/party-sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Estado local de la decisión sobre el codeudor solidario:
 * - `pending`: el usuario aún no ha elegido en esta sesión y tampoco hay
 *   evento previo en el audit trail (paso por primera vez).
 * - `yes`: optó por incluir codeudor → se muestra el formulario completo.
 * - `no`: optó por continuar sin codeudor → se muestra el atajo para
 *   continuar al inmueble.
 *
 * Necesitamos este estado local explícito porque:
 * 1. El flag `draft.hasSolidaryCoDebtor` arranca en `false` por defecto, por
 *    lo que no distingue "todavía no eligió" de "eligió No".
 * 2. `useDraftGuard` solo lee el draft de `localStorage` en su `useEffect`
 *    inicial; tras `updateDraft` el componente no se vuelve a re-renderizar
 *    con el nuevo valor del flag, así que el formulario nunca aparecía al
 *    cambiar la elección de "No" a "Sí" durante la misma visita al paso.
 */
type CodebtorDecision = "pending" | "yes" | "no";

function deriveInitialDecision(
  hasSolidaryCoDebtor: boolean,
  auditTrail: { event: string }[],
): CodebtorDecision {
  const previouslySelected = auditTrail.some(
    (event) => event.event === "codebtor_option_selected",
  );
  if (!previouslySelected) return "pending";
  return hasSolidaryCoDebtor ? "yes" : "no";
}

export default function CodebtorStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [decision, setDecision] = useState<CodebtorDecision>("pending");

  useEffect(() => {
    if (!draft) return;
    setDecision(deriveInitialDecision(draft.hasSolidaryCoDebtor, draft.auditTrail));
  }, [draft]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-300">Cargando…</p>;
  }

  function onToggle(has: boolean) {
    updateDraft(id, (d) =>
      appendAudit({ ...d, hasSolidaryCoDebtor: has }, "codebtor_option_selected", {
        hasCodebtor: has,
      }),
    );
    setDecision(has ? "yes" : "no");
    setErrors([]);
    if (!has) {
      router.push(`/dashboard/contracts/${id}/property`);
    }
  }

  function onSubmit(formData: FormData) {
    if (decision !== "yes") return;
    setErrors([]);

    const addrParsed = parseNotificationAddressFromForm(formData);
    if (!addrParsed.success) {
      setErrors(humanizeZodIssues(addrParsed.error.issues));
      return;
    }
    const notificationAddress = formatColombianNotificationAddress(addrParsed.data);
    const sanitized = sanitizeCodebtorFromForm(formData, { notificationAddress });
    const parsed = codebtorSchema.safeParse(sanitized);

    if (!parsed.success) {
      setErrors(humanizeZodIssues(parsed.error.issues, PARTY_FIELD_LABELS));
      return;
    }

    const economicSupport = sanitizeCodebtorEconomicSupportFromForm(formData);
    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          solidaryCoDebtor: {
            fullName: parsed.data.fullName,
            documentType: parsed.data.documentType,
            documentNumber: parsed.data.documentNumber,
            city: parsed.data.city,
            email: parsed.data.email,
            phone: parsed.data.phone,
            notificationAddress: parsed.data.notificationAddress,
            notificationAddressParts: addrParsed.data,
            truthfulnessOathAccepted: Boolean(parsed.data.truthfulnessOath),
            economicSupport,
          },
          codebtorConsents: {
            dataProcessingConsent: true,
            electronicSignatureConsent: true,
            solidaryObligationAcceptance: true,
          },
        },
        "codebtor_data_saved",
        {
          truthfulnessOathAccepted: Boolean(parsed.data.truthfulnessOath),
          hasEconomicSupport: Boolean(economicSupport),
        },
      ),
    );
    router.push(`/dashboard/contracts/${id}/property`);
  }

  // Estilos comunes para los botones Sí/No. Cuando la decisión está en
  // `pending` ninguno se pinta como "seleccionado": ambos comparten un
  // mismo borde violeta suave para que se vea con claridad que son dos
  // opciones a elegir y no que una está deshabilitada.
  function choiceButtonClass(active: boolean): string {
    const base =
      "flex-1 rounded-lg px-4 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-violet-400 sm:flex-initial";
    if (active) {
      return `${base} bg-violet-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]`;
    }
    return `${base} border-2 border-violet-500/45 bg-slate-900/60 text-slate-100 hover:border-violet-300 hover:bg-slate-800`;
  }

  return (
    <WizardShell title="Codeudor solidario" currentStep={5} contractId={id}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          ¿El contrato tendrá codeudor solidario?
        </p>
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
          Un codeudor solidario es una persona que acepta respaldar las obligaciones del
          arrendatario dentro del contrato. Si eliges esta opción, esa persona deberá ingresar sus
          datos, aceptar el tratamiento de datos y firmar electrónicamente el contrato.
        </p>
        <div
          className="flex flex-col gap-3 sm:flex-row"
          role="radiogroup"
          aria-label="Decisión sobre codeudor solidario"
        >
          <button
            type="button"
            role="radio"
            aria-checked={decision === "yes"}
            onClick={() => onToggle(true)}
            className={choiceButtonClass(decision === "yes")}
          >
            Sí, incluir codeudor solidario
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={decision === "no"}
            onClick={() => onToggle(false)}
            className={choiceButtonClass(decision === "no")}
          >
            No, continuar sin codeudor
          </button>
        </div>
      </div>

      {decision === "yes" && (
        <form
          id="wizard-form"
          className="mt-5 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
        >
          <PartyDataFields
            party={draft.solidaryCoDebtor}
            legacyFreeTextAddressMessage={
              !!draft.solidaryCoDebtor.notificationAddress &&
              !draft.solidaryCoDebtor.notificationAddressParts
            }
          />
          <Check name="dataProcessingConsent" label="Acepto tratamiento de datos." />
          <Check name="electronicSignatureConsent" label="Acepto firma electrónica." />
          <div className="sm:col-span-2">
            <Check
              name="solidaryObligationAcceptance"
              label="Acepto la obligación solidaria dentro del contrato."
            />
          </div>

          <CodebtorEconomicSupportSection
            initial={draft.solidaryCoDebtor.economicSupport}
          />

          {errors.length > 0 && (
            <div
              role="alert"
              className="sm:col-span-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <p className="font-semibold">Revisa estos campos antes de continuar:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}

      {/*
        Barra de navegación contextual del paso Codeudor.
        - Decisión pendiente: solo "Anterior" y mensaje guía.
        - Decisión "No": atajo directo al inmueble.
        - Decisión "Sí": submit del formulario de datos del codeudor.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/contracts/${id}/tenant`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
        >
          Anterior
        </Link>

        {decision === "pending" && (
          <p className="text-sm text-amber-100/90">
            Elegí si vas a incluir un codeudor solidario para continuar.
          </p>
        )}

        {decision === "no" && (
          <Link
            href={`/dashboard/contracts/${id}/property`}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
          >
            Continuar al inmueble
          </Link>
        )}

        {decision === "yes" && (
          <button
            form="wizard-form"
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
          >
            Guardar codeudor y continuar
          </button>
        )}
      </div>
    </WizardShell>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" name={name} className="h-4 w-4 rounded border-slate-500" />
      {label}
    </label>
  );
}

/**
 * Bloque OPCIONAL de respaldo económico del codeudor solidario.
 *
 * En el mercado informal colombiano es común que el arrendador pida al
 * codeudor carta laboral, colilla de pago y/o certificado de libertad y
 * tradición de un inmueble. ArriendoSeguro no custodia esos documentos
 * (la carga digital queda como mejora futura): solo registramos qué se
 * entregó y los datos básicos para que el arrendador pueda dejar la
 * trazabilidad en el expediente.
 */
function CodebtorEconomicSupportSection({
  initial,
}: {
  initial?: import("@/features/contracts/draft-types").CodebtorEconomicSupportDraft;
}) {
  const docOptions: Array<{
    value:
      | "CARTA_LABORAL"
      | "COLILLA_PAGO"
      | "CERTIFICADO_LIBERTAD_TRADICION"
      | "EXTRACTO_BANCARIO"
      | "DECLARACION_RENTA"
      | "OTRO";
    label: string;
  }> = [
    { value: "CARTA_LABORAL", label: "Carta laboral" },
    { value: "COLILLA_PAGO", label: "Colilla / desprendible de pago" },
    {
      value: "CERTIFICADO_LIBERTAD_TRADICION",
      label: "Certificado de libertad y tradición de un inmueble del codeudor",
    },
    { value: "EXTRACTO_BANCARIO", label: "Extracto bancario" },
    { value: "DECLARACION_RENTA", label: "Declaración de renta" },
    { value: "OTRO", label: "Otro soporte" },
  ];
  const initialDocs = new Set(initial?.documentsProvided ?? []);

  return (
    <div className="sm:col-span-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <h4 className="text-sm font-semibold text-violet-100">
        Respaldo económico del codeudor (opcional)
      </h4>
      <p className="mt-1 text-xs text-slate-300">
        En Colombia es habitual pedirle al codeudor carta laboral, colilla
        de pago, certificado de libertad y tradición de un inmueble u otros
        soportes de capacidad de pago. Estos datos son <strong>informativos</strong>{" "}
        para el arrendador y quedan en el expediente; ArriendoSeguro no
        custodia los documentos físicos en esta fase.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Empresa donde labora</span>
          <input
            name="supportEmployerName"
            defaultValue={initial?.employerName ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Ej. ACME S.A.S."
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Cargo</span>
          <input
            name="supportPosition"
            defaultValue={initial?.position ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Ej. Coordinador de operaciones"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Ingreso mensual aprox. (COP)</span>
          <input
            name="supportMonthlyIncome"
            type="number"
            inputMode="numeric"
            defaultValue={
              initial?.monthlyIncome ? String(initial.monthlyIncome) : ""
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Ej. 4500000"
          />
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 block text-xs font-medium text-slate-300">
          Soportes que entregó al arrendador
        </legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {docOptions.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                name={`supportDoc_${opt.value}`}
                defaultChecked={initialDocs.has(opt.value)}
                className="mt-0.5 h-4 w-4 accent-violet-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-slate-300">Notas del arrendador (opcional)</span>
        <textarea
          name="supportNotes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          placeholder="Ej. Carta laboral expedida el 12/04/2026; colilla de marzo recibida en físico."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          name="supportLandlordVerified"
          defaultChecked={Boolean(initial?.landlordVerifiedConsent)}
          className="mt-0.5 h-4 w-4 accent-violet-500"
        />
        <span>
          Como arrendador, declaro haber recibido y verificado los soportes
          marcados arriba (la verificación de autenticidad es de mi
          responsabilidad).
        </span>
      </label>
    </div>
  );
}
