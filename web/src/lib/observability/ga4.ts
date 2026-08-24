import "server-only";
import { GoogleAuth } from "google-auth-library";

/**
 * Lectura de VISITAS desde Google Analytics 4 (Data API) para el reporte de
 * Telegram. Es 100% best-effort y "apagado por defecto": solo funciona si
 *
 *   1. `GA4_PROPERTY_ID` está definido (el ID numérico de la propiedad GA4, NO el
 *      "G-XXXX" de medición), y
 *   2. la cuenta de servicio de Firebase (`FIREBASE_SERVICE_ACCOUNT_KEY` / `_FILE`)
 *      fue agregada como usuario con rol "Lector" (Viewer) en esa propiedad GA4.
 *
 * Si algo falta o falla, devuelve `null` y el reporte muestra un aviso para
 * consultar las visitas directamente en GA4. Nunca lanza.
 */
export type Ga4Visits = {
  usersToday: number | null;
  usersYesterday: number | null;
  users7d: number | null;
  sessions7d: number | null;
  views7d: number | null;
};

function serviceAccountCredentials(): { client_email: string; private_key: string } | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (j.client_email && j.private_key) {
      // Por si la clave viene con saltos de línea escapados.
      return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
    }
  } catch {
    /* credencial no parseable → sin GA4 por API */
  }
  return null;
}

function metricValue(row: unknown, index: number): number | null {
  const mv = (row as { metricValues?: { value?: string }[] } | undefined)?.metricValues?.[index]?.value;
  const n = Number(mv);
  return Number.isFinite(n) ? n : null;
}

type Ga4Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };

/** Obtiene {propertyId, token} si GA4 está configurado; si no, null. No lanza. */
async function ga4Access(): Promise<{ propertyId: string; token: string } | null> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const creds = serviceAccountCredentials();
  if (!propertyId || !creds) return null;
  try {
    const auth = new GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
    if (!token) return null;
    return { propertyId, token };
  } catch {
    return null;
  }
}

/** runReport genérico; devuelve las filas (o null si falla). No lanza. */
async function ga4RunReport(propertyId: string, token: string, body: Record<string, unknown>): Promise<Ga4Row[] | null> {
  try {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rows?: Ga4Row[] };
    return data.rows ?? [];
  } catch {
    return null;
  }
}

export async function summarizeGa4Visits(): Promise<Ga4Visits | null> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const creds = serviceAccountCredentials();
  if (!propertyId || !creds) return null;
  try {
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
    if (!token) return null;

    // Un solo runReport con 3 rangos: hoy, ayer y últimos 7 días.
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          dateRanges: [
            { startDate: "today", endDate: "today" },
            { startDate: "yesterday", endDate: "yesterday" },
            { startDate: "7daysAgo", endDate: "today" },
          ],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[] };
    const rows = data.rows ?? [];
    // Con dateRanges, GA4 agrega una dimensión "dateRange" (dateRange_0/1/2).
    const byRange = (i: number) => rows.find((r) => r.dimensionValues?.[0]?.value === `date_range_${i}`) ?? rows[i];
    const today = byRange(0);
    const yest = byRange(1);
    const week = byRange(2);
    return {
      usersToday: metricValue(today, 0),
      usersYesterday: metricValue(yest, 0),
      users7d: metricValue(week, 0),
      sessions7d: metricValue(week, 1),
      views7d: metricValue(week, 2),
    };
  } catch {
    return null;
  }
}

export function ga4VisitsToText(v: Ga4Visits | null): string {
  if (!v) {
    return "👣 *Visitas (GA4):* consúltalas en Google Analytics. (Para verlas aquí: define `GA4_PROPERTY_ID` y da acceso de Lector a la cuenta de servicio en la propiedad GA4.)";
  }
  const n = (x: number | null) => (x === null ? "—" : x.toLocaleString("es-CO"));
  return [
    "👣 *Visitas (GA4)*",
    `Usuarios hoy: ${n(v.usersToday)} · ayer: ${n(v.usersYesterday)} · 7 días: ${n(v.users7d)}`,
    `Sesiones 7d: ${n(v.sessions7d)} · vistas de página 7d: ${n(v.views7d)}`,
  ].join("\n");
}

/**
 * Detalle de visitas para el PANEL /admin: serie por día (últimos 14) + desgloses
 * de valor (canal de adquisición, dispositivo y páginas más vistas). Best-effort:
 * cada consulta es independiente; si una falla, ese bloque va vacío.
 */
export type Ga4Daily = { date: string; users: number; newUsers: number; sessions: number; views: number };
export type Ga4Breakdown = { label: string; users: number; sessions: number };
export type Ga4TopPage = { path: string; views: number; users: number };
export type Ga4Detail = {
  configured: boolean;
  daily: Ga4Daily[];
  channels: Ga4Breakdown[];
  devices: Ga4Breakdown[];
  topPages: Ga4TopPage[];
};

/** "20260823" → "2026-08-23" (formato date de GA4). */
function ga4DateToIso(v: string): string {
  return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}

export async function summarizeGa4Detail(): Promise<Ga4Detail> {
  const empty: Ga4Detail = { configured: false, daily: [], channels: [], devices: [], topPages: [] };
  const access = await ga4Access();
  if (!access) return empty;
  const { propertyId, token } = access;

  const [dailyRows, channelRows, deviceRows, pageRows] = await Promise.all([
    ga4RunReport(propertyId, token, {
      dateRanges: [{ startDate: "14daysAgo", endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    ga4RunReport(propertyId, token, {
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 8,
    }),
    ga4RunReport(propertyId, token, {
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    }),
    ga4RunReport(propertyId, token, {
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
  ]);

  const daily: Ga4Daily[] = (dailyRows ?? []).map((r) => ({
    date: ga4DateToIso(r.dimensionValues?.[0]?.value ?? ""),
    users: metricValue(r, 0) ?? 0,
    newUsers: metricValue(r, 1) ?? 0,
    sessions: metricValue(r, 2) ?? 0,
    views: metricValue(r, 3) ?? 0,
  }));
  const channels: Ga4Breakdown[] = (channelRows ?? []).map((r) => ({
    label: r.dimensionValues?.[0]?.value ?? "—",
    users: metricValue(r, 0) ?? 0,
    sessions: metricValue(r, 1) ?? 0,
  }));
  const devices: Ga4Breakdown[] = (deviceRows ?? []).map((r) => ({
    label: r.dimensionValues?.[0]?.value ?? "—",
    users: metricValue(r, 0) ?? 0,
    sessions: metricValue(r, 1) ?? 0,
  }));
  const topPages: Ga4TopPage[] = (pageRows ?? []).map((r) => ({
    path: r.dimensionValues?.[0]?.value ?? "—",
    views: metricValue(r, 0) ?? 0,
    users: metricValue(r, 1) ?? 0,
  }));

  return { configured: true, daily, channels, devices, topPages };
}
