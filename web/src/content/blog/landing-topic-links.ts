import { BLOG_ARTICLES } from "./articles";

/**
 * Textos de ancla en la landing para enlazado interno SEO.
 * Si agregas artículos, incluye aquí el slug o caerá al título del artículo.
 */
const ANCHOR_BY_SLUG: Record<string, string> = {
  "contrato-arrendamiento-vivienda-colombia-ley-820": "Contrato de vivienda urbana y Ley 820",
  "canon-arriendo-tope-1-porciento-valor-comercial": "Canon y tope del 1 % sobre valor comercial",
  "codeudor-solidario-arriendo-colombia": "Codeudor solidario en el arriendo",
  "inventario-entrega-inmueble-arriendo": "Inventario y acta de entrega del inmueble",
  "firma-electronica-contrato-arriendo-ley-527": "Firma electrónica y Ley 527",
  "arrendar-sin-inmobiliaria-contrato-seguro": "Arrendar sin inmobiliaria con menos riesgo",
};

export type LandingBlogTopicLink = { href: string; label: string };

export function getLandingBlogTopicLinks(): LandingBlogTopicLink[] {
  return BLOG_ARTICLES.map((a) => ({
    href: `/blog/${a.slug}`,
    label: ANCHOR_BY_SLUG[a.slug] ?? a.title,
  }));
}
