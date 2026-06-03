/**
 * Valores de producto y feature flags. Los módulos desactivados en esta fase inicial
 * quedan explícitos para no mezclar lógica de marketplace con formalización.
 */
export const appConfig = {
  name: "ArriendoSeguro",
  /** Título principal de la landing (fase inicial) */
  tagline:
    "¿Necesitas arrendar tu propiedad? Te lo hacemos fácil, seguro y asequible.",
  /** Resumen breve para meta tags y previsualizaciones */
  seoDescription:
    "Formaliza contratos de arrendamiento entre personas en Colombia: contrato, inventario, firma y registro de pagos.",
  publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const featureFlags = {
  /** Búsqueda, publicación y matching: fase 2, desactivado en la fase inicial */
  marketplaceAndListing: false,
  /** Expediente de arriendo / formalización: núcleo de la fase inicial (orden 1) */
  leaseFormalization: true,
  /** Inventario / acta: orden 2 */
  propertyInventory: false,
  /** Registro informativo de pagos: orden 3 (sin recaudo en app) */
  paymentLog: false,
  /** Reputación y calificaciones: orden 4 */
  reviewsAndReputation: false,
} as const;

/**
 * Tier gratuito: permite generar/imprimir el contrato sin pagar (con marca de
 * agua `arriendoseguro.app` y CTA a Plus). Firma e posventa siguen siendo Plus.
 * Se puede APAGAR (`NEXT_PUBLIC_FREE_TIER_ENABLED=false`) para volver a
 * "todo pago" si los ingresos por publicidad no sostienen el tier gratis.
 * Por defecto: activado.
 */
export const freeTierEnabled = process.env.NEXT_PUBLIC_FREE_TIER_ENABLED !== "false";
