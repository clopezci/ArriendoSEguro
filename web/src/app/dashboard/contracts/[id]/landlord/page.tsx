"use client";

import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { flashSaved } from "@/components/contracts/save-flash";
import { appendAudit, landlordSchema, updateDraft } from "@/features/contracts/wizard-state";
import { sanitizePartyFromForm, PARTY_FIELD_LABELS } from "@/features/contracts/party-sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useAuth } from "@/contexts/auth-context";
import { getMyLandlordProfile, saveMyLandlordProfile } from "@/features/contracts/saved-entities-client";
import type { PartyDraft } from "@/features/contracts/draft-types";
import type { SavedLandlordProfile } from "@/domain/saved-entities/savedEntities";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LandlordStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const { user } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  // Valores con los que se renderiza el formulario (los inputs son no controlados:
  // remontamos con `formKey` para prellenar con datos guardados).
  const [party, setParty] = useState<PartyDraft>(draft?.landlord ?? {});
  const [formKey, setFormKey] = useState(0);
  const [savedProfile, setSavedProfile] = useState<SavedLandlordProfile | null>(null);
  const [saveForReuse, setSaveForReuse] = useState(true);
  const [usedSaved, setUsedSaved] = useState(false);

  useEffect(() => {
    if (draft?.landlord) setParty(draft.landlord);
  }, [draft?.landlord]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) return;
      const p = await getMyLandlordProfile(user);
      if (!cancelled) setSavedProfile(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function applySavedData() {
    if (!savedProfile) return;
    // El oath NO se prellena: se acepta de nuevo en cada contrato.
    setParty({ ...savedProfile, truthfulnessOathAccepted: false });
    setFormKey((k) => k + 1);
    setUsedSaved(true);
  }

  function onSubmit(formData: FormData) {
    setErrors([]);
    // Datos mínimos: la dirección de notificación de las personas ya no se pide.
    const sanitized = sanitizePartyFromForm(formData, { notificationAddress: "" });
    const parsed = landlordSchema.safeParse(sanitized);

    if (!parsed.success) {
      setErrors(humanizeZodIssues(parsed.error.issues, PARTY_FIELD_LABELS));
      return;
    }

    const { truthfulnessOath, ...landlordData } = parsed.data;
    const landlord: PartyDraft = {
      ...landlordData,
      truthfulnessOathAccepted: Boolean(truthfulnessOath),
    };
    updateDraft(id, (d) =>
      appendAudit(
        { ...d, landlord, status: "data_in_progress" },
        "landlord_data_saved",
        { truthfulnessOathAccepted: Boolean(truthfulnessOath) },
      ),
    );

    // Guardar/actualizar el perfil para reutilizarlo (best-effort; no bloquea).
    if (saveForReuse && user) {
      void saveMyLandlordProfile(user, { ...landlordData, notificationAddress: "" });
    }

    flashSaved(() => router.push(`/dashboard/contracts/${id}/property`));
  }

  return (
    <WizardShell title="Datos del arrendador (dueño del inmueble)" currentStep={2} contractId={id}>
      {savedProfile && !usedSaved && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-300 bg-violet-50/60 p-3 text-sm">
          <span className="text-slate-700">
            Tienes tus datos guardados (<strong>{savedProfile.fullName}</strong>). ¿Los usamos para este contrato?
          </span>
          <button
            type="button"
            onClick={applySavedData}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white"
          >
            Usar mis datos
          </button>
        </div>
      )}

      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <PartyDataFields
          key={formKey}
          party={party}
          oathId="landlord_truthfulness_oath"
          contractDraftId={id}
        />

        <label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={saveForReuse}
            onChange={(e) => setSaveForReuse(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-violet-600"
          />
          <span>
            <strong>Guardar mis datos para reutilizarlos</strong> en futuros contratos. Son tuyos y solo tú los ves; los
            usamos para agilizar tus próximos arriendos.
          </span>
        </label>

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
        backHref={`/dashboard/contracts/${id}/contract-type`}
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/property`}
      />
    </WizardShell>
  );
}
