/**
 * Publicidad interna ("house ads") de ArriendoSeguro. Se muestran en los espacios
 * de anuncios MIENTRAS Google aprueba AdSense (modo "house"). Son promociones y
 * consejos reales de la plataforma — nada inventado, todos apuntan a rutas que
 * existen.
 */

export interface HouseAd {
  id: string;
  emoji: string;
  tag: string;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
}

export const HOUSE_ADS: HouseAd[] = [
  {
    id: "firma-electronica",
    emoji: "✍️",
    tag: "Plan Plus",
    title: "Firma electrónica con respaldo legal",
    body: "Firma tu contrato con código de verificación y evidencia de fecha, IP y hash (Ley 527). Sin filas ni papel.",
    ctaLabel: "Ver Plan Plus",
    href: "/dashboard/plans",
  },
  {
    id: "tope-canon",
    emoji: "🧮",
    tag: "Consejo",
    title: "¿Tu canon respeta el tope legal?",
    body: "Calcula el reajuste anual permitido según el IPC (Ley 820 de 2003) antes de firmar o renovar.",
    ctaLabel: "Abrir calculadora",
    href: "/calculadoras",
  },
  {
    id: "codeudor",
    emoji: "🤝",
    tag: "Contrato",
    title: "Con o sin codeudor solidario",
    body: "Arma tu contrato de arrendamiento con las cláusulas al día y, si lo necesitas, agrega un codeudor.",
    ctaLabel: "Crear contrato",
    href: "/dashboard/contracts/new",
  },
  {
    id: "inventario",
    emoji: "📸",
    tag: "Plan Plus",
    title: "Inventario con fotos y acta de entrega",
    body: "Deja registro del estado del inmueble al entrar y salir. Evita discusiones al terminar el arriendo.",
    ctaLabel: "Conocer más",
    href: "/dashboard/plans",
  },
  {
    id: "recordatorios",
    emoji: "🔔",
    tag: "Plan Plus",
    title: "Recordatorios de pago automáticos",
    body: "El inquilino recibe el aviso y sube el soporte del pago sin fricción. Tú confirmas con un clic.",
    ctaLabel: "Ver cómo funciona",
    href: "/dashboard/plans",
  },
  {
    id: "blog",
    emoji: "📚",
    tag: "Guías",
    title: "Aprende a arrendar sin intermediarios",
    body: "Guías prácticas sobre contratos, depósitos, reajustes y derechos y deberes de cada parte.",
    ctaLabel: "Leer el blog",
    href: "/blog",
  },
  {
    id: "entiendelo-facil",
    emoji: "🟢",
    tag: "Primera vez",
    title: "¿Primera vez arrendando?",
    body: "Te explicamos paso a paso cómo formalizar tu arriendo de forma simple y con respaldo.",
    ctaLabel: "Entiéndelo fácil",
    href: "/entiendelo-facil",
  },
  {
    id: "plantillas",
    emoji: "📄",
    tag: "Gratis",
    title: "Plantillas útiles para tu arriendo",
    body: "Carta de preaviso, paz y salvo, acta de entrega y autorización de datos, listas para usar.",
    ctaLabel: "Ver plantillas",
    href: "/plantillas",
  },
];

/** Selección estable de una house ad a partir de una semilla (placement). */
export function pickHouseAd(seed: string, offset = 0): HouseAd {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const index = (Math.abs(hash) + offset) % HOUSE_ADS.length;
  return HOUSE_ADS[index];
}
