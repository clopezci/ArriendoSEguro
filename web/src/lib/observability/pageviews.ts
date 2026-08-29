import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Contador de VISITAS propio, del lado del servidor y **sin cookies** (estilo
 * Plausible/Fathom). No guarda datos personales: solo agrega conteos por día y
 * un hash **salado y rotado por día** de (ip + user-agent) para no contar dos
 * veces al mismo visitante EN EL MISMO DÍA. Como el hash incluye la fecha, no es
 * enlazable entre días → no permite rastrear a una persona en el tiempo.
 *
 * A diferencia de GA4, NO depende del consentimiento de cookies (no usa cookies
 * ni almacena identificadores), así que da un número real de tráfico aunque el
 * visitante no acepte el banner. Se alimenta de un "beacon" que el navegador
 * envía en cada cambio de ruta.
 */
const COLLECTION = "analytics_pageviews"; // 1 doc por día: { date, views, visitors }
const VISITORS_SUB = "visitors"; // subdocs efímeros (hash) solo para deduplicar el día

/** Clave de día YYYY-MM-DD en America/Bogotá (UTC-5 fijo, sin horario de verano). */
export function bogotaDateKey(nowMs: number): string {
  return new Date(nowMs - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function visitorHash(ip: string, ua: string, dateKey: string): string {
  const salt = process.env.ANALYTICS_SALT?.trim() || "as_pv_salt_v1";
  return createHash("sha256").update(`${salt}|${dateKey}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

// Rutas que NO cuentan como "visita" de tráfico (panel interno, assets, API).
const IGNORE_PREFIXES = ["/api", "/_next", "/admin", "/icons", "/favicon", "/manifest"];
// Bots comunes que sí ejecutan JS: se descartan para no inflar el número.
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

export async function recordPageview(
  firestore: Firestore,
  params: { path: string; ip: string | null; ua: string | null; nowMs: number },
): Promise<void> {
  const path = (params.path || "/").split("?")[0].slice(0, 300);
  if (IGNORE_PREFIXES.some((p) => path.startsWith(p))) return;
  if (params.ua && BOT_UA.test(params.ua)) return;

  const dateKey = bogotaDateKey(params.nowMs);
  const dayRef = firestore.collection(COLLECTION).doc(dateKey);

  // Único por visitante/día: si el subdoc del hash se puede CREAR, es nuevo →
  // suma visitante; si ya existía, solo suma una vista.
  let isNewVisitor = false;
  if (params.ip || params.ua) {
    const h = visitorHash(params.ip ?? "", params.ua ?? "", dateKey);
    try {
      await dayRef.collection(VISITORS_SUB).doc(h).create({ at: new Date(params.nowMs).toISOString() });
      isNewVisitor = true;
    } catch {
      isNewVisitor = false; // ya existía → visitante repetido hoy
    }
  }

  await dayRef.set(
    {
      date: dateKey,
      views: FieldValue.increment(1),
      ...(isNewVisitor ? { visitors: FieldValue.increment(1) } : {}),
      updatedAt: new Date(params.nowMs).toISOString(),
    },
    { merge: true },
  );
}

export type OwnPageviews = {
  today: { views: number; visitors: number };
  last7d: { views: number; visitors: number };
  daily: { date: string; views: number; visitors: number }[];
};

/** Resumen de los últimos `days` días (para el tablero de KPIs). */
export async function summarizeOwnPageviews(firestore: Firestore, nowMs: number, days = 14): Promise<OwnPageviews> {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push(bogotaDateKey(nowMs - i * 24 * 60 * 60 * 1000));
  const snaps = await Promise.all(keys.map((k) => firestore.collection(COLLECTION).doc(k).get().catch(() => null)));
  const byKey = new Map<string, { views: number; visitors: number }>();
  snaps.forEach((s, i) => {
    const d = s && s.exists ? (s.data() as { views?: number; visitors?: number }) : null;
    byKey.set(keys[i], { views: Number(d?.views ?? 0), visitors: Number(d?.visitors ?? 0) });
  });
  const last7 = keys.slice(0, 7);
  const sum = (arr: string[], f: "views" | "visitors") => arr.reduce((a, k) => a + (byKey.get(k)?.[f] ?? 0), 0);
  const daily = keys
    .slice()
    .reverse()
    .map((k) => ({ date: k, views: byKey.get(k)?.views ?? 0, visitors: byKey.get(k)?.visitors ?? 0 }));
  return {
    today: byKey.get(keys[0]) ?? { views: 0, visitors: 0 },
    last7d: { views: sum(last7, "views"), visitors: sum(last7, "visitors") },
    daily,
  };
}

/**
 * Limpieza: los subdocs de hash solo sirven para deduplicar DENTRO de su día, así
 * que los de días pasados se pueden borrar (los agregados `views`/`visitors` del
 * doc del día quedan intactos). Acotado por corrida para no pasarse de cuota.
 */
export async function purgeOldVisitorHashes(
  firestore: Firestore,
  nowMs: number,
  keepDays = 3,
  maxDeletes = 3000,
): Promise<{ deleted: number; scannedDays: number }> {
  let deleted = 0;
  let scannedDays = 0;
  for (let i = keepDays; i < keepDays + 40 && deleted < maxDeletes; i++) {
    const key = bogotaDateKey(nowMs - i * 24 * 60 * 60 * 1000);
    const sub = firestore.collection(COLLECTION).doc(key).collection(VISITORS_SUB);
    const snap = await sub.limit(400).get().catch(() => null);
    scannedDays += 1;
    if (!snap || snap.empty) continue;
    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit().catch(() => {});
    deleted += snap.size;
  }
  return { deleted, scannedDays };
}
