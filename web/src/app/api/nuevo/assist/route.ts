import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Asistente IA (opcional) del flujo nuevo. Provider-agnóstico: usa cualquier API
 * compatible con OpenAI (Groq gratis, HuggingFace router, OpenAI, Together…) vía
 * variables de entorno:
 *   - AI_API_KEY   (obligatoria para activarlo; sin ella, `available:false`)
 *   - AI_BASE_URL  (por defecto Groq: https://api.groq.com/openai/v1)
 *   - AI_MODEL     (por defecto llama-3.1-8b-instant)
 * Dos modos:
 *   - "extract": de texto libre saca los datos del contrato (JSON) para
 *     pre-llenar. El usuario SIEMPRE revisa y la validación por paso sigue viva.
 *   - "ask": explica en lenguaje simple una duda del arriendo/cláusula.
 * NUNCA se usa para lógica legal crítica; solo asiste.
 */
const schema = z.object({ mode: z.enum(["extract", "ask"]), text: z.string().min(1).max(2000) });

const EXTRACT_SYSTEM =
  "Eres un asistente que extrae datos para un contrato de arrendamiento de vivienda en Colombia. " +
  "Responde ÚNICAMENTE con un objeto JSON PLANO (todas las claves al MISMO nivel, NO uses objetos anidados) " +
  "que contenga EXACTAMENTE estas claves. Usa cadena vacía \"\" si el dato no se menciona; NO inventes. " +
  "Claves (en este orden): " +
  "name, docType, docNumber, phone, email, ownerCity, " +
  "address, city, department, canon, " +
  "tenantName, tenantDocType, tenantDocNumber, tenantCity, tenantEmail, tenantPhone, tenantIncome, " +
  "hasCodebtor, codebtorName, codebtorDocType, codebtorDocNumber, codebtorCity, codebtorEmail, codebtorPhone, codebtorIncome. " +
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
  "con un abogado cuando el caso sea delicado.";

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
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    // No configurado: el cliente muestra una nota, sin romper el flujo.
    return NextResponse.json({ success: true, available: false });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });
  }

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const isExtract = parsed.data.mode === "extract";
  // Intenta el modelo configurado y, si falla por modelo, cae a alternativos
  // estables de Groq. Maximiza que "siempre funcione" sin cambiar de proveedor.
  // Para EXTRAER, priorizamos el modelo grande (mejor adherencia al JSON pedido).
  const candidates = [
    ...new Set(
      ((isExtract
        ? ["llama-3.3-70b-versatile", process.env.AI_MODEL?.trim(), "llama-3.1-8b-instant"]
        : [process.env.AI_MODEL?.trim(), "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
      ).filter(Boolean)) as string[],
    ),
  ];

  let lastDetail = "sin respuesta del proveedor";
  for (const model of candidates) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        body: JSON.stringify({
          model,
          temperature: isExtract ? 0 : 0.4,
          max_tokens: isExtract ? 1024 : 220,
          // Modo JSON: obliga al modelo a devolver un objeto JSON válido (evita
          // prosa/truncados que antes rompían el parseo y dejaban todo vacío).
          ...(isExtract ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: isExtract ? EXTRACT_SYSTEM : ASK_SYSTEM },
            { role: "user", content: parsed.data.text },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastDetail = `HTTP ${res.status} (${model}): ${body.slice(0, 180)}`;
        if (res.status === 401 || res.status === 403) break; // key inválida: no reintentar
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      if (isExtract) {
        try {
          const data = JSON.parse(extractJsonBlock(content)) as Record<string, unknown>;
          return NextResponse.json({ success: true, available: true, data });
        } catch {
          lastDetail = `respuesta no-JSON (${model})`;
          continue;
        }
      }
      return NextResponse.json({ success: true, available: true, answer: content.trim() });
    } catch (e) {
      lastDetail = `red (${model}): ${e instanceof Error ? e.message : "error"}`;
    }
  }
  return NextResponse.json({ success: false, available: true, error: "provider_error", detail: lastDetail }, { status: 502 });
}
