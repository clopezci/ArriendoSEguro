"use client";

import { useState } from "react";
import {
  appendAudit,
  getDraft,
  updateDraft,
  type PartyDraft,
} from "@/features/contracts/wizard-state";

type NewCodebtor = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
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
  notificationAddress: "",
  oath: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/**
 * Gestor de codeudores **adicionales** (más allá del primero). Aditivo: no toca
 * el formulario del primer codeudor; escribe en `draft.solidaryCoDebtors` y sus
 * consentimientos en `codebtorConsentsList`. Cada uno firma como
 * `solidaryCoDebtor_2`, `_3`, … y aparece en el contrato.
 */
export function AdditionalCodebtorsManager({ contractId, max = 4 }: { contractId: string; max?: number }) {
  const [list, setList] = useState<PartyDraft[]>(() => getDraft(contractId)?.solidaryCoDebtors ?? []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewCodebtor>(EMPTY);
  const [error, setError] = useState("");

  function refresh() {
    setList(getDraft(contractId)?.solidaryCoDebtors ?? []);
  }

  function add() {
    setError("");
    const f = form;
    if (
      !f.fullName.trim() ||
      !f.documentNumber.trim() ||
      !f.city.trim() ||
      !f.phone.trim()
    ) {
      setError("Completa todos los datos del codeudor.");
      return;
    }
    if (!EMAIL_RE.test(f.email.trim())) {
      setError("El correo del codeudor no es válido.");
      return;
    }
    if (!f.oath) {
      setError("El codeudor debe aceptar la declaración para continuar.");
      return;
    }
    const party: PartyDraft = {
      fullName: f.fullName.trim(),
      documentType: f.documentType,
      documentNumber: f.documentNumber.trim(),
      city: f.city.trim(),
      email: f.email.trim().toLowerCase(),
      phone: f.phone.trim(),
      notificationAddress: "",
      truthfulnessOathAccepted: true,
    };
    updateDraft(contractId, (d) =>
      appendAudit(
        {
          ...d,
          solidaryCoDebtors: [...(d.solidaryCoDebtors ?? []), party],
          codebtorConsentsList: [
            ...(d.codebtorConsentsList ?? []),
            { dataProcessingConsent: true, electronicSignatureConsent: true, solidaryObligationAcceptance: true },
          ],
        },
        "codebtor_data_saved",
        { additional: true },
      ),
    );
    setForm(EMPTY);
    setAdding(false);
    refresh();
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

  return (
    <section className="sm:col-span-2 rounded-xl border border-violet-300 bg-white/95 p-4">
      <h4 className="text-sm font-semibold text-violet-800">Codeudores adicionales (opcional)</h4>
      <p className="mt-1 text-xs text-slate-600">
        Si necesitas más de un codeudor, agrégalos aquí. Cada uno firma el contrato y queda en el documento.
      </p>

      {list.length > 0 && (
        <ul className="mt-3 space-y-1">
          {list.map((c, i) => (
            <li
              key={`${c.documentNumber}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
            >
              <span className="min-w-0">
                <strong className="text-slate-800">Codeudor {i + 2}:</strong> {c.fullName}
                <span className="text-slate-500"> · {c.documentType} {c.documentNumber} · {c.email}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded border border-rose-400 px-2 py-0.5 text-rose-700"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label="Nombre completo" value={form.fullName} onChange={(v) => setForm((s) => ({ ...s, fullName: v }))} />
          <label className="text-xs text-slate-700">
            Tipo de documento
            <select
              value={form.documentType}
              onChange={(e) => setForm((s) => ({ ...s, documentType: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="NIT">NIT</option>
              <option value="PA">Pasaporte</option>
            </select>
          </label>
          <Field label="Número de documento" value={form.documentNumber} onChange={(v) => setForm((s) => ({ ...s, documentNumber: v }))} />
          <Field label="Ciudad" value={form.city} onChange={(v) => setForm((s) => ({ ...s, city: v }))} />
          <Field label="Correo" value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} />
          <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
          <label className="sm:col-span-2 flex items-start gap-2 text-xs text-slate-800">
            <input
              type="checkbox"
              checked={form.oath}
              onChange={(e) => setForm((s) => ({ ...s, oath: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-violet-500"
            />
            <span>
              Como codeudor, declaro que mis datos son verídicos, acepto el tratamiento de datos, la firma electrónica y
              la obligación solidaria dentro del contrato.
            </span>
          </label>
          {error && <p className="sm:col-span-2 text-xs text-rose-700">{error}</p>}
          <div className="sm:col-span-2 flex gap-2">
            <button type="button" onClick={add} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
              Guardar codeudor
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError("");
                setForm(EMPTY);
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        canAddMore && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 rounded-lg border border-violet-500 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
          >
            + Agregar otro codeudor
          </button>
        )
      )}
      {!canAddMore && <p className="mt-2 text-[11px] text-slate-500">Máximo {max + 1} codeudores en total.</p>}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs text-slate-700">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
      />
    </label>
  );
}
