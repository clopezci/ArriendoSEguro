import { NextResponse } from "next/server";
import { z } from "zod";
import { chatWithFallback, hasAnyAiProvider } from "@/lib/ai/providerChain";
import { withLegalDisclaimer } from "@/lib/ai/legalDisclaimer";

export const runtime = "nodejs";

/**
 * Asistente IA (opcional) del flujo nuevo. Usa la CADENA de proveedores con
 * respaldo/escalamiento (`chatWithFallback`): Groq (gratis) → Gemini (gratis) →
 * OpenAI (pago). Ver `web/src/lib/ai/providerChain.ts` para las variables.
 * Dos modos:
 *   - "extract": de texto libre saca los datos del contrato (JSON) para
 *     pre-llenar. El usuario SIEMPRE revisa y la validación por paso sigue viva.
 *   - "ask": explica en lenguaje simple una duda del arriendo/cláusula.
 * NUNCA se usa para lógica legal crítica; solo asiste.
 */
const schema = z.object({
  mode: z.enum(["extract", "ask"]),
  text: z.string().min(1).max(2000),
  // Contexto del PASO actual del asistente (para que "ask" sepa dónde está el
  // usuario y pueda responder "qué hacer aquí"). Lo envía el cliente.
  context: z.string().max(600).optional(),
});

const EXTRACT_SYSTEM =
  "Eres un asistente que extrae datos para un contrato de arrendamiento de vivienda en Colombia. " +
  "Responde ÚNICAMENTE con un objeto JSON PLANO (todas las claves al MISMO nivel, NO uses objetos anidados) " +
  "que contenga EXACTAMENTE estas claves. Usa cadena vacía \"\" si el dato no se menciona; NO inventes. " +
  "Claves (en este orden): " +
  "name, docType, docNumber, phone, email, ownerCity, " +
  "address, city, department, canon, " +
  "tenantName, tenantDocType, tenantDocNumber, tenantCity, tenantEmail, tenantPhone, tenantIncome, " +
  "hasCodebtor, codebtorName, codebtorDocType, codebtorDocNumber, codebtorCity, codebtorEmail, codebtorPhone, codebtorIncome, " +
  "specialClause. " +
  "specialClause = si la persona describe una CLÁUSULA ESPECIAL o acuerdo adicional que quiere en el contrato (p. ej. " +
  "'no se permiten mascotas', 'prohibido subarrendar', 'no fiestas después de las 10 pm'), copia ese texto tal cual; " +
  "cadena vacía \"\" si no menciona ninguna. NO inventes cláusulas. " +
  "Significado: las claves SIN prefijo (name, docType, docNumber, phone, email, ownerCity) son del ARRENDADOR (dueño). " +
  "address/city/department/canon son del INMUEBLE. Las claves con prefijo tenant* son del ARRENDATARIO (inquilino) y " +
  "codebtor* del CODEUDOR. Asigna cada dato a la persona correcta según a quién se refiera el texto. " +
  "Reglas de formato: docType, tenantDocType y codebtorDocType deben ser uno de CC, CE, NIT, Pasaporte; " +
  "phone/tenantPhone/codebtorPhone a 10 dígitos; canon/tenantIncome/codebtorIncome solo números (sin puntos ni símbolos); " +
  "hasCodebtor = 'yes' si mencionan codeudor con datos, 'no' si dicen que no hay, '' si no se sabe. " +
  "Ejemplo de forma esperada (valores ilustrativos): " +
  '{"name":"Carlos Perez","docType":"CC","docNumber":"71217228","phone":"3001234567","email":"c@x.com","ownerCity":"Medellin",' +
  '"address":"Calle 34 60-26","city":"Medellin","department":"Antioquia","canon":"1500000",' +
  '"tenantName":"Ana Ruiz","tenantDocType":"CC","tenantDocNumber":"43262933","tenantCity":"Medellin","tenantEmail":"a@x.com","tenantPhone":"3015551234","tenantIncome":"4000000",' +
  '"hasCodebtor":"yes","codebtorName":"Luis Gomez","codebtorDocType":"CC","codebtorDocNumber":"123456789","codebtorCity":"Bello","codebtorEmail":"l@x.com","codebtorPhone":"3020001111","codebtorIncome":"6000000"}';

