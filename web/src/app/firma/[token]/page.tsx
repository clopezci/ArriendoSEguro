"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type TokenInfoOk = {
  success: true;
  signerName: string;
  signerEmail: string;
  partyType: string;
  contractId: string;
  contractVersionId: string;
  versionNumber: number;
  documentHash: string;
  pdfUrl: string | null;
  signatureStatus: string;
  tokenExpiresAt: string;
};

type TokenInfoErr = { success: false; errors: { field: string; message: string }[] };

export default function SignatureTokenPage() {
  const token = String(useParams<{ token: string }>().token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState<TokenInfoOk | null>(null);
  const [consentA, setConsentA] = useState(false);
  const [consentB, setConsentB] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/signatures/token-info?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as TokenInfoOk | TokenInfoErr;
        if (!res.ok || !data.success) {
          const msg = !data.success ? data.errors.map((e) => e.message).join(" | ") : "Enlace inválido.";
          setError(msg);
          setInfo(null);
          return;
        }
        setInfo(data);
      } catch {
        setError("No se pudo cargar la información de firma.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token]);

  async function onSign() {
    if (!consentA || !consentB) {
      setError("Debes aceptar ambas declaraciones para firmar.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/signatures/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          consentAccepted: true,
          electronicSignatureAccepted: true,
        }),
      });
      const data = (await res.json()) as
        | { success: true; contractStatus: string }
        | { success: false; errors: { field: string; message: string }[] };
      if (!res.ok || !data.success) {
        const msg = !data.success ? data.errors.map((e) => e.message).join(" | ") : "No se pudo completar la firma.";
        setError(msg);
        return;
      }
      setOkMsg(
        data.contractStatus === "signed"
          ? "Firma registrada. El contrato quedó completamente firmado."
          : "Firma registrada correctamente.",
      );
    } catch {
      setError("Error de red al completar la firma.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-slate-200">Cargando enlace de firma...</main>;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-slate-100">
      <h1 className="text-2xl font-bold">Firma electrónica del contrato</h1>
      {error && <p className="rounded border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {okMsg && <p className="rounded border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-200">{okMsg}</p>}
      {info && (
        <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <p><strong>Firmante:</strong> {info.signerName}</p>
          <p><strong>Correo:</strong> {info.signerEmail}</p>
          <p><strong>Rol:</strong> {info.partyType}</p>
          <p><strong>Contrato:</strong> {info.contractId}</p>
          <p><strong>Versión:</strong> {info.versionNumber}</p>
          <p><strong>Hash documental:</strong> {info.documentHash}</p>
          <p><strong>Expira:</strong> {new Date(info.tokenExpiresAt).toLocaleString("es-CO")}</p>
          <div className="flex flex-wrap gap-2">
            {info.pdfUrl && (
              <a
                href={info.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-violet-500 px-3 py-2 text-sm text-violet-200"
              >
                Ver o descargar PDF
              </a>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consentA} onChange={(e) => setConsentA(e.target.checked)} />
            <span>Declaro que he leído el contrato, entiendo su contenido y acepto firmarlo electrónicamente.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consentB} onChange={(e) => setConsentB(e.target.checked)} />
            <span>Acepto el uso de firma electrónica simple para este contrato.</span>
          </label>
          <button
            type="button"
            onClick={onSign}
            disabled={submitting}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
          >
            {submitting ? "Firmando..." : "Firmar electrónicamente"}
          </button>
        </section>
      )}
    </main>
  );
}

