/**
 * Valores de producto y feature flags. Los módulos desactivados en MVP
 * quedan explícitos para no mezclar lógica de marketplace con formalización.
 */
export const appConfig = {
  name: "ArriendoSeguro",
  /** Título principal de la landing MVP */
  tagline:
    "Necesitas arrendar tu propiedad? Te lo hacemos facil, seguro y asequible.",
  /** Resumen breve para meta tags y previsualizaciones */
  seoDescription:
    "Formaliza contratos de arrendamiento entre personas en Colombia: contrato, inventario, firma y registro de pagos.",
  publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const featureFlags = {
  /** Búsqueda, publicación y matching: fase 2, desactivado en MVP */
  marketplaceAndListing: false,
  /** Expediente de arriendo / formalización: núcleo del MVP (orden 1) */
  leaseFormalization: true,
  /** Inventario / acta: orden 2 */
  propertyInventory: false,
  /** Registro informativo de pagos: orden 3 (sin recaudo en app) */
  paymentLog: false,
  /** Reputación y calificaciones: orden 4 */
  reviewsAndReputation: false,
} as const;
