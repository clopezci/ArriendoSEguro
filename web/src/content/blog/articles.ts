import type { BlogArticle, BlogCategoryId, ContentBlock } from "./types";

const ctaEncuesta: ContentBlock = {
  type: "cta",
  href: "/encuesta",
  label: "Responder la encuesta de validación",
  description: "Ayúdanos a priorizar funciones y mejora el producto para tu próximo arriendo.",
};

const ctaIngresar: ContentBlock = {
  type: "cta",
  href: "/ingresar",
  label: "Crear cuenta y empezar un expediente",
  description: "Formaliza contrato, inventario y firma electrónica en un solo flujo.",
};

export const BLOG_CATEGORIES: Record<
  BlogCategoryId,
  { id: BlogCategoryId; label: string; description: string }
> = {
  contrato: {
    id: "contrato",
    label: "Contrato y formalización",
    description: "Pasos, cláusulas y documentos para arrendar con respaldo.",
  },
  ley820: {
    id: "ley820",
    label: "Ley 820 y canon",
    description: "Tope del 1 %, valor comercial y buenas prácticas en Colombia.",
  },
  codeudor: {
    id: "codeudor",
    label: "Codeudor y garantías",
    description: "Obligación solidaria y respaldo frente al incumplimiento.",
  },
  inventario: {
    id: "inventario",
    label: "Inventario y entrega",
    description: "Acta de entrega, fotos y estado del inmueble.",
  },
  firma: {
    id: "firma",
    label: "Firma electrónica",
    description: "Ley 527 de 1999 y evidencia de consentimiento.",
  },
  guia: {
    id: "guia",
    label: "Guías para arrendar",
    description: "Orientación práctica sin sustituir asesoría legal.",
  },
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "contrato-arrendamiento-vivienda-colombia-ley-820",
    title: "Contrato de arrendamiento de vivienda urbana en Colombia y Ley 820",
    description:
      "Qué debe incluir un contrato de arriendo de vivienda urbana, cómo se relaciona con la Ley 820 de 2003 y por qué conviene formalizarlo por escrito con trazabilidad.",
    datePublished: "2026-05-01",
    dateModified: "2026-05-14",
    category: "contrato",
    categoryLabel: BLOG_CATEGORIES.contrato.label,
    keywords: [
      "contrato de arrendamiento",
      "contrato de arriendo Colombia",
      "Ley 820 de 2003",
      "vivienda urbana",
      "arriendo entre particulares",
    ],
    featured: true,
    blocks: [
      {
        type: "p",
        text: "Arrendar una vivienda urbana en Colombia implica reglas imperativas que protegen al arrendatario (inquilino) y al arrendador (dueño). La Ley 820 de 2003 regula el arrendamiento de vivienda urbana; un contrato claro reduce disputas sobre canon, duración, servicios y entrega del inmueble.",
      },
      {
        type: "h2",
        text: "Elementos mínimos que suelen revisarse en un contrato de vivienda urbana",
      },
      {
        type: "ul",
        items: [
          "Identificación de las partes y del inmueble (dirección, matrícula inmobiliaria cuando aplique).",
          "Canon, periodicidad, forma de pago y actualización pactada dentro de los límites legales.",
          "Plazo, destinación como vivienda y normas de convivencia o propiedad horizontal.",
          "Servicios públicos, administración y quién asume cada rubro.",
          "Mecanismo de entrega y restitución del inmueble (inventario o acta).",
        ],
      },
      {
        type: "note",
        text: "ArriendoSeguro ofrece plantillas y flujo de formalización con orientación general; no sustituye revisión por abogado cuando el caso lo requiera.",
      },
      {
        type: "h2",
        text: "Por qué formalizar con firma e inventario",
      },
      {
        type: "p",
        text: "Dejar constancia escrita, con firma electrónica simple y bitácora, ayuda a las partes a probar qué se acordó y en qué estado se entregó el inmueble. Eso es distinto a “garantizar” un resultado judicial, pero sí mejora la organización del arriendo.",
      },
      ctaIngresar,
      ctaEncuesta,
    ],
  },
  {
    slug: "canon-arriendo-tope-1-porciento-valor-comercial",
    title: "Canon de arriendo y tope del 1 % sobre el valor comercial en Colombia",
    description:
      "Cómo se interpreta en la práctica el límite del canon frente al valor comercial del inmueble, qué pasa si no conoces el avalúo y buenas prácticas para el arrendador (dueño).",
    datePublished: "2026-05-02",
    dateModified: "2026-05-14",
    category: "ley820",
    categoryLabel: BLOG_CATEGORIES.ley820.label,
    keywords: [
      "canon arriendo Colombia",
      "1 por ciento valor comercial",
      "Ley 820 canon máximo",
      "valor comercial inmueble",
    ],
    blocks: [
      {
        type: "p",
        text: "En vivienda urbana suele discutirse si el canon mensual respeta el límite legal vinculado al valor comercial del inmueble. La herramienta debe ayudar al arrendador a estimar y documentar, sin reemplazar estudio catastral o registral cuando el caso lo exige.",
      },
      {
        type: "h2",
        text: "Si no conoces el valor comercial",
      },
      {
        type: "ol",
        items: [
          "Acuerda con la otra parte una fuente de referencia (avalúo, oferta reciente, criterio pericial).",
          "Documenta la metodología en anexos u observaciones del contrato.",
          "Si sigues sin cifra, asume la responsabilidad de no superar el marco legal y conserva evidencia de buena fe.",
        ],
      },
      {
        type: "table",
        caption: "Ejemplo ilustrativo (cifras ficticias)",
        headers: ["Valor comercial estimado", "1 % mensual referencial"],
        rows: [
          ["$300.000.000", "$3.000.000"],
          ["$180.000.000", "$1.800.000"],
        ],
      },
      {
        type: "note",
        text: "Los números son ejemplos pedagógicos. La proporción y excepciones aplicables las define la norma y la jurisprudencia vigente; valida con profesional.",
      },
      ctaIngresar,
    ],
  },
  {
    slug: "codeudor-solidario-arriendo-colombia",
    title: "Codeudor solidario en arriendos: qué es y qué suele pedirse en Colombia",
    description:
      "Obligación solidaria, firma del codeudor, notificación y documentación de respaldo económico frecuente en arriendos informales.",
    datePublished: "2026-05-03",
    dateModified: "2026-05-14",
    category: "codeudor",
    categoryLabel: BLOG_CATEGORIES.codeudor.label,
    keywords: [
      "codeudor solidario",
      "codeudor arriendo Colombia",
      "obligación solidaria arrendamiento",
      "carta laboral codeudor",
    ],
    blocks: [
      {
        type: "p",
        text: "El codeudor solidario responde frente al arrendador (dueño) junto con el arrendatario (inquilino) por las obligaciones pactadas en el contrato, según lo acordado y los límites legales. Por eso suele pedirse firma expresa y datos de contacto.",
      },
      {
        type: "h2",
        text: "Documentos que a menudo se solicitan (mercado informal)",
      },
      {
        type: "ul",
        items: [
          "Carta laboral o certificación de ingresos.",
          "Colilla o comprobante de nómina reciente.",
          "Certificado de libertad y tradición de un inmueble a nombre del codeudor, cuando aplica.",
        ],
      },
      {
        type: "note",
        text: "Custodiar esos documentos implica deberes de confidencialidad y Ley 1581; no compartas copias más allá de lo necesario.",
      },
      {
        type: "h3",
        text: "Trazabilidad sin exponer datos de más",
      },
      {
        type: "p",
        text: "Registrar qué soportes se entregaron y cuándo, sin adjuntar archivos sensibles en canales inseguros, es una práctica prudente hasta contar con almacenamiento cifrado y reglas claras.",
      },
      ctaIngresar,
    ],
  },
  {
    slug: "inventario-entrega-inmueble-arriendo",
    title: "Inventario y acta de entrega del inmueble en un arriendo",
    description:
      "Cómo documentar el estado del inmueble al inicio del contrato para reducir conflictos al finalizar el arriendo.",
    datePublished: "2026-05-04",
    dateModified: "2026-05-14",
    category: "inventario",
    categoryLabel: BLOG_CATEGORIES.inventario.label,
    keywords: [
      "inventario arriendo",
      "acta de entrega inmueble",
      "fotos arriendo Colombia",
      "entrega recepción apartamento",
    ],
    blocks: [
      {
        type: "p",
        text: "Un inventario por zonas (cocina, baños, habitaciones, patio) con fotos y observaciones disminuye discusiones sobre deterioro normal frente a daño. Lo ideal es que arrendador e inquilino lo firmen o lo acompañen de evidencia fechada.",
      },
      {
        type: "h2",
        text: "Qué suele incluirse",
      },
      {
        type: "ul",
        items: [
          "Estado de pinturas, pisos, ventanas y closets.",
          "Electrodomésticos y seriales cuando existan.",
          "Contadores de servicios y lecturas iniciales.",
          "Llaves entregadas y controles de acceso.",
        ],
      },
      {
        type: "note",
        text: "Un PDF descargable con las dos partes alineadas es útil para conciliaciones o seguros del hogar.",
      },
      ctaIngresar,
    ],
  },
  {
    slug: "firma-electronica-contrato-arriendo-ley-527",
    title: "Firma electrónica en contratos de arriendo y Ley 527 de 1999",
    description:
      "Qué aporta la firma electrónica simple en arrendamientos entre particulares y cómo combinarla con evidencia de consentimiento.",
    datePublished: "2026-05-05",
    dateModified: "2026-05-14",
    category: "firma",
    categoryLabel: BLOG_CATEGORIES.firma.label,
    keywords: [
      "firma electrónica contrato",
      "Ley 527 de 1999",
      "firma electrónica arriendo",
      "evidencia consentimiento",
    ],
    blocks: [
      {
        type: "p",
        text: "La Ley 527 de 1999 reconoce medios electrónicos para manifestar consentimiento y producir efectos según el tipo de firma y el contexto. En arriendos entre personas, una firma electrónica simple con registro de IP, fecha y hash del documento aporta trazabilidad operativa.",
      },
      {
        type: "h2",
        text: "Buenas prácticas",
      },
      {
        type: "ol",
        items: [
          "Versiona el texto del contrato y congela el HTML o PDF enviado a firmar.",
          "Conserva bitácora de quién firmó, cuándo y con qué método.",
          "Ofrece canal claro para notificaciones posteriores.",
        ],
      },
      {
        type: "note",
        text: "Algunos casos exigen formalidad adicional (notaría, autenticación); evalúa con abogado si tu arriendo lo requiere.",
      },
      ctaIngresar,
    ],
  },
  {
    slug: "arrendar-sin-inmobiliaria-contrato-seguro",
    title: "Arrendar sin inmobiliaria: cómo bajar riesgos con contrato e inventario",
    description:
      "Guía práctica para quien prefiere arriendo directo entre particulares en Colombia sin mediar agencia.",
    datePublished: "2026-05-06",
    dateModified: "2026-05-14",
    category: "guia",
    categoryLabel: BLOG_CATEGORIES.guia.label,
    keywords: [
      "arrendar sin inmobiliaria",
      "arriendo directo Colombia",
      "arriendo entre particulares",
      "contrato arriendo seguro",
    ],
    blocks: [
      {
        type: "p",
        text: "El ahorro de comisión no debe traducirse en informalidad total. Un flujo guiado: datos de las partes, inmueble, términos, servicios, inventario, firma y registro informativo de pagos, alinea expectativas y reduce fricción.",
      },
      {
        type: "h2",
        text: "Checklist rápido",
      },
      {
        type: "ul",
        items: [
          "Verifica identidad y capacidad de quien firma.",
          "Alinear canon y depósitos con la ley aplicable (en vivienda urbana evita depósito en dinero prohibido).",
          "Programar recordatorios de pago y dejar soporte informativo.",
        ],
      },
      {
        type: "cta",
        href: "/entiendelo-facil",
        label: "Leer “Entiéndelo fácil”",
        description: "Lenguaje claro sobre el camino del arriendo en la plataforma.",
      },
      ctaEncuesta,
    ],
  },
];

export function getAllBlogSlugs(): string[] {
  return BLOG_ARTICLES.map((a) => a.slug);
}

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

export function getFeaturedArticle(): BlogArticle {
  return BLOG_ARTICLES.find((a) => a.featured) ?? BLOG_ARTICLES[0];
}

export function getRelatedArticles(slug: string, limit = 3): BlogArticle[] {
  const current = getArticleBySlug(slug);
  if (!current) return [];
  const sameCat = BLOG_ARTICLES.filter(
    (a) => a.slug !== slug && a.category === current.category,
  );
  const other = BLOG_ARTICLES.filter((a) => a.slug !== slug && a.category !== current.category);
  return [...sameCat, ...other].slice(0, limit);
}
