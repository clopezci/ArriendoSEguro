"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Enlace de descarga del PDF del contrato **autenticado**. La ruta
 * `/api/contracts/pdf/[versionId]` exige ser parte del contrato, por lo que no
 * se puede usar un `<a href>` simple (no envía `Authorization`). Este botón hace
 * el `fetch` con las cabeceras de auth, recibe los bytes y los descarga.
 */
export function ContractPdfDownloadLink({
  contractVersionId,
  label = "PDF del contrato (versión actual)",
  className = "text-violet-700 underline disabled:opacity-50",
}: {
  contractVersionId: string | null;
  label?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (!user || !contractVersionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/pdf/${encodeURIComponent(contractVersionId)}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      if (!res.ok) {
        setError(res.status === 404 ? "Aún no has generado el PDF en vista previa." : "No se pudo descargar el PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato-${contractVersionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Error de red al descargar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void download()} disabled={busy || !user || !contractVersionId} className={className}>
        {busy ? "Descargando…" : label}
      </button>
      {error && <span className="ml-2 text-xs text-rose-700">{error}</span>}
    </>
  );
}
