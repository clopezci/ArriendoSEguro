"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { appendAudit, updateDraft } from "@/features/contracts/wizard-state";
import {
  computeMaxUtilityGuaranteeCop,
  validateUtilityGuarantee,
  type UtilityServicesGuarantee,
} from "@/domain/contracts/utilityGuarantee";

function parseCop(v: string): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatCop(n: number): string {
  return n > 0 ? `$${n.toLocaleString("es-CO")}` : "—";
}

export function UtilityGuaranteeSection({
  contractId,
  initial,
}: {
  contractId: string;
  initial?: UtilityServicesGuarantee;
}) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(Boolean(initial?.enabled));
  const [p1, setP1] = useState(initial?.lastPeriod1Cop ? String(initial.lastPeriod1Cop) : "");
  const [p2, setP2] = useState(initial?.lastPeriod2Cop ? String(initial.lastPeriod2Cop) : "");
  const [agreed, setAgreed] = useState(initial?.agreedAmountCop ? String(initial.agreedAmountCop) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [acceptedAt, setAcceptedAt] = useState(initial?.acceptedAt ?? "");

  const maxAllowed = useMemo(() => computeMaxUtilityGuaranteeCop(parseCop(p1), parseCop(p2)), [p1, p2]);
  const agreedNum = parseCop(agreed);
  const exceeds = agreedNum > 0 && maxAllowed > 0 && agreedNum > maxAllowed;

  async function acceptGuarantee() {
    setMsg("");
    const check = validateUtilityGuarantee({
      lastPeriod1Cop: parseCop(p1),
      lastPeriod2Cop: parseCop(p2),
      agreedAmountCop: agreedNum,
    });
    if (!check.ok) {
      setMsg(check.error);
      return;
    }
    if (!user) {
      setMsg("Inicia sesión para registrar la garantía.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/contracts/utility-guarantee/accept", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          draftId: contractId,
          lastPeriod1Cop: parseCop(p1),
          lastPeriod2Cop: parseCop(p2),
          agreedAmountCop: agreedNum,
        }),
      });
      const data = (await res.json()) as { success?: boolean; acceptedAt?: string; errors?: { message?: string }[] };
      if (!res.ok || !data.success) {
        setMsg(data.errors?.[0]?.message ?? "No se pudo registrar la garantía.");
        return;
      }
      const guarantee: UtilityServicesGuarantee = {
        enabled: true,
        lastPeriod1Cop: parseCop(p1),
        lastPeriod2Cop: parseCop(p2),
        maxAllowedCop: check.maxAllowedCop,
        agreedAmountCop: agreedNum,
        acceptedAt: data.acceptedAt,
      };
      updateDraft(contractId, (d) => appendAudit({ ...d, utilityServicesGuarantee: guarantee }, "utility_guarantee_accepted"));
      setAcceptedAt(data.acceptedAt ?? "");
      setMsg("Garantía registrada con constancia (fecha e IP).");
    } catch {
      setMsg("Error de red al registrar la garantía.");
    } finally {
      setBusy(false);
    }
  }

  function toggleEnabled(next: boolean) {
    setEnabled(next);
    if (!next) {
      // Desactivar: limpiamos la garantía del expediente.
      updateDraft(contractId, (d) => appendAudit({ ...d, utilityServicesGuarantee: { ...(d.utilityServicesGuarantee ?? { enabled: false, lastPeriod1Cop: 0, lastPeriod2Cop: 0, maxAllowedCop: 0, agreedAmountCop: 0 }), enabled: false } }, "utility_guarantee_disabled"));
      setAcceptedAt("");
      setMsg("");
    }
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-violet-600"
          checked={enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
        />
        <span>
          <strong>Incluir garantía para servicios públicos</strong> (Art. 15, Ley 820 de 2003)
          <span className="mt-1 block text-xs text-slate-600">
            Es la <strong>única</strong> garantía permitida en vivienda urbana y es <strong>exclusiva para
            servicios públicos</strong> (no es el depósito general, que sí está prohibido). Su valor{" "}
            <strong>no puede superar</strong> la suma de los dos últimos períodos de facturación.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Última factura de servicios (COP)</span>
              <input
                inputMode="numeric"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                placeholder="Ej: 120000"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Penúltima factura de servicios (COP)</span>
              <input
                inputMode="numeric"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                placeholder="Ej: 100000"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </label>
          </div>

          <p className="rounded-lg border border-violet-200 bg-white p-2 text-sm text-slate-800">
            Máximo legal a pedir como garantía: <strong>{formatCop(maxAllowed)}</strong>{" "}
            <span className="text-xs text-slate-500">(suma de los dos períodos)</span>
          </p>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Valor pactado como garantía (COP)</span>
            <input
              inputMode="numeric"
              value={agreed}
              onChange={(e) => setAgreed(e.target.value)}
              placeholder="No mayor al máximo"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-slate-900 ${exceeds ? "border-rose-500" : "border-slate-300"}`}
            />
            {exceeds && (
              <span className="mt-1 block text-xs font-medium text-rose-700">
                Supera el máximo legal de {formatCop(maxAllowed)}.
              </span>
            )}
          </label>

          <button
            type="button"
            onClick={() => void acceptGuarantee()}
            disabled={busy || exceeds}
            className="min-h-11 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? "Registrando…" : acceptedAt ? "Actualizar garantía" : "Aceptar y registrar garantía"}
          </button>

          {acceptedAt && (
            <p className="text-xs text-emerald-700">
              Constancia registrada el {acceptedAt} con captura de IP. Es parte de las condiciones del expediente.
            </p>
          )}
          {msg && <p className="text-xs text-slate-700">{msg}</p>}

          <p className="text-xs text-slate-500">
            Marco legal: Art. 15 de la Ley 820 de 2003 (y Decreto 3130 de 2003). Ver{" "}
            <Link href="/blog/servicios-publicos-arriendo-evitar-deudas" className="text-violet-700 underline">
              guía de servicios públicos
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}
