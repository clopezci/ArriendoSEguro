"use client";

import { UrbanAddressFields } from "@/components/contracts/urban-address-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseUrbanAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, propertySchema, updateDraft } from "@/features/contracts/wizard-state";
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

  // Sincroniza el estado local con el draft cuando se carga por primera
  // vez (o cuando se navega de vuelta al paso con datos persistidos).
  useEffect(() => {
    if (!draft) return;
    setValueUnknown(Boolean(draft.property.commercialValueUnknown));
    setCommercialValuePreview(Number(draft.property.commercialValue ?? 0));
  }, [draft]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-300">Cargando…</p>;
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
    });
    if (!parsed.success) {
      const list = humanizeZodIssues(parsed.error.issues, PROPERTY_FIELD_LABELS);
      setErrors(list);
      updateDraft(id, (d) =>
        appendAudit(d, "rent_cap_validation_failed", { reason: list[0] ?? "" }),
      );
      return;
    }

    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          property: {
            ...parsed.data,
            addressParts: addrParsed.data,
          },
          lease: { ...d.lease, monthlyRent: parsed.data.monthlyRentProposed },
        },
        "property_data_saved",
      ),
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

        <div className="sm:col-span-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <h3 className="text-sm font-semibold text-violet-100">
            Valor comercial del inmueble
          </h3>
          <p className="mt-1 text-xs text-slate-300">
            Pedimos este dato para verificar que el canon mensual no supere el{" "}
            <strong className="text-violet-100">1% del valor comercial</strong>, que es
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
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                <p className="text-slate-400">Tope legal estimado (1%):</p>
                <p className="mt-1 text-base font-semibold text-violet-100">
                  {formatCOP(estimatedCap)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  El canon mensual no puede superar este valor.
                </p>
              </div>
            </div>
          )}

          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-200">
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
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
              <p className="font-semibold">Declaración del arrendador</p>
              <p className="mt-1">
                Como arrendador, declaro bajo mi responsabilidad que el canon mensual
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
                  defaultChecked={Boolean(draft.property.noCapAcknowledgement)}
                  className="mt-0.5 h-4 w-4 accent-amber-300"
                />
                <span className="text-amber-50">
                  Acepto expresamente esta responsabilidad y eximo a ArriendoSeguro.
                </span>
              </label>
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
          hint="Valor mensual del arriendo en pesos colombianos."
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
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
      />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
