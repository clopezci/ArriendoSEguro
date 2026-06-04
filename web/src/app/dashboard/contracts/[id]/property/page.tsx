"use client";

import { UrbanAddressFields } from "@/components/contracts/urban-address-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { OathEvidenceBadge } from "@/components/contracts/oath-evidence-badge";
import {
  formatColombianNotificationAddress,
  parseUrbanAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, propertySchema, updateDraft } from "@/features/contracts/wizard-state";
import { LegalSemaphore } from "@/components/contracts/legal-semaphore";
import { toTitleCaseEs, trimAndCollapse } from "@/lib/text/sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Etiquetas amigables para mapear los `path` de Zod a un texto en español
 * cuando se muestra la lista de errores al usuario.
 */
const PROPERTY_FIELD_LABELS: Record<string, string> = {
  address: "Dirección del inmueble",
  city: "Ciudad",
  department: "Departamento",
  type: "Tipo de inmueble",
  registryNumber: "Matrícula / registro",
  commercialValue: "Valor comercial",
  legalRentCap: "Tope legal del canon",
  monthlyRentProposed: "Canon propuesto",
  noCapAcknowledgement: "Aceptación de responsabilidad",
  propertyOwnershipOath: "Declaración bajo juramento (inmueble)",
};

/** Formato de pesos colombianos para mostrar el tope estimado. */
function formatCOP(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PropertyStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [valueUnknown, setValueUnknown] = useState<boolean>(false);
  const [commercialValuePreview, setCommercialValuePreview] = useState<number>(0);
  const [rentPreview, setRentPreview] = useState<number>(0);
  const [ownershipOath, setOwnershipOath] = useState<boolean>(false);
  const [noCapAccepted, setNoCapAccepted] = useState<boolean>(false);

  // Sincroniza el estado local con el draft cuando se carga por primera
  // vez (o cuando se navega de vuelta al paso con datos persistidos).
  useEffect(() => {
    if (!draft) return;
    setValueUnknown(Boolean(draft.property.commercialValueUnknown));
    setCommercialValuePreview(Number(draft.property.commercialValue ?? 0));
    setRentPreview(Number(draft.property.monthlyRentProposed ?? draft.lease.monthlyRent ?? 0));
    setOwnershipOath(Boolean(draft.property.propertyOwnershipOath));
    setNoCapAccepted(Boolean(draft.property.noCapAcknowledgement));
  }, [draft]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function onSubmit(formData: FormData) {
    setErrors([]);

    const addrParsed = parseUrbanAddressFromForm(formData, "propAddr");
    if (!addrParsed.success) {
      setErrors(humanizeZodIssues(addrParsed.error.issues));
      return;
    }
    const address = formatColombianNotificationAddress(addrParsed.data);

    const commercialValueRaw = Number(formData.get("commercialValue") ?? 0);
    const commercialValue = valueUnknown ? 0 : commercialValueRaw;
    const legalRentCap = valueUnknown ? 0 : Number((commercialValueRaw * 0.01).toFixed(0));
    const monthlyRentProposed = Number(formData.get("monthlyRentProposed") ?? 0);
    const noCapAcknowledgement = formData.get("noCapAcknowledgement") === "on";

    const parsed = propertySchema.safeParse({
      address,
      city: toTitleCaseEs(String(formData.get("city") ?? "")),
      department: toTitleCaseEs(String(formData.get("department") ?? "")),
      type: toTitleCaseEs(String(formData.get("type") ?? "")),
      registryNumber: trimAndCollapse(String(formData.get("registryNumber") ?? "")).toUpperCase(),
      commercialValue,
      legalRentCap,
      monthlyRentProposed,
      commercialValueUnknown: valueUnknown,
      noCapAcknowledgement,
      propertyOwnershipOath: ownershipOath,
    });
    if (!parsed.success) {
      const list = humanizeZodIssues(parsed.error.issues, PROPERTY_FIELD_LABELS);
      setErrors(list);
      updateDraft(id, (d) =>
        appendAudit(d, "rent_cap_validation_failed", { reason: list[0] ?? "" }),
      );
      return;
    }

    const acceptedAt = new Date().toISOString();
    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          property: {
            ...parsed.data,
            addressParts: addrParsed.data,
            propertyOwnershipOathAt: acceptedAt,
          },
          lease: { ...d.lease, monthlyRent: parsed.data.monthlyRentProposed },
        },
        "property_data_saved",
      ),
    );
    updateDraft(id, (d) =>
      appendAudit(d, "property_ownership_oath_accepted", {
        registryNumber: parsed.data.registryNumber,
      }),
    );
    if (parsed.data.commercialValueUnknown) {
      updateDraft(id, (d) =>
        appendAudit(d, "property_cap_unknown_acknowledged", {
          monthlyRentProposed: parsed.data.monthlyRentProposed,
        }),
      );
    } else {
      updateDraft(id, (d) => appendAudit(d, "rent_cap_validation_passed"));
    }
    router.push(`/dashboard/contracts/${id}/terms`);
  }

  const legacyAddress = !!draft.property.address && !draft.property.addressParts;
  const estimatedCap = valueUnknown ? 0 : Number((commercialValuePreview * 0.01).toFixed(0));

  // Semáforo en vivo del canon vs. tope del 1% (Ley 820, art. 18).
  const rentSemaphore: { status: "pass" | "fail" | "warn" | "info"; detail: string } = valueUnknown
    ? {
        status: "info",
        detail:
          "Declaraste no conocer el valor comercial: el tope del 1% queda bajo tu responsabilidad.",
      }
    : estimatedCap <= 0 || rentPreview <= 0
      ? {
          status: "warn",
          detail: "Ingresa el valor comercial y el canon para verificar el tope del 1%.",
        }
      : rentPreview > estimatedCap
        ? {
            status: "fail",
            detail: `El canon (${formatCOP(rentPreview)}) supera el tope del 1% (${formatCOP(estimatedCap)}).`,
          }
        : {
            status: "pass",
            detail: `El canon (${formatCOP(rentPreview)}) está dentro del tope del 1% (${formatCOP(estimatedCap)}).`,
          };

  return (
    <WizardShell title="Inmueble a arrendar" currentStep={6} contractId={id}>
      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <UrbanAddressFields
          prefix="propAddr"
          parts={draft.property.addressParts}
          variant="inmueble"
          legacyFreeTextAddress={legacyAddress}
        />
        <Input name="city" label="Ciudad" defaultValue={draft.property.city} />
        <Input
          name="department"
          label="Departamento"
          defaultValue={draft.property.department}
        />
        <Input name="type" label="Tipo de inmueble" defaultValue={draft.property.type} />
        <Input
          name="registryNumber"
          label="Matrícula / registro"
          defaultValue={draft.property.registryNumber}
        />

        <div className="sm:col-span-2 rounded-xl border border-violet-300 bg-violet-50 p-4">
          <h3 className="text-sm font-semibold text-violet-800">
            Valor comercial del inmueble
          </h3>
          <p className="mt-1 text-xs text-slate-700">
            Pedimos este dato para verificar que el canon mensual no supere el{" "}
            <strong className="text-violet-800">1% del valor comercial</strong>, que es
            el límite máximo permitido por la <strong>Ley 820 de 2003</strong> para
            contratos de arrendamiento de vivienda urbana en Colombia.
          </p>

          {!valueUnknown && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                name="commercialValue"
                type="number"
                label="Valor comercial (COP)"
                defaultValue={String(draft.property.commercialValue ?? "")}
                onValueChange={(v) => setCommercialValuePreview(Number(v || 0))}
                hint="Avalúo comercial estimado del inmueble."
              />
              <div className="rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-xs text-slate-700">
                <p className="text-slate-600">Tope legal estimado (1%):</p>
                <p className="mt-1 text-base font-semibold text-violet-800">
                  {formatCOP(estimatedCap)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  El canon mensual no puede superar este valor.
                </p>
              </div>
            </div>
          )}

          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs text-slate-800">
            <input
              type="checkbox"
              name="commercialValueUnknown"
              checked={valueUnknown}
              onChange={(e) => setValueUnknown(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-violet-500"
            />
            <span>
              No conozco el valor comercial del inmueble.
            </span>
          </label>

          {valueUnknown && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100/60 p-3 text-xs leading-relaxed text-amber-800">
              <p className="font-semibold">Declaración del arrendador (dueño)</p>
              <p className="mt-1">
                Como arrendador (dueño del inmueble), declaro bajo mi responsabilidad que el canon mensual
                pactado <strong>no superará el 1% del valor comercial</strong> real
                del inmueble (Ley 820 de 2003). Acepto que si lo excede, asumo de
                forma exclusiva las consecuencias legales y económicas, eximiendo a
                <em> ArriendoSeguro</em> de toda responsabilidad sobre la verificación
                de ese tope, dado que no se aportó el valor comercial al momento de
                generar el contrato.
              </p>
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  name="noCapAcknowledgement"
                  checked={noCapAccepted}
                  onChange={(e) => setNoCapAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-300"
                />
                <span className="text-amber-800">
                  Acepto expresamente esta responsabilidad y eximo a ArriendoSeguro.
                </span>
              </label>
              <OathEvidenceBadge
                active={noCapAccepted}
                oathId="property_no_cap_acknowledgement"
                contractDraftId={id}
              />
            </div>
          )}
        </div>

        <Input
          name="monthlyRentProposed"
          type="number"
          label="Canon mensual propuesto (COP)"
          defaultValue={String(
            draft.property.monthlyRentProposed ?? draft.lease.monthlyRent ?? "",
          )}
          onValueChange={(v) => setRentPreview(Number(v || 0))}
          hint="Valor mensual del arriendo en pesos colombianos."
        />

        <div className="sm:col-span-2">
          <LegalSemaphore
            status={rentSemaphore.status}
            label="Canon vs. tope legal del 1% (Ley 820, art. 18)"
            detail={rentSemaphore.detail}
          />
        </div>

        <div className="sm:col-span-2 rounded-xl border border-amber-300 bg-amber-100/60 p-4 text-sm text-amber-800">
          <h3 className="text-sm font-semibold text-amber-800">
            Declaración bajo juramento sobre el inmueble
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Esta declaración es obligatoria para evitar disputas posteriores y
            para que el contrato tenga validez frente a terceros. Por favor
            revisa con cuidado antes de aceptar.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              name="propertyOwnershipOath"
              checked={ownershipOath}
              onChange={(e) => setOwnershipOath(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-300"
            />
            <span className="text-amber-800">
              Bajo la gravedad de juramento declaro que (i) los datos del
              inmueble registrados, incluida la matrícula inmobiliaria, son
              <strong> reales y verdaderos</strong>, y (ii) soy el
              <strong> propietario del inmueble</strong> o cuento con
              <strong> poder vigente y suficiente</strong> para arrendarlo a
              nombre de su propietario. Asumo la responsabilidad legal y
              económica por la veracidad de esta declaración.
            </span>
          </label>
          <OathEvidenceBadge
            active={ownershipOath}
            oathId="property_ownership_oath"
            contractDraftId={id}
          />
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <span aria-hidden="true">📎</span> Podrás <strong>cargar la escritura, el certificado de libertad o el
            poder autenticado</strong> en la sección «Documentos de propiedad / poder» (Evidencias del expediente),
            después de guardar la versión del contrato.
          </p>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-lg border border-rose-300 bg-rose-100/60 p-3 text-sm text-rose-800"
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
      <StepNav
        backHref={
          draft.hasSolidaryCoDebtor
            ? `/dashboard/contracts/${id}/codebtor`
            : `/dashboard/contracts/${id}/tenant`
        }
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/terms`}
      />
    </WizardShell>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
  hint,
  onValueChange,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  hint?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
      />
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}
