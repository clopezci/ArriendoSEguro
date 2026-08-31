import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieveLegalContext, type LegalEntry } from "@/domain/legal/legalKnowledgeBase";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";
import { chatWithFallback, hasAnyAiProvider } from "@/lib/ai/providerChain";
import { legalAiDisclaimer } from "@/lib/ai/legalDisclaimer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Pregúntale a la IA sobre tu arriendo": responde con RESPALDO NORMATIVO.
 * Recupera de la base de conocimiento (Ley 820, Código Civil, Ley 527, Ley 1581,
 * Decreto 1074) las normas relevantes y le pide a la IA responder SOLO con base
 * en ese contexto, citando la fuente. Si no está en la base, lo dice y sugiere un
 * abogado. Nunca inventa. Es orientativo, no asesoría jurídica.
 */
const schema = z.object({ question: z.string().trim().min(5).max(600) });

function sources(entries: LegalEntry[]) {
  return entries.map((e) => ({ law: e.law, ref: e.ref, title: e.title, url: e.url }));
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.clientError);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Escribe una pregunta (mínimo 5 caracteres)." }, { status: 422 });
  }
  const question = parsed.data.question;

  const entries = retrieveLegalContext(question, 6);
  if (entries.length === 0) {
    return NextResponse.json({
      success: true,
      answer:
        "No encontré una norma en mi base que responda directamente esa pregunta. Puedo ayudarte con temas de arrendamiento de vivienda (Ley 820), arrendamiento y propiedad en el Código Civil, firma electrónica (Ley 527) y protección de datos (Ley 1581). Reformula tu pregunta o consulta a un abogado.",
      sources: [],
      disclaimer: legalAiDisclaimer(),
    });
  }

  // Cierre legal citando LAS LEYES efectivamente usadas como respaldo.
  const disclaimer = legalAiDisclaimer(Array.from(new Set(entries.map((e) => e.law))));

  const context = entries
    .map((e, i) => `[${i + 1}] ${e.law}, ${e.ref} — ${e.title}\n${e.summary}\nFuente: ${e.url}`)
    .join("\n\n");

  if (!hasAnyAiProvider()) {
    // Sin IA: devolvemos los resúmenes de las normas relevantes (siguen siendo útiles y verificables).
    return NextResponse.json({
      success: true,
      answer:
        "Estas son las normas relevantes a tu pregunta:\n\n" +
        entries.map((e) => `• ${e.law}, ${e.ref} — ${e.title}: ${e.summary}`).join("\n\n"),
      sources: sources(entries),
      disclaimer,
    });
  }

  const system =
    "Eres un asistente legal para Colombia especializado en arrendamiento y propiedad raíz. " +
    "Responde ÚNICAMENTE con base en el CONTEXTO normativo entregado. Si la respuesta no está en el contexto, dilo " +
    "claramente y sugiere consultar a un abogado; NO inventes normas, artículos ni cifras. Cita SIEMPRE la norma y el " +
    "artículo entre paréntesis (por ejemplo, «(Ley 820 de 2003, Art. 18)»). Responde en español, claro y breve, " +
    "orientado a una persona sin formación jurídica. No des consejos que excedan lo que dice el contexto.";
  const prompt =
    `CONTEXTO NORMATIVO:\n${context}\n\n` +
    `PREGUNTA DEL USUARIO:\n${question}\n\n` +
    "Responde citando los artículos pertinentes del contexto. Si el contexto no alcanza, dilo.";

  const result = await chatWithFallback({
    temperature: 0.2,
    maxTokens: 700,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  });
  if (result.ok && result.content.trim()) {
    return NextResponse.json({ success: true, answer: result.content.trim(), sources: sources(entries), disclaimer });
  }

  // La IA no respondió: devolvemos los resúmenes de la base (verificables).
  return NextResponse.json({
    success: true,
    answer:
      "En este momento no pude generar la respuesta con IA, pero estas son las normas relevantes:\n\n" +
      entries.map((e) => `• ${e.law}, ${e.ref} — ${e.title}: ${e.summary}`).join("\n\n"),
    sources: sources(entries),
    disclaimer,
  });
}
