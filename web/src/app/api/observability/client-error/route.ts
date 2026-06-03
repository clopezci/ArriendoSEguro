import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  ERROR_EVENTS_COLLECTION,
  errorFingerprint,
  maskPii,
} from "@/lib/observability/observability";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 12_000;

const schema = z.object({
  kind: z.enum(["error", "unhandledrejection"]).default("error"),
  message: z.string().trim().min(1).max(2000),
  source: z.string().trim().max(500).optional(),
  line: z.number().int().nonnegative().max(10_000_000).optional(),
  column: z.number().int().nonnegative().max(10_000_000).optional(),
  stack: z.string().max(4000).optional(),
  pageUrl: z.string().trim().max(600).optional(),
  appVersion: z.string().trim().max(60).optional(),
});

/**
 * Captura de errores del navegador (alternativa propia a Sentry). No requiere
 * auth (los errores ocurren antes de poder garantizar sesión), pero está
 * fuertemente limitada por IP y agrega por huella para no inflar Firestore.
 * Siempre responde 204 para no perturbar al cliente.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = await checkRateLimit(ip, RATE_LIMIT_RULES.clientError);
    if (!rate.ok) return new NextResponse(null, { status: 204 });

    const raw = await request.text().catch(() => "");
    if (!raw || raw.length > MAX_JSON_BYTES) return new NextResponse(null, { status: 204 });

    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return new NextResponse(null, { status: 204 });
    const data = parsed.data;

    const firestore = getAdminFirestore();
    if (!firestore) return new NextResponse(null, { status: 204 });

    const fingerprint = errorFingerprint({
      message: data.message,
      source: data.source,
      kind: data.kind,
    });
    const now = new Date().toISOString();
    const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

    const ref = firestore.collection(ERROR_EVENTS_COLLECTION).doc(fingerprint);
    const snap = await ref.get();

    const common = {
      fingerprint,
      kind: data.kind,
      message: maskPii(data.message, 2000),
      source: data.source ? maskPii(data.source, 500) : null,
      line: data.line ?? null,
      column: data.column ?? null,
      stack: data.stack ? maskPii(data.stack, 4000) : null,
      lastPageUrl: data.pageUrl ? maskPii(data.pageUrl, 600) : null,
      lastUserAgent: userAgent,
      appVersion: data.appVersion ?? null,
      lastSeenAt: now,
      lastSeenServer: FieldValue.serverTimestamp(),
      count: FieldValue.increment(1),
      resolved: snap.exists ? (snap.data()?.resolved ?? false) : false,
    };

    if (!snap.exists) {
      await ref.set({
        ...common,
        firstSeenAt: now,
        firstSeenServer: FieldValue.serverTimestamp(),
      });
    } else {
      await ref.set(common, { merge: true });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    // Nunca propagamos el fallo del logger al cliente.
    return new NextResponse(null, { status: 204 });
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