const ASK_SYSTEM =
  "Eres el asistente de ArriendoSeguro, una aplicación colombiana para que dos personas (dueño e inquilino) creen, " +
  "firmen y administren un contrato de arrendamiento de vivienda urbana (Ley 820 de 2003) sin inmobiliaria. " +
  "Conoces su funcionamiento y respondes dudas de la persona que está usando la app, SIEMPRE en el contexto de ArriendoSeguro. " +
  "Cómo funciona la app: (1) el dueño llena los datos paso a paso (una pregunta a la vez); puede llenar los datos del " +
  "inquilino y del codeudor él mismo, o enviarles un enlace por correo o WhatsApp para que cada uno complete sus datos, " +
  "acepte el juramento y la autorización de datos (Ley 1581) y suba documentos (cédula, carta laboral, colillas). " +
  "(2) Se valida la solvencia: el ingreso del inquilino/codeudor no puede ser menor al canon (se bloquea), se sugiere 2x. " +
  "(3) Se valida el tope legal del canon (1% del valor comercial, Ley 820). (4) Al final se genera el contrato, se firma " +
  "electrónicamente (Ley 527 de 1999) y en la posventa se hace el inventario y acta de entrega, se registran pagos con " +
  "recordatorios, y se descarga el paquete de evidencia. Planes: hay un precio de introducción por contrato e invitar " +
  "personas que usen la app da beneficios. " +
  "Reglas de tu respuesta: español claro y breve (máximo 3 frases), sin jerga legal innecesaria. Si la duda es sobre un " +
  "paso o botón de la app, explica QUÉ hacer dentro de ArriendoSeguro. Si preguntan por una cláusula o término legal, " +
  "explícalo simple y aterrízalo al arriendo. Si la pregunta NO tiene relación con arrendar o con la app, responde " +
  "amablemente que solo puedes ayudar con el arriendo y ArriendoSeguro. No des asesoría legal definitiva; sugiere validar " +
  "con un abogado cuando el caso sea delicado. " +
  "IMPORTANTE: cuando el mensaje del usuario incluya una línea 'PASO ACTUAL:', ese es el paso exacto de la app en el que " +
  "está la persona en este momento; úsalo para responder concretamente QUÉ debe hacer o escribir en ESE paso. NUNCA digas " +
  "que no sabes en qué paso está: siempre tienes el paso actual en el contexto.";

/** Extrae el bloque JSON de la respuesta (quita ```fences``` y texto alrededor). */
function extractJsonBlock(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

export async function POST(request: Request) {
  // Asistente de PRE-llenado / ayuda: aparece en la primera pantalla de /nuevo,
  // ANTES de registrarse. Por eso NO exige sesión: no lee ni escribe datos del
  // usuario; solo envía a la IA el texto que la propia persona escribe. (El
  // tamaño del texto está acotado por el schema para limitar el costo.)
  if (!hasAnyAiProvider()) {
    // No configurado: el cliente muestra una nota, sin romper el flujo.
    return NextResponse.json({ success: true, available: false });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });
  }

  const isExtract = parsed.data.mode === "extract";

  // Criterio de aceptación por modo: si un proveedor no lo cumple, la cadena
  // ESCALA al siguiente (Groq → Gemini → OpenAI) buscando el mejor resultado.
  //  - extract: el JSON debe parsear y traer AL MENOS un dato no vacío.
  //  - ask: respuesta no vacía (el default de la cadena ya lo garantiza).
  const accept = isExtract
    ? (content: string) => {
        try {
          const obj = JSON.parse(extractJsonBlock(content)) as Record<string, unknown>;
          return (
            obj != null &&
            typeof obj === "object" &&
            Object.values(obj).some((v) => typeof v === "string" && v.trim() !== "")
          );
        } catch {
          return false;
        }
      }
    : undefined;

  const result = await chatWithFallback({
    jsonMode: isExtract,
    temperature: isExtract ? 0 : 0.4,
    maxTokens: isExtract ? 1024 : 220,
    accept,
    messages: [
      { role: "system", content: isExtract ? EXTRACT_SYSTEM : ASK_SYSTEM },
      {
        role: "user",
        content:
          !isExtract && parsed.data.context
            ? `PASO ACTUAL: ${parsed.data.context}\n\nPregunta del usuario: ${parsed.data.text}`
            : parsed.data.text,
      },
    ],
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, available: true, error: "provider_error", detail: result.detail },
      { status: 502 },
    );
  }

  if (isExtract) {
    // `accept` ya garantizó que parsea; re-parseamos para responder el objeto.
    const data = JSON.parse(extractJsonBlock(result.content)) as Record<string, unknown>;
    return NextResponse.json({ success: true, available: true, data, provider: result.providerId });
  }
  // Cierre legal obligatorio: la respuesta puede tocar cláusulas/temas de la Ley 820.
  return NextResponse.json({ success: true, available: true, answer: withLegalDisclaimer(result.content, ["Ley 820 de 2003"]), provider: result.providerId });
}
