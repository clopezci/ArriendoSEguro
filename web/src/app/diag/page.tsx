"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Diagnóstico REAL de bloqueo de recursos de autenticación (Google/Firebase).
 * Se ejecuta en el navegador y prueba, uno por uno, si cada recurso que el login
 * con Google necesita se puede cargar o está BLOQUEADO (por CSP o por una
 * extensión). Comparar el resultado en ventana normal vs incógnito prueba, sin
 * lugar a dudas, si una extensión está bloqueando.
 *
 * NOTA honesta: Chrome no permite que una web lea QUÉ extensión bloquea (privacidad
 * del navegador). Esta herramienta prueba QUÉ recurso está bloqueado y si hay un
 * bloqueador de contenido activo; el nombre exacto se ve en chrome://extensions.
 */

type Status = "pending" | "ok" | "blocked";
type Row = { name: string; url: string; needed: string; status: Status; detail: string };

const RESOURCES: { name: string; url: string; needed: string }[] = [
  { name: "gapi (apis.google.com)", url: "https://apis.google.com/js/api.js", needed: "El popup de Google lo carga para abrir la ventana." },
  { name: "Iframe de auth (firebaseapp.com)", url: "https://arriendoseguro-c5602.firebaseapp.com/__/auth/iframe.js", needed: "Firebase lo usa para recibir el resultado del login (popup y redirect)." },
  { name: "Cuentas de Google", url: "https://accounts.google.com/", needed: "Donde eliges tu cuenta y autorizas." },
  { name: "Identity Toolkit (Firebase Auth API)", url: "https://identitytoolkit.googleapis.com/", needed: "API que valida el token de sesión." },
  { name: "gstatic (Google)", url: "https://www.gstatic.com/firebasejs/ping", needed: "CDN de Google, referencia de control." },
];

/** Prueba con fetch no-cors: un recurso BLOQUEADO por extensión/red lanza
 *  "Failed to fetch"; uno accesible resuelve (aunque sea respuesta opaca). */
async function probe(url: string): Promise<{ status: Status; detail: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    await fetch(`${url}${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`, {
      mode: "no-cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { status: "ok", detail: "Cargó (accesible)." };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    // "TypeError: Failed to fetch" = bloqueado por extensión/red (ERR_BLOCKED_BY_CLIENT
    // se manifiesta así). "AbortError" = tardó demasiado (probable bloqueo).
    return { status: "blocked", detail: msg };
  }
}

/** Detecta si hay un bloqueador de contenido (adblock/privacidad) activo. */
function detectAdblockBait(): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement("div");
    bait.className = "ad-banner ads adsbox ad-placement pub_300x250 sponsored";
    bait.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:300px;height:250px;";
    bait.innerHTML = "&nbsp;";
    document.body.appendChild(bait);
    setTimeout(() => {
      const blocked =
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0 ||
        getComputedStyle(bait).display === "none";
      bait.remove();
      resolve(blocked);
    }, 150);
  });
}

export default function DiagPage() {
  const [rows, setRows] = useState<Row[]>(
    RESOURCES.map((r) => ({ ...r, status: "pending" as Status, detail: "…" })),
  );
  const [running, setRunning] = useState(false);
  const [adblock, setAdblock] = useState<boolean | null>(null);
  const [ua, setUa] = useState("");
  const [incognitoHint, setIncognitoHint] = useState("");

  const run = useCallback(async () => {
    setRunning(true);
    setRows(RESOURCES.map((r) => ({ ...r, status: "pending" as Status, detail: "probando…" })));
    setUa(typeof navigator !== "undefined" ? navigator.userAgent : "");
    setAdblock(await detectAdblockBait());
    // Heurística de incógnito (aprox): cuota de almacenamiento baja.
    try {
      const est = await (navigator.storage?.estimate?.() ?? Promise.resolve(null));
      if (est && typeof est.quota === "number") {
        setIncognitoHint(est.quota < 700_000_000 ? "posible incógnito/privado" : "ventana normal");
      }
    } catch {
      /* noop */
    }
    for (let i = 0; i < RESOURCES.length; i++) {
      const res = await probe(RESOURCES[i].url);
      setRows((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: res.status, detail: res.detail };
        return next;
      });
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const blockedCount = rows.filter((r) => r.status === "blocked").length;
  const done = rows.every((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 text-slate-900">
      <h1 className="text-2xl font-black">Diagnóstico de bloqueo — Google / Firebase</h1>
      <p className="mt-2 text-sm text-slate-600">
        Prueba en vivo, en ESTE navegador, qué recursos del login con Google se pueden cargar y cuáles están
        bloqueados. Ejecútalo en tu <strong>ventana normal</strong> y luego en <strong>incógnito</strong> y compara.
      </p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        className="mt-4 rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {running ? "Probando…" : "Volver a probar"}
      </button>

      <div className="mt-5 space-y-2">
        {rows.map((r) => (
          <div
            key={r.url}
            className={`rounded-xl border p-3 text-sm ${
              r.status === "blocked"
                ? "border-rose-300 bg-rose-50"
                : r.status === "ok"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{r.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-black ${
                  r.status === "blocked"
                    ? "bg-rose-600 text-white"
                    : r.status === "ok"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-300 text-slate-700"
                }`}
              >
                {r.status === "blocked" ? "BLOQUEADO" : r.status === "ok" ? "OK" : "…"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{r.needed}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
              {r.url} — {r.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border-2 border-slate-300 bg-white p-4 text-sm">
        <p className="font-black">Veredicto</p>
        {!done ? (
          <p className="mt-1 text-slate-600">Ejecutando pruebas…</p>
        ) : (
          <>
            <p className="mt-1">
              Recursos bloqueados: <strong className={blockedCount ? "text-rose-700" : "text-emerald-700"}>{blockedCount} de {rows.length}</strong>
            </p>
            <p className="mt-1">
              Bloqueador de contenido (adblock/privacidad) detectado:{" "}
              <strong className={adblock ? "text-rose-700" : "text-emerald-700"}>{adblock === null ? "…" : adblock ? "SÍ" : "no"}</strong>
            </p>
            {(blockedCount > 0 || adblock) && (
              <p className="mt-2 rounded-lg bg-rose-50 p-2 text-rose-800">
                Hay bloqueo activo en este navegador. Si en <strong>incógnito</strong> estos mismos salen <strong>OK</strong>,
                queda probado que una <strong>extensión</strong> (bloqueador/privacidad/antivirus) es la que impide el login
                — no el código del sitio. Revisa <span className="font-mono">chrome://extensions</span> y permite el sitio o
                desactívala.
              </p>
            )}
            {blockedCount === 0 && !adblock && (
              <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-800">
                Todo accesible: en este navegador no hay bloqueo. Google debería entrar sin problema.
              </p>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] text-slate-400">Contexto: {incognitoHint || "—"}</p>
        <p className="mt-1 break-all text-[11px] text-slate-400">UA: {ua}</p>
      </div>
    </div>
  );
}
