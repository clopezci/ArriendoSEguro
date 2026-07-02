/**
 * Endpoint que devuelve evidencia mínima del entorno desde el que la
 * persona aceptó una declaración bajo gravedad de juramento o una casilla
 * de "Acepto". Es complementario a la firma electrónica: nos permite
 * mostrar al usuario, debajo de cada check, los datos que quedan en el
 * expediente como soporte de quién/desde dónde aceptó.
 *
 * Datos capturados (solo los que el servidor puede derivar):
 *   - `ip`: leída desde encabezados de red (Vercel/CDN: `x-forwarded-for`,
 *     `x-real-ip`, `cf-connecting-ip`, etc.). Nunca rastreamos al usuario;
 *     solo dejamos constancia mínima para auditoría y futuros conflictos.
 *   - `country` / `region` / `city`: leídos de los headers de Vercel/CDN
 *     cuando estén disponibles (Vercel agrega `x-vercel-ip-country`,
 *     `x-vercel-ip-city`, etc.). No hacemos lookup contra servicios
 *     externos para no introducir latencia ni costos.
 *   - `serverNow`: fecha/hora del servidor en ISO 8601.
 *
 * El frontend complementa estos datos con `userAgent`, `screen`, `tz` y
 * opcionalmente `geolocation` (si el navegador la concede) para mostrarlos
 * juntos. La persistencia formal en Firestore queda para el bloque de
 * evidencia formal del expediente; por ahora solo emitimos un
 * `auditEvent` para que quede trazado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditEvent } from "@/features/contracts/audit-server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  /**
   * Identificador del juramento que se está aceptando. Lo definimos como
   * cadena libre para que cada paso del wizard pueda pasar un label
   * legible (ej. "property_ownership_oath", "tenant_truthfulness_oath").
   */
  oathId: z.string().min(2).max(80),
  contractDraftId: z.string().min(1).max(100).optional(),
  // Datos del cliente (opcionales) para conservar la evidencia completa en BD.
  userAgent: z.string().max(500).optional(),
  language: z.string().max(40).optional(),
  timeZone: z.string().max(80).optional(),
  screen: z.string().max(40).optional(),
  clientNow: z.string().max(40).optional(),
});

function pickIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for puede ser "ip1, ip2, ip3" → el primero es el cliente.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }

    const ip = pickIp(request.headers);
    const country = request.headers.get("x-vercel-ip-country") ?? "";
    const region = request.headers.get("x-vercel-ip-country-region") ?? "";
    const city = request.headers.get("x-vercel-ip-city") ?? "";
    const serverNow = new Date().toISOString();

    auditEvent("oath_evidence_captured", {
      oathId: parsed.data.oathId,
      contractDraftId: parsed.data.contractDraftId ?? null,
      ip: ip || null,
      country: country || null,
      region: region || null,
      city: city || null,
    });

    // Persistencia formal en BD: guardamos el documento de evidencia completo
    // (servidor + cliente) para poder exportarlo si el usuario lo requiere.
    // Best-effort: si Firestore no está o falla, no rompemos el flujo del check.
    try {
      const firestore = getAdminFirestore();
      if (firestore) {
        await firestore.collection("oath_evidence").add({
          oathId: parsed.data.oathId,
          contractDraftId: parsed.data.contractDraftId ?? null,
          ip: ip || null,
          country: country || null,
          region: region || null,
          city: city ? decodeURIComponent(city) : null,
          serverNow,
          userAgent: parsed.data.userAgent ?? null,
          language: parsed.data.language ?? null,
          timeZone: parsed.data.timeZone ?? null,
          screen: parsed.data.screen ?? null,
          clientNow: parsed.data.clientNow ?? null,
          createdAt: serverNow,
        });
      }
    } catch (persistErr) {
      if (process.env.NODE_ENV !== "production") console.error("oath-evidence persist", persistErr);
    }

    return NextResponse.json({
      success: true,
      evidence: {
        oathId: parsed.data.oathId,
        ip,
        country,
        region,
        city: city ? decodeURIComponent(city) : "",
        serverNow,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("oath-evidence/capture error", error);
    }
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "server", message: "No se pudo capturar la evidencia." }],
      },
      { status: 500 },
    );
  }
}
