"use client";

import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseNotificationAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, codebtorSchema, updateDraft } from "@/features/contracts/wizard-state";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function CodebtorStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [error, setError] = useState("");

  // Derivamos si el usuario ya respondió la pregunta de codeudor. El valor
  // por defecto de `hasSolidaryCoDebtor` es false, así que no podemos
  // distinguir "todavía no eligió" de "eligió No" solo con ese flag.
  // Nos apoyamos en el evento `codebtor_option_selected` del audit trail.
  const hasMadeChoice = useMemo(
    () =>
      Boolean(
        draft?.auditTrail?.some((event) => event.event === "codebtor_option_selected"),
      ),
    [draft?.auditTrail],
  );

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
    if (!draft?.hasSolidaryCoDebtor) return;

    const addrParsed = parseNotificationAddressFromForm(formData);
    if (!addrParsed.success) {
      setError(addrParsed.error.issues[0]?.message ?? "Revisá la dirección de notificación.");
      return;
    }
    const notificationAddress = formatColombianNotificationAddress(addrParsed.data);

    const parsed = codebtorSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationAddress,
      dataProcessingConsent: formData.get("dataProcessingConsent") === "on",
      electronicSignatureConsent: formData.get("electronicSignatureConsent") === "on",
      solidaryObligationAcceptance: formData.get("solidaryObligationAcceptance") === "on",
    });

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
            notificationAddressParts: addrParsed.data,
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
          {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
        </form>
      )}

      {/*
        Barra de navegación contextual del paso Codeudor. Antes se usaba el
        componente compartido `StepNav`, pero su botón `Guardar y continuar`
        es un submit que solo funciona si el formulario del codeudor está
        montado (es decir, si el usuario eligió "Sí"). Como ese formulario
        es condicional, al iniciar el paso el botón quedaba inerte y daba
        la impresión de estar deshabilitado. Ahora la barra refleja el
        estado real de la decisión.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/contracts/${id}/tenant`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
        >
          Anterior
        </Link>

        {!hasMadeChoice && (
          <p className="text-sm text-amber-100/90">
            Elegí si vas a incluir un codeudor solidario para continuar.
          </p>
        )}

        {hasMadeChoice && !draft.hasSolidaryCoDebtor && (
          <Link
            href={`/dashboard/contracts/${id}/property`}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
          >
            Continuar al inmueble
          </Link>
        )}

        {hasMadeChoice && draft.hasSolidaryCoDebtor && (
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
