"use client";

/**
 * Log de diagnóstico del flujo /nuevo (sobre todo el acceso con Google). Se
 * guarda en sessionStorage para SOBREVIVIR al redirect de Google (que recarga la
 * página) y así ver la secuencia completa: popup/redirect, onRegistered, resume,
 * y cada cambio de `mode` (para pillar quién manda a "home").
 *
 * Se activa con `/nuevo?debug=1` (queda pegado en sessionStorage hasta limpiar).
 * El panel visible vive en <NuevoDebugPanel/>.
 */

const LOG_KEY = "nuevo_debug_log";
const FLAG_KEY = "nuevo_debug";
const MAX = 80;

export type DebugEntry = { t: string; ev: string; data?: unknown };

function ss(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Activa el debug si la URL trae ?debug=1 (persistente en la sesión del navegador). */
export function initDebugFromUrl(): void {
  const s = ss();
  if (!s) return;
  try {
    const on = new URLSearchParams(window.location.search).get("debug") === "1";
    if (on) s.setItem(FLAG_KEY, "1");
  } catch {
    /* noop */
  }
}

export function isDebugOn(): boolean {
  const s = ss();
  if (!s) return false;
  try {
    return s.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function logDebug(ev: string, data?: unknown): void {
  const s = ss();
  if (!s) return;
  try {
    // Diagnóstico SOLO cuando está activo (?debug=1). En operación normal es un
    // no-op total: ni consola ni sessionStorage (nada de ruido para el usuario).
    if (s.getItem(FLAG_KEY) !== "1") return;
    // eslint-disable-next-line no-console
    console.log(`[nuevo] ${ev}`, data ?? "");
    const now = new Date();
    const t = `${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    const arr = getDebugLog();
    arr.push({ t, ev, data });
    s.setItem(LOG_KEY, JSON.stringify(arr.slice(-MAX)));
  } catch {
    /* noop */
  }
}

export function getDebugLog(): DebugEntry[] {
  const s = ss();
  if (!s) return [];
  try {
    const raw = s.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as DebugEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearDebugLog(): void {
  const s = ss();
  if (!s) return;
  try {
    s.removeItem(LOG_KEY);
  } catch {
    /* noop */
  }
}
