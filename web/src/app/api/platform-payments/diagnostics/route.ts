import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";
import { wompiIsSandbox } from "@/domain/platform-payments/wompi-checkout";
import { isBrebConfigured, isBrebEnabled } from "@/domain/platform-payments/breb-checkout";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico de la configuración de pagos (SOLO admin interno). Nunca devuelve
 * secretos: únicamente booleanos de "está / no está configurado" y la URL de
 * webhook que hay que registrar en la pasarela. Sirve para responder al vuelo
 * "¿por qué no funciona el pago?" sin adivinar.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const base = appConfig.publicUrl.replace(/\/$/, "");
  const wompiConfigured = isWompiConfigured();

  return NextResponse.json({
    success: true,
    environment: process.env.NODE_ENV,
    publicUrl: appConfig.publicUrl,
    wompi: {
      configured: wompiConfigured,
      sandbox: wompiConfigured ? wompiIsSandbox() : null,
      publicKeySet: Boolean(process.env.WOMPI_PUBLIC_KEY),
      privateKeySet: Boolean(process.env.WOMPI_PRIVATE_KEY),
      integritySecretSet: Boolean(process.env.WOMPI_INTEGRITY_SECRET),
      eventsSecretSet: Boolean(process.env.WOMPI_EVENTS_SECRET),
      webhookUrl: `${base}/api/platform-payments/webhook`,
    },
    breb: {
      // Bre-B transparente = método dentro de la pasarela (Wompi). Este bloque
      // describe además el "modo interno" propio (llave/QR), hoy no usado por el
      // usuario final.
      buttonVisible: wompiConfigured || isBrebEnabled(),
      internalModeAvailable: isBrebEnabled(),
      ownProviderConfigured: isBrebConfigured(),
      llaveSet: Boolean(process.env.BREB_LLAVE),
      webhookSecretSet: Boolean(process.env.BREB_WEBHOOK_SECRET),
    },
    hints: [
      wompiConfigured
        ? "Wompi configurado: el botón de Bre-B lleva a la pasarela y ahí el usuario elige Bre-B."
        : "Wompi NO configurado: define WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_INTEGRITY_SECRET y WOMPI_EVENTS_SECRET en Vercel.",
      process.env.WOMPI_EVENTS_SECRET
        ? "Recuerda registrar la URL de webhook en el panel de Wompi para que el pago se confirme solo."
        : "Falta WOMPI_EVENTS_SECRET: sin él no se puede validar el webhook y el plan quedará en 'confirmando'.",
      "Para que Bre-B aparezca en la pasarela, actívalo como método en el panel de Wompi del comercio.",
    ],
  });
}
