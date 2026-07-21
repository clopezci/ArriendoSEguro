import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { recordErrorEvent } from "@/lib/observability/observability";
import { maybeSendErrorAlert } from "@/lib/observability/errorAlert";
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

    await recordErrorEvent(firestore, {
      kind: data.kind,
      message: data.message,
      source: data.source ?? null,
      line: data.line ?? null,
      column: data.column ?? null,
      stack: data.stack ?? null,
      pageUrl: data.pageUrl ?? null,
      userAgent: request.headers.get("user-agent"),
      appVersion: data.appVersion ?? null,
    });

    // Evalúa y, si corresponde (umbral + fuera de cooldown), avisa AL INSTANTE
    // por correo/Telegram. Best-effort: nunca perturba la respuesta al cliente.
    await maybeSendErrorAlert(firestore).catch(() => {});

    return new NextResponse(null, { status: 204 });
  } catch {
    // Nunca propagamos el fallo del logger al cliente.
    return new NextResponse(null, { status: 204 });
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
