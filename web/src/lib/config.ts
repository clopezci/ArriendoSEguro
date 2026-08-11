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
 * Tier gratuito (crear/imprimir el contrato con marca de agua, sin firma).
 * Modelo vigente (introducción): está APAGADO por defecto — crear el contrato
 * cuesta el precio de introducción e incluye todo (firma, inventario, posventa).
 * Solo las herramientas sueltas (calculadoras, plantillas, blog) son gratis.
 * Se puede ENCENDER con `NEXT_PUBLIC_FREE_TIER_ENABLED=true` (o desde admin).
 */
export const freeTierEnabled = process.env.NEXT_PUBLIC_FREE_TIER_ENABLED === "true";
