import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";
import { CONTRACT_SURVEYS_COLLECTION } from "@/lib/surveys/contract-surveys";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 8_000;

// Encuesta de satisfacción de 3 preguntas (lean startup) al terminar un contrato.
const schema = z.object({
  contractId: z.string().trim().max(200).optional(),
  easy: z.boolean(), // ¿Te pareció fácil?
  liked: z.boolean(), // ¿Te gustó?
  recommend: z.boolean(), // ¿Lo recomendarías?
});

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = await checkRateLimit(ip, RATE_LIMIT_RULES.reports);
    if (!rate.ok) {
      const { body, headers } = tooManyRequestsJson(rate.retryAfterSeconds);
      return NextResponse.json(body, { status: 429, headers });
    }

    const raw = await request.text().catch(() => "");
    if (raw.length > MAX_JSON_BYTES) {
      return NextResponse.json({ ok: false, error: "Solicitud demasiado grande" }, { status: 413 });
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }
    const parsed = schema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Validación", issues: parsed.error.flatten() }, { status: 422 });
    }
    const data = parsed.data;

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ ok: false, error: "Servidor no configurado." }, { status: 503 });
    }

    const authed = await getAuthenticatedUser(request).catch(() => null);

    const ref = firestore.collection(CONTRACT_SURVEYS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      contractId: data.contractId ?? null,
      easy: data.easy,
      liked: data.liked,
      recommend: data.recommend,
      respondentUid: authed?.uid ?? null,
      respondentEmail: authed?.email ?? null,
      createdAt: new Date().toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("contract_survey_submitted", {
      surveyId: ref.id,
      easy: data.easy,
      liked: data.liked,
      recommend: data.recommend,
    });

    return NextResponse.json({ ok: true, message: "¡Gracias por tu respuesta!" });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[/api/survey/contract]", err);
    return NextResponse.json({ ok: false, error: "No se pudo registrar la respuesta." }, { status: 500 });
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
