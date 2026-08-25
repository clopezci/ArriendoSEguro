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
  {
    slug: "reajuste-canon-arrendamiento-ipc-2026",
    title: "Reajuste del canon de arrendamiento con el IPC: cuánto puede subir en 2026",
    description:
      "Cómo se calcula el incremento anual del canon en vivienda urbana según el artículo 20 de la Ley 820 de 2003 y el IPC del año anterior. En 2026 el tope es 5,10 %.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "ley820",
    categoryLabel: BLOG_CATEGORIES.ley820.label,
    keywords: [
      "reajuste canon arrendamiento",
      "incremento arriendo 2026",
      "IPC 2025 Colombia",
      "Ley 820 artículo 20",
      "cuánto sube el arriendo",
    ],
    blocks: [
      {
        type: "p",
        text: "El artículo 20 de la Ley 820 de 2003 permite reajustar el canon cada doce (12) meses de ejecución del contrato bajo un mismo precio, hasta una proporción que no supere el 100 % del incremento que haya tenido el Índice de Precios al Consumidor (IPC) en el año calendario inmediatamente anterior, siempre que el nuevo canon no exceda el límite del artículo 18.",
      },
      {
        type: "h2",
        text: "¿Cuánto puede subir en 2026?",
      },
      {
        type: "p",
        text: "El DANE certificó que el IPC de 2025 fue de 5,10 %. Por eso, los reajustes que se cumplan durante 2026 pueden incrementar el canon hasta un máximo de 5,10 %. El plazo se cuenta desde la fecha exacta de inicio o renovación del contrato, no por año calendario: si firmaste en marzo, el reajuste aplica desde marzo del año siguiente.",
      },
      {
        type: "table",
        caption: "Ejemplo con el tope de 5,10 % (IPC 2025)",
        headers: ["Canon actual", "Reajuste máximo (5,10 %)", "Nuevo canon"],
        rows: [
          ["$1.000.000", "$51.000", "$1.051.000"],
          ["$1.500.000", "$76.500", "$1.576.500"],
          ["$2.000.000", "$102.000", "$2.102.000"],
        ],
      },
      {
        type: "h2",
        text: "Reglas clave del reajuste",
      },
      {
        type: "ul",
        items: [
          "Solo procede al cumplir 12 meses bajo el mismo precio.",
          "El tope es el IPC del año calendario inmediatamente anterior.",
          "El arrendador debe informar el monto y la fecha del incremento por el servicio postal autorizado o el mecanismo de notificación pactado en el contrato.",
          "Sin ese aviso, el incremento es inoponible (ineficaz) frente al arrendatario.",
        ],
      },
      {
        type: "note",
        text: "El porcentaje cambia cada año. Verifica siempre el IPC del año inmediatamente anterior en el DANE antes de aplicar un reajuste.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, art. 20 — Función Pública (Gestor Normativo)", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "DANE — Boletín IPC diciembre 2025 (variación anual 5,10 %)", href: "https://www.dane.gov.co/files/operaciones/IPC/dic2025/cp-IPC-dic2025.pdf" },
          { label: "DANE — IPC histórico", href: "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-historico" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "prohibicion-deposito-arriendo-vivienda-urbana",
    title: "¿Es legal pedir depósito en arriendo de vivienda urbana? Lo que dice la Ley 820",
    description:
      "El artículo 16 de la Ley 820 de 2003 prohíbe exigir depósitos en dinero y cauciones reales en vivienda urbana. Qué garantías sí son válidas.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "ley820",
    categoryLabel: BLOG_CATEGORIES.ley820.label,
    keywords: [
      "depósito arriendo Colombia",
      "Ley 820 artículo 16",
      "cauciones reales arrendamiento",
      "garantías arriendo vivienda",
    ],
    blocks: [
      {
        type: "p",
        text: "El artículo 16 de la Ley 820 de 2003 establece la prohibición de depósitos y cauciones reales: en los contratos de arrendamiento de vivienda urbana no se pueden exigir depósitos en dinero efectivo u otra clase de cauciones reales para garantizar las obligaciones del arrendatario. Tampoco pueden estipularse indirectamente, por interpuesta persona, ni en documentos distintos del contrato.",
      },
      {
        type: "h2",
        text: "Entonces, ¿qué respaldo sí puedo usar?",
      },
      {
        type: "ul",
        items: [
          "Codeudor solidario que firme el contrato y responda por las obligaciones.",
          "Póliza o seguro de arrendamiento de una aseguradora, según sus condiciones.",
          "Garantía exclusiva para servicios públicos (art. 15), limitada al valor de cargos fijos, conexión y consumo de dos períodos de facturación.",
        ],
      },
      {
        type: "note",
        text: "Pedir un «mes de depósito» en efectivo como garantía en vivienda urbana va en contra del artículo 16. Es distinto del depósito permitido para servicios públicos del artículo 15.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, arts. 15 y 16 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "Ley 820 de 2003 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "terminacion-contrato-arriendo-preaviso-causales",
    title: "Terminación del contrato de arriendo: causales y preaviso de 3 meses",
    description:
      "Cómo y cuándo puede terminar el contrato el arrendador o el arrendatario según la Ley 820 de 2003, y por qué el preaviso de tres meses es decisivo.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "contrato",
    categoryLabel: BLOG_CATEGORIES.contrato.label,
    keywords: [
      "terminación contrato arrendamiento",
      "preaviso tres meses arriendo",
      "Ley 820 terminación",
      "renovación automática contrato",
    ],
    blocks: [
      {
        type: "p",
        text: "El contrato de vivienda urbana puede terminar por mutuo acuerdo, por las causales legales o mediante preaviso. La Ley 820 de 2003 exige un preaviso no inferior a tres (3) meses; si no media constancia escrita del preaviso, el contrato se entiende renovado automáticamente por un término igual al inicialmente pactado.",
      },
      {
        type: "h2",
        text: "Terminación por el arrendatario",
      },
      {
        type: "p",
        text: "A la fecha de vencimiento, el arrendatario puede dar por terminado el contrato con preaviso de al menos tres meses. Durante la vigencia, puede terminar unilateralmente mediante preaviso e indemnización (art. 24 y 25), consignando la indemnización a órdenes de la autoridad competente dentro de los tres meses anteriores a la terminación.",
      },
      {
        type: "h2",
        text: "Terminación por el arrendador",
      },
      {
        type: "p",
        text: "El arrendador puede terminar por incumplimiento del arrendatario (art. 22) o invocar causales especiales con preaviso de tres meses, acompañando una caución equivalente a seis (6) meses de canon para garantizar el cumplimiento de la causal (art. 23).",
      },
      {
        type: "note",
        text: "Cada causal tiene requisitos formales propios. Conserva la constancia escrita del preaviso y valida tu caso con un profesional.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, arts. 22 a 25 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "Ley 820 de 2003 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "servicios-publicos-arriendo-evitar-deudas",
    title: "Servicios públicos en el arriendo: cómo evitar heredar deudas",
    description:
      "Garantía de servicios del artículo 15 de la Ley 820, desvinculación de la deuda y buenas prácticas para que el inmueble no quede gravado.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "guia",
    categoryLabel: BLOG_CATEGORIES.guia.label,
    keywords: [
      "servicios públicos arriendo",
      "deuda servicios arrendatario",
      "Ley 820 artículo 15",
      "desvinculación servicios públicos",
    ],
    blocks: [
      {
        type: "p",
        text: "Cuando el arrendatario asume el pago de los servicios públicos, el riesgo para el arrendador es que el inmueble quede gravado con deudas. La Ley 820 de 2003 y su reglamentación dan herramientas para manejarlo.",
      },
      {
        type: "h2",
        text: "Garantía de servicios (artículo 15)",
      },
      {
        type: "ul",
        items: [
          "El arrendador puede exigir al arrendatario una garantía o depósito para asegurar el pago de cada servicio.",
          "Esa garantía no puede exceder el valor de los cargos fijos, de conexión y de consumo de dos períodos consecutivos de facturación.",
          "Sirven, entre otras, garantías ante la empresa de servicios, pólizas, fianzas o avales.",
        ],
      },
      {
        type: "h2",
        text: "Desvinculación de la deuda",
      },
      {
        type: "p",
        text: "Una vez notificada la empresa de servicios y terminado el período de facturación, la responsabilidad del pago recae exclusivamente en el arrendatario. Las facturas pendientes del período de preaviso no pueden ser motivo para negar la reconexión. El procedimiento está desarrollado por el Decreto 3130 de 2003.",
      },
      {
        type: "note",
        text: "Registra las lecturas iniciales de los contadores en el inventario de entrega: es la mejor prueba de dónde empezó cada servicio.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, art. 15 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "Decreto 3130 de 2003 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=10482" },
          { label: "Ley 142 de 1994 (servicios públicos) — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0142_1994.html" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "validez-firma-electronica-arriendo-decreto-2364",
    title: "Validez de la firma electrónica en tu contrato de arriendo",
    description:
      "Por qué firmar el contrato de arriendo en línea tiene efectos jurídicos: Ley 527 de 1999 y Decreto 2364 de 2012 sobre firma electrónica.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "firma",
    categoryLabel: BLOG_CATEGORIES.firma.label,
    keywords: [
      "firma electrónica Colombia",
      "Decreto 2364 de 2012",
      "Ley 527 de 1999",
      "validez firma contrato arriendo",
    ],
    blocks: [
      {
        type: "p",
        text: "La Ley 527 de 1999 reconoce los mensajes de datos y la firma electrónica con efectos jurídicos. El Decreto 2364 de 2012 reglamenta el artículo 7 de esa ley: consagra la neutralidad tecnológica y un criterio de confiabilidad para que la firma electrónica cumpla el requisito de firma.",
      },
      {
        type: "h2",
        text: "¿Cuándo cumple una firma electrónica?",
      },
      {
        type: "p",
        text: "Cuando, a la luz de todas las circunstancias del caso (incluido cualquier acuerdo entre las partes), sea tan confiable como apropiada para los fines con los que se generó el mensaje. Se admiten métodos como códigos, contraseñas, claves de un solo uso (OTP), datos biométricos o llaves criptográficas privadas.",
      },
      {
        type: "ul",
        items: [
          "Identificación del firmante.",
          "Integridad del documento firmado (por ejemplo, hash del PDF o HTML).",
          "Evidencia del consentimiento (fecha, método, registro de la operación).",
          "Trazabilidad de quién firmó y cuándo.",
        ],
      },
      {
        type: "note",
        text: "Algunos actos exigen escritura pública o autenticación. El arrendamiento de vivienda urbana puede constar por documento privado; si tu caso requiere formalidad adicional, consúltalo con un abogado.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 527 de 1999 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276" },
          { label: "Decreto 2364 de 2012 (firma electrónica) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "firma-digital-gratis-agencia-nacional-digital-arriendo",
    title: "Firma digital gratis del Estado: cómo usar la Agencia Nacional Digital en tu arriendo",
    description:
      "El Estado colombiano ofrece firma y autenticación digital gratuita a través de la Agencia Nacional Digital (Decreto 620 de 2020). Cómo funciona y cómo firmar un contrato de arriendo entre varias partes.",
    datePublished: "2026-06-26",
    dateModified: "2026-06-26",
    category: "firma",
    categoryLabel: BLOG_CATEGORIES.firma.label,
    keywords: [
      "firma digital gratis Colombia",
      "Agencia Nacional Digital",
      "autenticación digital Decreto 620 de 2020",
      "firmar contrato arriendo en línea",
      "servicios ciudadanos digitales",
    ],
    blocks: [
      {
        type: "p",
        text: "Tu contrato de arriendo puede firmarse en línea con firma electrónica simple (Ley 527 de 1999), que ya tiene efectos jurídicos. Pero si las partes quieren además un respaldo del Estado sin pagar nada, Colombia ofrece firma y autenticación digital gratuita a través de la Agencia Nacional Digital (AND), en el marco de los servicios ciudadanos digitales del Decreto 620 de 2020.",
      },
      {
        type: "h2",
        text: "¿Qué es la firma de la Agencia Nacional Digital?",
      },
      {
        type: "p",
        text: "Es un servicio público que permite a un ciudadano firmar y autenticar documentos electrónicos validando su identidad y confirmando con un código de un solo uso (OTP) enviado a su correo. Al ser un servicio del Estado, aporta un respaldo de identidad adicional al de una firma electrónica simple. Es opcional y se gestiona por fuera de la plataforma: cada persona firma con su propia cuenta.",
      },
      {
        type: "h2",
        text: "Cómo firmar un contrato entre varias partes (paso a paso)",
      },
      {
        type: "ol",
        items: [
          "Descarga el PDF del contrato (en ArriendoSeguro, desde la vista previa o la sección de notaría).",
          "La primera persona entra al portal de la AND, se registra, sube el PDF, confirma con el código (OTP) que llega a su correo y descarga el documento ya firmado.",
          "Esa misma persona le envía el PDF firmado a la siguiente parte, que repite el proceso firmando sobre el mismo archivo.",
          "Se continúa uno por uno (arrendador, arrendatario y codeudor si lo hay) hasta el último firmante.",
          "El último guarda el PDF con todas las firmas. En ArriendoSeguro puede subirlo en la sección de autenticación notarial para dejarlo archivado como evidencia del expediente.",
        ],
      },
      {
        type: "note",
        text: "Todas las partes deben firmar el mismo archivo, en orden. No firmen copias distintas por separado. Al firmar, el archivo cambia respecto al original: es normal, porque la firma queda incrustada en el PDF.",
      },
      {
        type: "h2",
        text: "¿Reemplaza a la notaría?",
      },
      {
        type: "p",
        text: "No necesariamente. El arrendamiento de vivienda urbana puede constar por documento privado y no exige notaría. La firma digital del Estado es una capa de respaldo de identidad; algunos actos sí requieren escritura pública o autenticación notarial. Valida los costos, requisitos y el alcance directamente en el portal oficial y, si tu caso lo amerita, con un abogado.",
      },
      {
        type: "sources",
        items: [
          { label: "Agencia Nacional Digital — Firma y Autenticación Digital", href: "https://firmaautenticaciondigital.and.gov.co/" },
          { label: "Agencia Nacional Digital (AND)", href: "https://www.and.gov.co/" },
          { label: "Decreto 620 de 2020 (servicios ciudadanos digitales) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=153053" },
          { label: "Ley 527 de 1999 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "historial-crediticio-habeas-data-arrendar",
    title: "Historial crediticio al arrendar: cómo consultarlo sin violar el Habeas Data",
    description:
      "Quién puede consultar el historial crediticio, la caducidad del dato negativo y los deberes de Habeas Data (Ley 1266 de 2008 y Ley 1581 de 2012).",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "guia",
    categoryLabel: BLOG_CATEGORIES.guia.label,
    keywords: [
      "historial crediticio arriendo",
      "habeas data financiero",
      "Ley 1266 de 2008",
      "Ley 1581 de 2012",
      "dato negativo caducidad",
    ],
    blocks: [
      {
        type: "p",
        text: "Es común que el arrendador quiera revisar el historial crediticio del posible arrendatario o del codeudor. Hacerlo de forma legal exige respetar el Habeas Data.",
      },
      {
        type: "h2",
        text: "Quién puede consultar",
      },
      {
        type: "p",
        text: "La consulta de la información financiera y crediticia corresponde, en general, al titular de los datos o a quien cuente con su autorización. El titular puede consultar su información gratuitamente al menos una vez cada mes calendario (Ley 1266 de 2008).",
      },
      {
        type: "h2",
        text: "Caducidad del dato negativo",
      },
      {
        type: "ul",
        items: [
          "Permanencia máxima de cuatro (4) años desde la fecha en que se paga la obligación en mora.",
          "Si la mora fue inferior a dos años, el reporte no puede superar el doble del tiempo de la mora.",
          "Caducidad absoluta a los ocho (8) años contados desde la mora, conforme a la Ley 2157 de 2021 («Borrón y cuenta nueva»).",
        ],
      },
      {
        type: "note",
        text: "Usa esa información solo para evaluar el arriendo, trátala con confidencialidad y no la difundas (Ley 1581 de 2012). Por eso ArriendoSeguro no carga ni almacena reportes de crédito: solo orienta y deja constancia de la verificación.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 1266 de 2008 (Habeas Data financiero) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34488" },
          { label: "SIC — Sobre el Habeas Data financiero", href: "https://www.sic.gov.co/sobre-el-habeas-data-financiero" },
          { label: "SIC — Protección de datos personales (Ley 1581 de 2012)", href: "https://www.sic.gov.co/proteccion-de-datos-personales" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "codeudor-poliza-seguro-arrendamiento-comparacion",
    title: "Codeudor, póliza o seguro de arrendamiento: ¿qué respaldo elegir?",
    description:
      "Comparación práctica de las garantías más usadas en arriendos en Colombia y por qué ninguna equivale a un depósito en dinero (prohibido en vivienda urbana).",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "codeudor",
    categoryLabel: BLOG_CATEGORIES.codeudor.label,
    keywords: [
      "codeudor solidario",
      "póliza de arrendamiento",
      "seguro de arrendamiento",
      "garantías arriendo Colombia",
    ],
    blocks: [
      {
        type: "p",
        text: "Para respaldar el cumplimiento del arriendo se usan principalmente tres figuras. Conviene entender qué implica cada una antes de elegir.",
      },
      {
        type: "table",
        caption: "Comparación de respaldos frecuentes",
        headers: ["Respaldo", "Qué es", "A tener en cuenta"],
        rows: [
          ["Codeudor solidario", "Persona que responde junto al arrendatario por las obligaciones del contrato.", "Firma expresa y trato confidencial de sus datos."],
          ["Póliza de arrendamiento", "Producto de una aseguradora que cubre cánones y, según condiciones, servicios.", "Implica estudio del arrendatario; primas y coberturas varían."],
          ["Seguro / afianzamiento", "Empresa afianzadora respalda el pago ante incumplimiento.", "Revisa exclusiones y el trámite de reclamación."],
        ],
      },
      {
        type: "p",
        text: "La obligación solidaria significa que el acreedor puede exigir el total de la deuda a cualquiera de los deudores solidarios (Código Civil, art. 1568 y siguientes). Por eso el codeudor debe firmar de forma expresa y conocer el alcance de lo que respalda.",
      },
      {
        type: "note",
        text: "En vivienda urbana, ninguna de estas garantías equivale a un depósito en dinero: ese tipo de caución real está prohibido por el artículo 16 de la Ley 820 de 2003.",
      },
      {
        type: "sources",
        items: [
          { label: "Código Civil colombiano (obligaciones solidarias, art. 1568) — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/codigo_civil.html" },
          { label: "Ley 820 de 2003, art. 16 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "restitucion-inmueble-arrendado-proceso-cgp-384",
    title: "Restitución del inmueble arrendado: cómo funciona el proceso (CGP art. 384)",
    description:
      "Qué es el proceso de restitución de inmueble arrendado, sus reglas principales y por qué la mora exige consignar lo adeudado para ser oído.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "contrato",
    categoryLabel: BLOG_CATEGORIES.contrato.label,
    keywords: [
      "restitución inmueble arrendado",
      "proceso de restitución",
      "Código General del Proceso artículo 384",
      "Ley 1564 de 2012",
    ],
    blocks: [
      {
        type: "p",
        text: "Cuando el arrendatario no restituye el inmueble o incumple, el arrendador puede acudir al proceso de restitución de inmueble arrendado, regulado por el artículo 384 del Código General del Proceso (Ley 1564 de 2012).",
      },
      {
        type: "h2",
        text: "Puntos clave del proceso",
      },
      {
        type: "ul",
        items: [
          "A la demanda debe acompañarse prueba documental del contrato suscrito por el arrendatario, o su confesión.",
          "Si la causa es falta de pago, el demandado no será oído hasta consignar a órdenes del juzgado el total adeudado, o presentar los recibos de los tres últimos períodos.",
          "El juez puede ordenar restitución provisional si el bien está desocupado, abandonado o en grave deterioro.",
          "Cuando la única causal es la mora en el canon, el proceso es de única instancia.",
        ],
      },
      {
        type: "note",
        text: "Es un proceso judicial. ArriendoSeguro ayuda a tener el contrato, la firma y la evidencia organizados; no reemplaza la asesoría de un abogado.",
      },
      {
        type: "sources",
        items: [
          { label: "Código General del Proceso (Ley 1564 de 2012), art. 384 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_1564_2012.html" },
          { label: "Ley 1564 de 2012 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=48425" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "inventario-acta-entrega-valor-probatorio",
    title: "Inventario y acta de entrega: por qué son tu mejor prueba",
    description:
      "Cómo documentar el estado del inmueble al inicio y al final del arriendo para que el inventario tenga valor probatorio y evite conflictos.",
    datePublished: "2026-06-03",
    dateModified: "2026-06-03",
    category: "inventario",
    categoryLabel: BLOG_CATEGORIES.inventario.label,
    keywords: [
      "inventario arriendo",
      "acta de entrega",
      "valor probatorio inventario",
      "estado del inmueble arriendo",
    ],
    blocks: [
      {
        type: "p",
        text: "El inventario y el acta de entrega documentan el estado del inmueble al inicio y al final del arriendo. Bien hechos, son la mejor prueba para distinguir el deterioro normal del daño imputable y reducir discusiones al momento de la restitución.",
      },
      {
        type: "h2",
        text: "Qué fortalece su valor probatorio",
      },
      {
        type: "ul",
        items: [
          "Firma de ambas partes o, en su defecto, evidencia fechada (fotos con fecha).",
          "Fotografías por zonas: cocina, baños, habitaciones, pisos, paredes y ventanas.",
          "Lecturas iniciales de los contadores de servicios públicos.",
          "Seriales de electrodomésticos y descripción de daños preexistentes.",
        ],
      },
      {
        type: "p",
        text: "El inventario complementa las obligaciones de entrega y restitución del inmueble previstas en la Ley 820 de 2003 y aporta soporte si más adelante hay una conciliación, una reclamación de seguro o un proceso de restitución.",
      },
      {
        type: "note",
        text: "Un PDF firmado por ambas partes, con fotos y lecturas, vale mucho más que un acuerdo verbal sobre «cómo estaba» el inmueble.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003 (texto completo) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "Ley 820 de 2003 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "subarriendo-cesion-contrato-arriendo-ley-820",
    title: "Subarriendo y cesión del contrato de arriendo: qué permite la Ley 820",
    description:
      "El artículo 17 de la Ley 820 de 2003 prohíbe subarrendar o ceder el contrato sin autorización expresa del arrendador. Qué pasa si se incumple y cómo autorizarlo bien.",
    datePublished: "2026-06-26",
    dateModified: "2026-06-26",
    category: "contrato",
    categoryLabel: BLOG_CATEGORIES.contrato.label,
    keywords: [
      "subarriendo Colombia",
      "cesión contrato arriendo",
      "Ley 820 artículo 17",
      "subarrendar sin autorización",
    ],
    blocks: [
      {
        type: "p",
        text: "Subarrendar es entregar a un tercero, total o parcialmente, el inmueble que se tiene en arriendo. Ceder el contrato es traspasar la posición de arrendatario a otra persona. La Ley 820 de 2003 regula ambas figuras y, por regla general, las condiciona a la autorización del arrendador.",
      },
      {
        type: "h2",
        text: "Lo que dice el artículo 17",
      },
      {
        type: "p",
        text: "El arrendatario no tiene la facultad de ceder el arriendo ni de subarrendar, a menos que medie autorización expresa del arrendador. Si se subarrienda o cede sin esa autorización, el arrendador puede dar por terminado el contrato y exigir la entrega del inmueble, o celebrar un nuevo contrato con quienes lo estén ocupando, quedando sin efecto el contrato anterior.",
      },
      {
        type: "h2",
        text: "Si vas a autorizarlo, hazlo por escrito",
      },
      {
        type: "ul",
        items: [
          "Deja la autorización por escrito, idealmente como anexo o cláusula del contrato.",
          "Identifica al subarrendatario o cesionario y el alcance (total o parcial, por qué tiempo).",
          "Aclara que el arrendatario original sigue respondiendo, salvo que se pacte algo distinto en la cesión.",
        ],
      },
      {
        type: "note",
        text: "Sin autorización expresa, el subarriendo o la cesión exponen al arrendatario a la terminación del contrato. Ante la duda, pídela siempre por escrito.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, art. 17 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "Ley 820 de 2003 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "reparaciones-arriendo-arrendador-arrendatario",
    title: "Reparaciones en el arriendo: ¿qué le toca al arrendador y qué al arrendatario?",
    description:
      "Cómo se reparten las reparaciones en un arriendo de vivienda urbana según la Ley 820 de 2003 y el Código Civil: necesarias a cargo del arrendador y locativas a cargo del arrendatario.",
    datePublished: "2026-06-26",
    dateModified: "2026-06-26",
    category: "guia",
    categoryLabel: BLOG_CATEGORIES.guia.label,
    keywords: [
      "reparaciones arriendo",
      "reparaciones locativas",
      "obligaciones arrendador Ley 820",
      "quién paga arreglos arriendo",
    ],
    blocks: [
      {
        type: "p",
        text: "Una de las discusiones más comunes en un arriendo es quién paga los arreglos. La regla general combina la Ley 820 de 2003 con el Código Civil: el arrendador debe mantener el inmueble en estado de servir para lo arrendado, y el arrendatario responde por el cuidado y las reparaciones derivadas del uso normal.",
      },
      {
        type: "h2",
        text: "A cargo del arrendador (reparaciones necesarias)",
      },
      {
        type: "ul",
        items: [
          "Entregar el inmueble en buen estado y mantenerlo apto para habitar (Ley 820, art. 9).",
          "Reparaciones necesarias que no provengan del uso normal: estructura, redes, daños no imputables al arrendatario.",
          "Responder por los daños y vicios del inmueble que impidan su goce.",
        ],
      },
      {
        type: "h2",
        text: "A cargo del arrendatario (reparaciones locativas)",
      },
      {
        type: "ul",
        items: [
          "Cuidar el inmueble como un buen padre de familia y usarlo según lo pactado (Ley 820, art. 22).",
          "Reparaciones locativas: las que provienen del uso y goce normal (chapas, vidrios, pequeñas filtraciones por uso, etc.).",
          "Devolver el inmueble en el estado en que lo recibió, salvo el deterioro natural por el tiempo y el uso legítimo.",
        ],
      },
      {
        type: "note",
        text: "Por eso el inventario inicial es clave: documenta el estado de entrega para distinguir el deterioro normal del daño imputable. Pacta en el contrato cómo se manejan las reparaciones urgentes.",
      },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, arts. 9 y 22 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
          { label: "Código Civil colombiano (arrendamiento, reparaciones) — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/codigo_civil.html" },
        ],
      },
      ctaIngresar,
    ],
  },
  {
    slug: "inquilino-no-paga-arriendo-que-hacer",
    title: "El inquilino no paga el arriendo: qué hacer paso a paso (Colombia)",
    description:
      "Guía práctica y legal cuando el arrendatario se atrasa: requerimiento por escrito, intereses de mora, conciliación y el proceso de restitución del inmueble (CGP art. 384).",
    datePublished: "2026-08-25",
    dateModified: "2026-08-25",
    category: "guia",
    categoryLabel: BLOG_CATEGORIES.guia.label,
    featured: true,
    keywords: [
      "inquilino no paga arriendo",
      "qué hacer si no pagan el arriendo",
      "proceso de restitución del inmueble",
      "mora en el arriendo Colombia",
      "desalojo por no pago",
    ],
    blocks: [
      {
        type: "p",
        text: "Que el arrendatario se atrase en el pago es una de las mayores preocupaciones al arrendar. La buena noticia es que la ley te da un camino claro. Lo importante es actuar con calma, dejar constancia de todo y respetar el debido proceso: no puedes cambiar las cerraduras, cortar servicios ni sacar a la persona por tu cuenta. El desalojo lo ordena un juez.",
      },
      { type: "h2", text: "1. Comunícate por escrito y deja constancia" },
      {
        type: "p",
        text: "Apenas haya mora, envía un requerimiento por escrito (correo, WhatsApp o carta) recordando el valor adeudado, la fecha de vencimiento y solicitando el pago en un plazo corto. Guarda la evidencia: fecha, medio y respuesta. Esa constancia es decisiva si el caso escala.",
      },
      { type: "h2", text: "2. Cobra los intereses de mora permitidos" },
      {
        type: "p",
        text: "El atraso puede generar intereses de mora. No inventes cifras: usa el tope legal vigente y déjalo por escrito en tu cobro para que sea transparente y exigible.",
      },
      { type: "cta", href: "/calculadoras", label: "Ver calculadoras (mora, canon, preaviso)", description: "Herramientas gratis para calcular con cifras correctas." },
      { type: "h2", text: "3. Intenta una conciliación" },
      {
        type: "p",
        text: "Antes de un proceso judicial suele ser obligatorio o muy recomendable intentar una conciliación (por ejemplo, en un centro de conciliación o ante autoridad competente). Es más rápido y económico, y muchas veces se llega a un acuerdo de pago.",
      },
      { type: "h2", text: "4. Proceso de restitución del inmueble" },
      {
        type: "p",
        text: "Si no hay acuerdo, el arrendador puede iniciar el proceso de restitución del inmueble arrendado por mora (proceso verbal especial, art. 384 del Código General del Proceso). Con la demanda se pueden pedir medidas para agilizar la entrega; la sentencia ordena la restitución y el pago de lo adeudado. Es un trámite judicial: hazlo con un abogado.",
      },
      {
        type: "note",
        text: "Nunca hagas justicia por tu cuenta (cambiar cerraduras, cortar agua o luz, retener bienes). Eso puede volverse en tu contra. El único camino para el desalojo es el judicial.",
      },
      {
        type: "table",
        caption: "Ruta cuando el inquilino no paga",
        headers: ["Paso", "Qué haces", "Constancia que guardas"],
        rows: [
          ["1. Requerimiento", "Cobras por escrito y das un plazo", "Correo/WhatsApp con fecha y respuesta"],
          ["2. Intereses de mora", "Sumas el interés permitido", "Cálculo y cobro escrito"],
          ["3. Conciliación", "Invitas a un acuerdo de pago", "Acta o constancia de citación"],
          ["4. Restitución (art. 384 CGP)", "Demandas con abogado", "Contrato, comprobantes y evidencias"],
        ],
      },
      {
        type: "p",
        text: "Con ArriendoSeguro llegas mejor preparado a cualquiera de estos pasos: recordatorios de pago automáticos, registro de cada pago con su comprobante, evidencia de las comunicaciones y un expediente listo para exportar si el caso llega a conciliación o a un juzgado.",
      },
      ctaIngresar,
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html" },
          { label: "Código General del Proceso (Ley 1564 de 2012), art. 384 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_1564_2012.html" },
        ],
      },
    ],
  },
  {
    slug: "contrato-arriendo-whatsapp-verbal-validez-colombia",
    title: "Contrato de arriendo por WhatsApp o verbal: ¿es válido en Colombia?",
    description:
      "Un acuerdo de arriendo puede ser verbal o escrito, pero probar lo pactado es otra cosa. Qué dice la Ley 820, por qué conviene el contrato escrito y cómo la firma electrónica también es válida.",
    datePublished: "2026-08-25",
    dateModified: "2026-08-25",
    category: "contrato",
    categoryLabel: BLOG_CATEGORIES.contrato.label,
    keywords: [
      "contrato de arriendo verbal",
      "contrato de arriendo por WhatsApp",
      "validez contrato de arrendamiento",
      "contrato de arriendo escrito Colombia",
      "Ley 820 contrato",
    ],
    blocks: [
      {
        type: "p",
        text: "Es una de las dudas más comunes: acordé el arriendo por WhatsApp o de palabra, ¿vale? En Colombia el contrato de arrendamiento de vivienda urbana puede celebrarse de forma verbal o escrita (Ley 820 de 2003, art. 3). Es decir, el acuerdo puede existir sin papel. El problema no es la validez, sino la PRUEBA: si hay un desacuerdo, ¿cómo demuestras lo que se pactó?",
      },
      { type: "h2", text: "Válido no es lo mismo que probable" },
      {
        type: "p",
        text: "Un acuerdo verbal o por chat es válido, pero si el inquilino no paga, hay daños o se discute el canon y las condiciones, tendrás que demostrar qué se acordó. Sin un documento claro, todo queda a interpretación y a tu palabra contra la otra.",
      },
      { type: "h2", text: "Por qué conviene el contrato escrito y firmado" },
      {
        type: "ul",
        items: [
          "Deja por escrito el canon, la duración, el día de pago y las cláusulas.",
          "Permite validar el tope legal del canon (1 % del valor comercial, Ley 820).",
          "Fija el preaviso y las causales de terminación, evitando sorpresas.",
          "Sirve de prueba en una conciliación o ante un juez.",
        ],
      },
      { type: "h2", text: "La firma electrónica también es válida" },
      {
        type: "p",
        text: "No necesitas ir a una notaría para que tenga valor: la firma electrónica tiene validez legal (Ley 527 de 1999 y Decreto 2364 de 2012) por el principio de equivalencia funcional, siempre que quede evidencia de quién firmó, cuándo y desde dónde. Así tu contrato queda firmado y con respaldo probatorio.",
      },
      {
        type: "note",
        text: "Consejo: puedes acordar rápido por WhatsApp, pero pásalo a un contrato escrito y fírmalo. Toma minutos y te evita problemas grandes después.",
      },
      { type: "cta", href: "/ingresar", label: "Crear mi contrato escrito y firmarlo", description: "Genera el contrato conforme a la Ley 820 y fírmalo con validez, en minutos." },
      {
        type: "sources",
        items: [
          { label: "Ley 820 de 2003, art. 3 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html" },
          { label: "Ley 527 de 1999 — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html" },
        ],
      },
    ],
  },
  {
    slug: "como-saber-si-inquilino-es-confiable-documentos",
    title: "Cómo saber si un inquilino es confiable: qué documentos pedir",
    description:
      "Guía para arrendadores: qué soportes de ingresos pedir, cómo consultar el historial con autorización (Habeas Data) y qué garantías exigir para bajar el riesgo de no pago.",
    datePublished: "2026-08-25",
    dateModified: "2026-08-25",
    category: "guia",
    categoryLabel: BLOG_CATEGORIES.guia.label,
    keywords: [
      "cómo saber si un inquilino es confiable",
      "documentos para arrendar a un inquilino",
      "estudio del arrendatario",
      "soportes de ingresos arriendo",
      "referencias inquilino Colombia",
    ],
    blocks: [
      {
        type: "p",
        text: "Elegir bien al inquilino es la mejor forma de prevenir problemas. No se trata de desconfiar de todos, sino de pedir lo razonable, con su consentimiento, y verificar que pueda pagar. Aquí tienes qué documentos pedir y cómo evaluar sin caer en discriminación ni violar la protección de datos.",
      },
      { type: "h2", text: "1. Identidad y capacidad de pago" },
      {
        type: "ul",
        items: [
          "Documento de identidad (cédula) para confirmar quién es.",
          "Soportes de ingresos: certificación laboral y colillas de pago, o extractos bancarios si es independiente.",
          "Regla práctica: los ingresos suelen ser al menos dos o tres veces el canon, para que el pago sea sostenible.",
        ],
      },
      { type: "h2", text: "2. Historial y referencias (con autorización)" },
      {
        type: "p",
        text: "Puedes evaluar el historial crediticio del interesado SIEMPRE con su autorización expresa, respetando el Habeas Data (Ley 1581 de 2012 y Ley 1266 de 2008). También ayudan las referencias de arrendamientos anteriores: pregunta al arrendador previo si pagaba a tiempo y cuidaba el inmueble.",
      },
      { type: "h2", text: "3. Garantías: codeudor o póliza" },
      {
        type: "p",
        text: "Para respaldar el pago puedes pedir un codeudor solidario (que responde por la deuda) o aceptar una póliza o seguro de arrendamiento. Elige según tu nivel de riesgo y lo que la otra parte pueda ofrecer.",
      },
      {
        type: "note",
        text: "Pide siempre con consentimiento y solo lo necesario. No condiciones el arriendo por razones discriminatorias; enfócate en la capacidad de pago y las referencias.",
      },
      {
        type: "table",
        caption: "Qué pedir y para qué",
        headers: ["Documento", "Para qué sirve"],
        rows: [
          ["Cédula", "Confirmar identidad"],
          ["Carta laboral / colillas / extractos", "Verificar ingresos y capacidad de pago"],
          ["Autorización de datos", "Consultar historial sin violar el Habeas Data"],
          ["Referencias de arriendos previos", "Conocer su comportamiento como inquilino"],
          ["Codeudor o póliza", "Respaldo si deja de pagar"],
        ],
      },
      {
        type: "p",
        text: "En ArriendoSeguro defines qué documentos exiges a cada parte, el inquilino y el codeudor los suben por su propio enlace, y la app valida los datos con inteligencia artificial y te avisa si algo no coincide.",
      },
      ctaIngresar,
      {
        type: "sources",
        items: [
          { label: "Ley 1581 de 2012 (Habeas Data) — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html" },
          { label: "Ley 1266 de 2008 (habeas data financiero) — Secretaría del Senado", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_1266_2008.html" },
        ],
      },
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
