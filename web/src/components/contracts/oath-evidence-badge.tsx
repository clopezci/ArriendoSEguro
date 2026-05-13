"use client";

/**
 * `OathEvidenceBadge` — Captura y muestra evidencia mínima del entorno en
 * el que una persona aceptó una declaración bajo gravedad de juramento o
 * una casilla de "Acepto…".
 *
 * Se usa SIEMPRE acompañando un check que activa una declaración. El
 * patrón típico es:
 *
 * ```tsx
 * <label>
 *   <input type="checkbox" checked={oath} onChange={...} />
 *   <span>Bajo gravedad de juramento…</span>
 * </label>
 * <OathEvidenceBadge
 *   active={oath}
 *   oathId="property_ownership_oath"
 *   contractDraftId={id}
 * />
 * ```
 *
 * Mientras el check está marcado, el componente:
 *  1. Captura `userAgent`, `language`, `timeZone`, `screen` y la fecha/hora
 *     local del navegador.
 *  2. Hace `POST /api/oath-evidence/capture` para que el servidor reporte
 *     IP, país y ciudad (cuando el CDN/proxy los exponga) y devuelva la
 *     hora del servidor.
 *  3. (Opcional) intenta obtener `navigator.geolocation` si la persona lo
 *     concede; nunca se solicita de forma agresiva.
 *  4. Renderiza un cuadro informativo bajo el check con los datos que
 *     quedan en el expediente.
 *
 * Estos datos son evidencia razonable, no prueba forense. Se complementan
 * con el flujo de firma electrónica (OTP por email, hash documental, etc.)
 * y con la auditoría server-side de Firestore.
 */

import { useEffect, useState } from "react";

type EvidenceState = {
  oathId: string;
  serverIp: string;
  serverCountry: string;
  serverRegion: string;
  serverCity: string;
  serverNow: string;
  clientNow: string;
  userAgent: string;
  language: string;
  timeZone: string;
  screen: string;
  coords?: { latitude: number; longitude: number; accuracyMeters: number };
};

export function OathEvidenceBadge({
  active,
  oathId,
  contractDraftId,
  className,
}: {
  /** Cuando es `true`, el componente captura y renderiza la evidencia. */
  active: boolean;
  /** Identificador del juramento (sirve para diferenciar en auditoría). */
  oathId: string;
  /** Borrador asociado, para correlacionar evidencia con expediente. */
  contractDraftId?: string;
  className?: string;
}) {
  const [evidence, setEvidence] = useState<EvidenceState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cuando el check se desmarca limpiamos la evidencia para que no quede
    // un cuadro confuso debajo de un check vacío.
    if (!active) {
      setEvidence(null);
      setError(null);
      return;
    }
    if (evidence) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const clientNow = new Date().toISOString();
    const userAgent = window.navigator?.userAgent ?? "";
    const language = window.navigator?.language ?? "";
    let timeZone = "";
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      timeZone = "";
    }
    const screen =
      window.screen?.width && window.screen?.height
        ? `${window.screen.width}x${window.screen.height}`
        : "";

    (async () => {
      try {
        const res = await fetch("/api/oath-evidence/capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ oathId, contractDraftId }),
        });
        const data = (await res.json()) as
          | {
              success: true;
              evidence: {
                oathId: string;
                ip: string;
                country: string;
                region: string;
                city: string;
                serverNow: string;
              };
            }
          | { success: false; errors?: { message: string }[] };
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError("No se pudo registrar la evidencia automáticamente.");
          setEvidence({
            oathId,
            serverIp: "",
            serverCountry: "",
            serverRegion: "",
            serverCity: "",
            serverNow: clientNow,
            clientNow,
            userAgent,
            language,
            timeZone,
            screen,
          });
          return;
        }
        setEvidence({
          oathId,
          serverIp: data.evidence.ip,
          serverCountry: data.evidence.country,
          serverRegion: data.evidence.region,
          serverCity: data.evidence.city,
          serverNow: data.evidence.serverNow,
          clientNow,
          userAgent,
          language,
          timeZone,
          screen,
        });
      } catch {
        if (cancelled) return;
        // Si el endpoint falla por completo, mostramos al menos los datos
        // del cliente. Mejor algo que nada como evidencia visible.
        setError("No pudimos contactar al servidor para capturar la evidencia completa.");
        setEvidence({
          oathId,
          serverIp: "",
          serverCountry: "",
          serverRegion: "",
          serverCity: "",
          serverNow: clientNow,
          clientNow,
          userAgent,
          language,
          timeZone,
          screen,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, oathId, contractDraftId, evidence]);

  if (!active) return null;
  if (loading && !evidence) {
    return (
      <p className={`mt-2 text-[11px] text-slate-500 ${className ?? ""}`}>
        Registrando la evidencia de tu aceptación…
      </p>
    );
  }
  if (!evidence) return null;

  return (
    <div
      className={`mt-2 rounded-md border border-slate-300 bg-white/95 p-2 text-[11px] leading-snug text-slate-700 ${className ?? ""}`}
    >
      <p className="font-semibold text-slate-900">Evidencia de aceptación</p>
      <p className="text-slate-600">
        Estos datos quedan en el expediente como soporte de quién y desde
        dónde aceptaste esta declaración.
      </p>
      <ul className="mt-1 space-y-0.5">
        <li>
          <strong>Fecha y hora (servidor):</strong>{" "}
          {new Date(evidence.serverNow).toLocaleString("es-CO")}
        </li>
        <li>
          <strong>Fecha y hora (tu equipo):</strong>{" "}
          {new Date(evidence.clientNow).toLocaleString("es-CO")}
        </li>
        {evidence.serverIp && (
          <li>
            <strong>IP detectada:</strong> {evidence.serverIp}
          </li>
        )}
        {(evidence.serverCity || evidence.serverCountry) && (
          <li>
            <strong>Ubicación aproximada:</strong>{" "}
            {[evidence.serverCity, evidence.serverRegion, evidence.serverCountry]
              .filter(Boolean)
              .join(", ")}
          </li>
        )}
        {evidence.timeZone && (
          <li>
            <strong>Zona horaria:</strong> {evidence.timeZone}
          </li>
        )}
        {evidence.language && (
          <li>
            <strong>Idioma del navegador:</strong> {evidence.language}
          </li>
        )}
        {evidence.userAgent && (
          <li>
            <strong>Dispositivo / navegador:</strong>{" "}
            <span className="break-all">{evidence.userAgent}</span>
          </li>
        )}
        {evidence.screen && (
          <li>
            <strong>Pantalla:</strong> {evidence.screen}
          </li>
        )}
      </ul>
      {error && (
        <p className="mt-1 text-[11px] text-amber-700">
          {error} Si necesitas más detalle, comunícate con soporte y citaremos
          el evento de auditoría asociado.
        </p>
      )}
    </div>
  );
}
