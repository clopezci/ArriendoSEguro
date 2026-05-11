"use client";

import { UrbanAddressFields } from "@/components/contracts/urban-address-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseUrbanAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, propertySchema, updateDraft } from "@/features/contracts/wizard-state";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function PropertyStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [error, setError] = useState("");

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando…</p>;

  function onSubmit(formData: FormData) {
    const addrParsed = parseUrbanAddressFromForm(formData, "propAddr");
    if (!addrParsed.success) {
      const msg =
        addrParsed.error.issues[0]?.message ?? "Revisá la dirección del inmueble a arrendar.";
      setError(msg);
      return;
    }
    const address = formatColombianNotificationAddress(addrParsed.data);
    const commercialValue = Number(formData.get("commercialValue") ?? 0);
    const monthlyRentProposed = Number(formData.get("monthlyRentProposed") ?? 0);
    const legalRentCap = Number((commercialValue * 0.01).toFixed(0));

    const parsed = propertySchema.safeParse({
      address,
      city: String(formData.get("city") ?? ""),
      department: String(formData.get("department") ?? ""),
      type: String(formData.get("type") ?? ""),
      registryNumber: String(formData.get("registryNumber") ?? ""),
      commercialValue,
      legalRentCap,
      monthlyRentProposed,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Revisa los datos del inmueble a arrendar.";
      setError(msg);
      updateDraft(id, (d) => appendAudit(d, "rent_cap_validation_failed", { reason: msg }));
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
    updateDraft(id, (d) => appendAudit(d, "rent_cap_validation_passed"));
    router.push(`/dashboard/contracts/${id}/terms`);
  }

  const legacyAddress =
    !!draft.property.address && !draft.property.addressParts;

  return (
    <WizardShell title="Inmueble a arrendar" currentStep={5} contractId={id}>
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
        <Input name="department" label="Departamento" defaultValue={draft.property.department} />
        <Input name="type" label="Tipo de inmueble" defaultValue={draft.property.type} />
        <Input name="registryNumber" label="Matrícula / registro" defaultValue={draft.property.registryNumber} />
        <Input
          name="commercialValue"
          type="number"
          label="Valor comercial"
          defaultValue={String(draft.property.commercialValue ?? "")}
        />
        <Input
          name="monthlyRentProposed"
          type="number"
          label="Canon propuesto"
          defaultValue={String(draft.property.monthlyRentProposed ?? draft.lease.monthlyRent ?? "")}
        />
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 sm:col-span-2">
          El sistema estima el canon máximo legal como 1% del valor comercial.
        </div>
        {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
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
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        type={type}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
      />
    </label>
  );
}
