"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, codebtorSchema, updateDraft } from "@/features/contracts/wizard-state";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function CodebtorStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [error, setError] = useState("");

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando…</p>;

  function onToggle(has: boolean) {
    updateDraft(id, (d) =>
      appendAudit({ ...d, hasSolidaryCoDebtor: has }, "codebtor_option_selected", {
        hasCodebtor: has,
      }),
    );
    if (!has) router.push(`/dashboard/contracts/${id}/property`);
  }

  function onSubmit(formData: FormData) {
    if (!draft) return;
    if (!draft.hasSolidaryCoDebtor) return;
    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationAddress: String(formData.get("notificationAddress") ?? ""),
      dataProcessingConsent: formData.get("dataProcessingConsent") === "on",
      electronicSignatureConsent: formData.get("electronicSignatureConsent") === "on",
      solidaryObligationAcceptance: formData.get("solidaryObligationAcceptance") === "on",
    };
    const parsed = codebtorSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Completa los datos y consentimientos.");
      return;
    }
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
          },
          codebtorConsents: {
            dataProcessingConsent: true,
            electronicSignatureConsent: true,
            solidaryObligationAcceptance: true,
          },
        },
        "codebtor_data_saved",
      ),
    );
    router.push(`/dashboard/contracts/${id}/property`);
  }

  return (
    <WizardShell title="Codeudor solidario" currentStep={4} contractId={id}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          ¿El contrato tendrá codeudor solidario?
        </p>
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
          Un codeudor solidario es una persona que acepta respaldar las obligaciones del
          arrendatario dentro del contrato. Si eliges esta opción, esa persona deberá ingresar sus
          datos, aceptar el tratamiento de datos y firmar electrónicamente el contrato.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={`rounded-lg px-4 py-2 text-sm ${
              draft.hasSolidaryCoDebtor
                ? "bg-violet-600 text-white"
                : "border border-slate-700 text-slate-200"
            }`}
          >
            Sí, incluir codeudor solidario
          </button>
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={`rounded-lg px-4 py-2 text-sm ${
              !draft.hasSolidaryCoDebtor
                ? "bg-violet-600 text-white"
                : "border border-slate-700 text-slate-200"
            }`}
          >
            No, continuar sin codeudor
          </button>
        </div>
      </div>

      {draft.hasSolidaryCoDebtor && (
        <form id="wizard-form" action={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input name="fullName" label="Nombre completo" defaultValue={draft.solidaryCoDebtor.fullName} />
          <Input name="documentType" label="Tipo de documento" defaultValue={draft.solidaryCoDebtor.documentType} />
          <Input name="documentNumber" label="Número de documento" defaultValue={draft.solidaryCoDebtor.documentNumber} />
          <Input name="city" label="Ciudad" defaultValue={draft.solidaryCoDebtor.city} />
          <Input name="email" label="Correo" type="email" defaultValue={draft.solidaryCoDebtor.email} />
          <Input name="phone" label="Teléfono" defaultValue={draft.solidaryCoDebtor.phone} />
          <div className="sm:col-span-2">
            <Input
              name="notificationAddress"
              label="Dirección de notificación"
              defaultValue={draft.solidaryCoDebtor.notificationAddress}
            />
          </div>
          <Check name="dataProcessingConsent" label="Acepto tratamiento de datos." />
          <Check name="electronicSignatureConsent" label="Acepto firma electrónica." />
          <div className="sm:col-span-2">
            <Check
              name="solidaryObligationAcceptance"
              label="Acepto la obligación solidaria dentro del contrato."
            />
          </div>
          {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
        </form>
      )}

      <StepNav
        backHref={`/dashboard/contracts/${id}/tenant`}
        nextHref={`/dashboard/contracts/${id}/property`}
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

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" name={name} className="h-4 w-4 rounded border-slate-500" />
      {label}
    </label>
  );
}

