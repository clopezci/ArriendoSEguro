/**
 * Precios públicos del producto (fase inicial). Centralizados para UI, encuesta y cobros.
 */

/** Precio de lista por contrato gestionado en la plataforma (COP). */
export const CONTRACT_LIST_PRICE_COP = 89_900;

/** Promoción primeros inscritos / encuesta (COP). */
export const CONTRACT_EARLY_BIRD_PRICE_COP = 49_900;

/** Monto que cobra hoy el checkout del Plan Plus (promoción vigente). */
export const PLATFORM_PLAN_PLUS_PRICE_COP = CONTRACT_EARLY_BIRD_PRICE_COP;

/** Texto corto: un pago = un contrato en la plataforma. */
export const PER_CONTRACT_PAYMENT_NOTICE =
  "El valor pagado corresponde a un (1) contrato de arrendamiento gestionado en ArriendoSeguro. Si renuevas el arriendo o abres un contrato nuevo, debes iniciar un expediente nuevo y cubrir el pago que aplique en ese momento.";

/** Beneficio promocional para primeros inscritos (sin prometer descuento fijo en ley de protección al consumidor). */
export const EARLY_BIRD_BENEFIT_SHORT =
  "Los primeros inscritos en la encuesta acceden a $49.900 por contrato (precio de lista $89.900), mientras dure la promoción de lanzamiento.";

/** Título corto de la promoción de introducción (para CTAs). */
export const INTRO_PROMO_TITLE = "Precio de introducción: primer contrato por $49.900";

/**
 * Mensaje de promoción que se muestra en el punto de registro/login: precio de
 * introducción por el primer contrato (firma incluida) y segundo contrato gratis
 * si invitas a 3 personas que usen la app.
 */
export const INTRO_PROMO_MESSAGE =
  "Aprovecha: tu primer contrato tiene un precio de introducción de $49.900 (una fracción del costo de una inmobiliaria) e incluye la firma electrónica. Y tu segundo contrato puede ser GRATIS si invitas a 3 personas que usen ArriendoSeguro.";

export function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCopPlain(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}
