"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Cert = { token: string; createdAt: string; expiresAt: string; revoked: boolean; viewCount: number };

function certUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/reputacion/certificado/${token}`;
}

/**
 * Sección "Compartir mi reputación": el titular genera un certificado de SU
 * propia reputación (enlace + QR) para mostrarlo a otro usuario de la app.
 * Caduca a los 7 días y es revocable. Nunca es público: abrirlo exige sesión.
 */
export function CertificateShare() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/reputation/certificate", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; certificates?: Cert[] };
      if (res.ok && j.success) setCerts(j.certificates ?? []);
    } catch {
      /* no-op */
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!user) return;
    setBusy(true);
    setMsg("");
    setQr("");
    try {
      const res = await fetch("/api/reputation/certificate", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
      });
      const j = (await res.json()) as { success?: boolean; token?: string; errors?: { message?: string }[] };
      if (!res.ok || !j.success || !j.token) {
        setMsg(j.errors?.[0]?.message ?? "No se pudo generar el certificado.");
        return;
      }
      setNewToken(j.token);
      const url = certUrl(j.token);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* copia manual */
      }
      try {
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 220 }));
      } catch {
        setQr("");
      }
      setMsg("Enlace generado y copiado. Solo lo verán usuarios de ArriendoSeguro con sesión.");
      await load();
    } catch {
      setMsg("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: string) {
    if (!user) return;
    try {
      const res = await fetch("/api/reputation/certificate/revoke", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        if (token === newToken) {
          setNewToken("");
          setQr("");
        }
        await load();
      }
    } catch {
      /* no-op */
    }
  }

  const active = certs.filter((c) => !c.revoked && Date.parse(c.expiresAt) > Date.now());

  return (
    <section className="rounded-2xl border border-slate-300 bg-white/95 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Compartir mi reputación</h2>
      <p className="mt-1 text-xs text-slate-600">
        Genera un enlace de <strong>tu propia</strong> reputación para mostrárselo a un arrendador u otra persona.
        Caduca a los <strong>7 días</strong>, puedes revocarlo cuando quieras y <strong>solo lo abren usuarios de
        ArriendoSeguro con sesión</strong> (no es público ni se consulta por cédula).
      </p>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        className="mt-3 min-h-11 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {busy ? "Generando…" : "Generar enlace / QR"}
      </button>
      {msg && <p className="mt-2 text-xs text-slate-700">{msg}</p>}

      {newToken && (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
          <p className="break-all font-mono text-[11px] text-slate-700">{certUrl(newToken)}</p>
          {qr && (
            <div className="mt-2 flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR del certificado de reputación" className="h-40 w-40" />
              <a href={qr} download="certificado-reputacion.png" className="text-[11px] font-medium text-violet-700 underline">
                Descargar QR
              </a>
            </div>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600">Enlaces activos</p>
          <ul className="mt-1 space-y-1">
            {active.map((c) => (
              <li key={c.token} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                <span>
                  Vence {new Date(c.expiresAt).toLocaleDateString("es-CO")} · {c.viewCount} vista(s)
                </span>
                <button type="button" onClick={() => void revoke(c.token)} className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50">
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
