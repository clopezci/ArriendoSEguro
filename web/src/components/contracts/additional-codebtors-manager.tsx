"use client";

import { useState } from "react";
import {
  appendAudit,
  getDraft,
  updateDraft,
  type PartyDraft,
} from "@/features/contracts/wizard-state";
import { IncomeSuggestion } from "@/components/contracts/income-suggestion";
import { PartyInvitePanel } from "@/components/contracts/party-invite-panel";

type NewCodebtor = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
  income: string;
  notificationAddress: string;
  oath: boolean;
};

const EMPTY: NewCodebtor = {
  fullName: "",
  documentType: "CC",
  documentNumber: "",
  city: "",
  email: "",
  phone: "",
  income: "",
  notificationAddress: "",
  oath: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/**
 * Gestor de codeudores **adicionales** (2º, 3º…), en estilo bento y con la MISMA
 * lógica del primer codeudor: cada uno se puede **ingresar tú mismo** o
 * **enviar un enlace independiente** (el codeudor completa datos, sube documentos
 * y valida su solvencia por su cuenta). Se distingue por `codebtorSlot` (1, 2…);
 * el enlace del inquilino también puede invitar a más codeudores. Reusa
 * `PartyInvitePanel` (enlace + OTP + documentos) y la validación de ingresos.
 * Aditivo: escribe en `draft.solidaryCoDebtors` + `codebtorConsentsList`.
 */
export function AdditionalCodebtorsManager({ contractId, max = 4 }: { contractId: string; max?: number }) {
  const [list, setList] = useState<PartyDraft[]>(() => getDraft(contractId)?.solidaryCoDebtors ?? []);
  const [addMode, setAddMode] = useState<null | "self" | "invite">(null);
  const [form, setForm] = useState<NewCodebtor>(EMPTY);
  const [error, setError] = useState("");

  const draft = getDraft(contractId);
  const rentReference = Number(draft?.property?.monthlyRentProposed ?? draft?.lease?.monthlyRent ?? 0);
  const inviterName = (draft?.landlord?.fullName || "").trim() || "El arrendador";
  const incomeNum = Number((form.income || "").replace(/[^\d]/g, "")) || 0;
  // Slot del próximo codeudor adicional (0 = principal; los adicionales van 1..N).
  const nextSlot = list.length + 1;

  function refresh() {
    setList(getDraft(contractId)?.solidaryCoDebtors ?? []);
  }

  function appendCodebtor(party: PartyDraft, selfEntered: boolean) {
    updateDraft(contractId, (d) =>
      appendAudit(
        {
          ...d,
          solidaryCoDebtors: [...(d.solidaryCoDebtors ?? []), party],
          codebtorConsentsList: [
            ...(d.codebtorConsentsList ?? []),
            // Si lo ingresó el dueño, las aceptaciones del titular quedan pendientes
            // (las hace al firmar). Si vino por enlace, ya las aceptó el titular.
            selfEntered
              ? { dataProcessingConsent: false, electronicSignatureConsent: false, solidaryObligationAcceptance: false }
              : { dataProcessingConsent: true, electronicSignatureConsent: true, solidaryObligationAcceptance: true },
          ],
        },
        "codebtor_data_saved",
        { additional: true },
      ),
    );
    setForm(EMPTY);
    setAddMode(null);
    refresh();
  }

  function addSelf() {
    setError("");
    const f = form;
    if (!f.fullName.trim() || !f.documentNumber.trim() || !f.city.trim() || !f.phone.trim()) {
      setError("Completa todos los datos del codeudor.");
      return;
    }
    if (!EMAIL_RE.test(f.email.trim())) {
      setError("El correo del codeudor no es válido.");
      return;
    }
    if (incomeNum <= 0) {
      setError("Indica el ingreso mensual del codeudor.");
      return;
    }
    if (rentReference > 0 && incomeNum < rentReference) {
      setError("El ingreso del codeudor es inferior al canon. Corrígelo para continuar.");
      return;
    }
    if (!f.oath) {
      setError("El codeudor debe aceptar la declaración para continuar.");
      return;
    }
    appendCodebtor(
      {
        fullName: f.fullName.trim(),
        documentType: f.documentType,
        documentNumber: f.documentNumber.trim(),
        city: f.city.trim(),
        email: f.email.trim().toLowerCase(),
        phone: f.phone.trim(),
        notificationAddress: "",
        truthfulnessOathAccepted: true,
        economicSupport: { monthlyIncome: incomeNum },
      },
      true,
    );
  }

  function remove(index: number) {
    updateDraft(contractId, (d) => ({
      ...d,
      solidaryCoDebtors: (d.solidaryCoDebtors ?? []).filter((_, i) => i !== index),
      codebtorConsentsList: (d.codebtorConsentsList ?? []).filter((_, i) => i !== index),
    }));
    refresh();
  }

  const canAddMore = list.length < max;
  const inputCls = "mt-1 w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#5646E5]";

  return (
    <section className="rounded-3xl border-2 border-[#5646E5]/20 bg-[#ECE9FB]/40 p-4">
      <h4 className="text-sm font-bold text-[#5646E5]">Codeudores adicionales (opcional)</h4>
      <p className="mt-1 text-xs text-slate-600">
        ¿Más de un codeudor? Agrégalos aquí. Cada uno puedes <strong>ingresarlo tú</strong> o <strong>enviarle su propio
        enlace</strong> (llena datos, sube documentos y valida su ingreso vs. el canon, como el primero). Cada uno firma y
        queda en el contrato.
      </p>

      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((c, i) => (
            <li key={`${c.documentNumber}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <strong className="text-[#17151F]">Codeudor {i + 2}:</strong> {c.fullName || "(por invitación)"}
                {c.documentNumber ? <span className="text-slate-500"> · {c.documentType} {c.documentNumber}</span> : null}
                {c.email ? <span className="text-slate-500"> · {c.email}</span> : null}
              </span>
              <button type="button" onClick={() => remove(i)} className="flex-none rounded-lg border-2 border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {addMode === null && canAddMore && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setAddMode("self"); setError(""); }} className="rounded-2xl border-2 border-dashed border-[#5646E5]/40 px-4 py-2.5 text-sm font-bold text-[#5646E5] transition hover:bg-[#ECE9FB]">
            + Ingresar otro codeudor yo
          </button>
          <button type="button" onClick={() => { setAddMode("invite"); setError(""); }} className="rounded-2xl border-2 border-dashed border-[#12B886]/50 px-4 py-2.5 text-sm font-bold text-[#0B7A55] transition hover:bg-[#12B886]/10">
            + Enviar enlace a otro codeudor
          </button>
        </div>
      )}

      {addMode === "invite" && (
        <div className="mt-3">
          <PartyInvitePanel
            contractDraftId={contractId}
            role="solidaryCoDebtor"
            roleLabel={`Codeudor ${nextSlot + 1}`}
            inviterName={inviterName}
            monthlyRent={rentReference}
            codebtorSlot={nextSlot}
            onImport={(p) => appendCodebtor(p, false)}
          />
          <button type="button" onClick={() => setAddMode(null)} className="mt-2 text-xs font-semibold text-slate-500 underline">Cancelar</button>
        </div>
      )}

      {addMode === "self" && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
            Nombre completo
            <input value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} className={inputCls} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Tipo de documento
            <select value={form.documentType} onChange={(e) => setForm((s) => ({ ...s, documentType: e.target.value }))} className={inputCls}>
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="NIT">NIT</option>
              <option value="PA">Pasaporte</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Número de documento
            <input value={form.documentNumber} onChange={(e) => setForm((s) => ({ ...s, documentNumber: e.target.value }))} className={inputCls} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Ciudad
            <input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} className={inputCls} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Correo
            <input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} className={inputCls} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Teléfono
            <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} className={inputCls} />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Ingreso mensual aproximado
            <input inputMode="numeric" value={form.income} onChange={(e) => setForm((s) => ({ ...s, income: e.target.value.replace(/[^\d]/g, "") }))} className={inputCls} placeholder="Ej. 3000000" />
          </label>
          <div className="sm:col-span-2">
            <IncomeSuggestion rentReference={rentReference} income={incomeNum} who="el codeudor" />
          </div>
          <label className="sm:col-span-2 flex cursor-pointer items-start gap-2.5 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-3 text-xs text-slate-700">
            <input type="checkbox" checked={form.oath} onChange={(e) => setForm((s) => ({ ...s, oath: e.target.checked }))} className="mt-0.5 h-5 w-5 flex-none accent-[#5646E5]" />
            <span>
              Declaro que cuento con la autorización del codeudor para ingresar sus datos (Ley 1581). Sus aceptaciones
              (juramento, firma electrónica y obligación solidaria) las hará el propio codeudor al firmar.
            </span>
          </label>
          {error && <p className="sm:col-span-2 text-xs font-medium text-rose-600">{error}</p>}
          <div className="sm:col-span-2 flex gap-2">
            <button type="button" onClick={addSelf} className="rounded-2xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105">
              Guardar codeudor
            </button>
            <button type="button" onClick={() => { setAddMode(null); setError(""); setForm(EMPTY); }} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!canAddMore && <p className="mt-2 text-[11px] text-slate-500">Máximo {max + 1} codeudores en total.</p>}
    </section>
  );
}
