/**
 * Valores de producto y feature flags. Los módulos desactivados en MVP
 * quedan explícitos para no mezclar lógica de marketplace con formalización.
 */
export const appConfig = {
  name: "ArriendoSeguro",
  tagline: "Arrienda fácil y seguro entre particulares",
  publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const featureFlags = {
  /** Búsqueda, publicación y matching: fase 2, desactivado en MVP */
  marketplaceAndListing: false,
  /** Expediente de arriendo / formalización: núcleo del MVP */
  leaseFormalization: true,
  /** Registro estructurado de pagos (sin recaudo) */
  paymentLog: true,
} as const;
