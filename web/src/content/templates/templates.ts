/**
 * Plantillas/descargas gratuitas para arriendo (modelos orientativos).
 * Contenido real con fundamento legal citado. No sustituyen asesoría jurídica.
 */

export type TemplateBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "sign"; roles: string[] };

export type TemplateSource = { label: string; href: string };

export type Template = {
  slug: string;
  /** Título para SEO y para el hub. */
  title: string;
  /** Descripción para SEO y tarjeta del hub. */
  description: string;
  /** Categoría corta para agrupar en el hub. */
  category: string;
  /** Intro mostrada arriba del documento (no se imprime en la hoja). */
  intro: string;
  /** Título del documento imprimible. */
  docTitle: string;
  /** Cuerpo del documento. Las líneas en blanco se escriben con guiones bajos. */
  blocks: TemplateBlock[];
  sources: TemplateSource[];
};

export const TEMPLATES: Template[] = [
  {
    slug: "carta-preaviso",
    title: "Carta de preaviso de terminación de contrato de arriendo (modelo gratis)",
    description:
      "Modelo de carta para avisar la terminación de un contrato de arrendamiento de vivienda urbana con el preaviso de tres meses (Ley 820 de 2003).",
    category: "Terminación",
    intro:
      "Usa esta carta para dejar constancia escrita del preaviso de terminación. La Ley 820 de 2003 exige avisar con al menos tres (3) meses de anticipación; sin constancia, el contrato se entiende renovado.",
    docTitle: "Comunicación de preaviso de terminación del contrato de arrendamiento",
    blocks: [
      { type: "p", text: "Ciudad y fecha: ______________________________________" },
      { type: "p", text: "Señor(a): ___________________________________________ (arrendador / arrendatario)" },
      { type: "p", text: "Dirección de notificación: ____________________________" },
      { type: "p", text: "Correo electrónico: ___________________________________" },
      {
        type: "p",
        text: "Asunto: Preaviso de terminación del contrato de arrendamiento del inmueble ubicado en ____________________________________________.",
      },
      {
        type: "p",
        text: "Respetado(a) señor(a): por medio de la presente, yo, ____________________________, identificado(a) con ____ No. ______________, en mi calidad de ____________________ (arrendador / arrendatario) del contrato de arrendamiento suscrito el día ____ del mes de ____________ del año ______, le comunico mi decisión de darlo por terminado a su vencimiento.",
      },
      {
        type: "p",
        text: "En consecuencia, y conforme a la Ley 820 de 2003, presento este preaviso con una antelación no inferior a tres (3) meses. La fecha de terminación y entrega del inmueble será el día ____ del mes de ____________ del año ______.",
      },
      {
        type: "p",
        text: "Solicito coordinar la entrega del inmueble, la revisión del inventario y la suscripción del paz y salvo correspondiente. Agradezco confirmar el recibo de esta comunicación.",
      },
      { type: "p", text: "Atentamente," },
      { type: "sign", roles: ["Quien notifica", "Recibido (fecha y firma)"] },
    ],
    sources: [
      { label: "Ley 820 de 2003, arts. 22 a 25 — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
    ],
  },
  {
    slug: "paz-y-salvo",
    title: "Paz y salvo de arriendo (modelo gratis para descargar)",
    description:
      "Modelo de paz y salvo para dejar constancia de que el arrendatario está al día y entregó el inmueble al terminar el contrato de arrendamiento.",
    category: "Cierre",
    intro:
      "Documento para constatar, al finalizar el arriendo, que no quedan obligaciones pendientes (cánones, servicios, daños) y que el inmueble se entregó. Protege a ambas partes.",
    docTitle: "Paz y salvo de terminación del contrato de arrendamiento",
    blocks: [
      { type: "p", text: "Ciudad y fecha: ______________________________________" },
      {
        type: "p",
        text: "Entre el(la) arrendador(a) ____________________________, identificado(a) con ____ No. ______________, y el(la) arrendatario(a) ____________________________, identificado(a) con ____ No. ______________, respecto del inmueble ubicado en ____________________________________________,",
      },
      { type: "h", text: "Hacemos constar que:" },
      {
        type: "ul",
        items: [
          "El contrato de arrendamiento suscrito el ____ / ____ / ______ terminó el ____ / ____ / ______.",
          "El arrendatario entregó el inmueble y las llaves a satisfacción del arrendador.",
          "El arrendatario se encuentra a paz y salvo por concepto de cánones de arrendamiento.",
          "Los servicios públicos se encuentran cancelados a la fecha (o con lecturas registradas en el acta de entrega).",
          "No quedan reclamaciones pendientes por daños distintos al deterioro normal del inmueble.",
        ],
      },
      {
        type: "p",
        text: "Observaciones (si las hay): ____________________________________________________________________________________.",
      },
      {
        type: "p",
        text: "En constancia, firman las partes en señal de conformidad.",
      },
      { type: "sign", roles: ["Arrendador(a)", "Arrendatario(a)"] },
    ],
    sources: [
      { label: "Ley 820 de 2003 (obligaciones de entrega y restitución) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
    ],
  },
  {
    slug: "acta-entrega",
    title: "Acta de entrega del inmueble en arriendo (modelo gratis)",
    description:
      "Modelo de acta de entrega para documentar el estado del inmueble, las lecturas de servicios y las llaves al iniciar o terminar el arriendo.",
    category: "Inventario",
    intro:
      "Registrar el estado del inmueble al inicio (y al final) es tu mejor prueba para distinguir el deterioro normal del daño. Acompáñala de fotos fechadas por zona.",
    docTitle: "Acta de entrega y estado del inmueble",
    blocks: [
      { type: "p", text: "Ciudad y fecha: ______________________________________" },
      { type: "p", text: "Tipo de acta:  ☐ Entrega inicial   ☐ Restitución final" },
      {
        type: "p",
        text: "Inmueble: ____________________________________________. Arrendador(a): ____________________________. Arrendatario(a): ____________________________.",
      },
      { type: "h", text: "Estado por zonas (describe pintura, pisos, ventanas, closets, baños, cocina):" },
      {
        type: "ul",
        items: [
          "Sala / comedor: ____________________________________________",
          "Cocina y electrodomésticos (con seriales): ___________________",
          "Habitaciones y closets: _____________________________________",
          "Baños: ______________________________________________________",
          "Otras zonas (patio, balcón, garaje): ________________________",
        ],
      },
      { type: "h", text: "Lecturas iniciales de servicios públicos:" },
      {
        type: "ul",
        items: [
          "Energía (contador No. __________): lectura __________",
          "Agua (contador No. __________): lectura __________",
          "Gas (contador No. __________): lectura __________",
        ],
      },
      {
        type: "p",
        text: "Llaves y controles entregados: __________. Observaciones: ____________________________________________.",
      },
      {
        type: "p",
        text: "Las partes declaran que el inmueble se entrega/recibe en el estado aquí descrito, acompañado de evidencia fotográfica fechada.",
      },
      { type: "sign", roles: ["Entrega (arrendador/a)", "Recibe (arrendatario/a)"] },
    ],
    sources: [
      { label: "Ley 820 de 2003 (entrega y restitución del inmueble) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
    ],
  },
  {
    slug: "autorizacion-datos",
    title: "Autorización de tratamiento de datos personales (Habeas Data, modelo gratis)",
    description:
      "Modelo de autorización para el tratamiento de datos personales en un arriendo, conforme a la Ley 1581 de 2012 (Habeas Data).",
    category: "Datos personales",
    intro:
      "Antes de recolectar o verificar datos de la otra parte o del codeudor, debes contar con su autorización informada. Este modelo cumple los elementos mínimos de la Ley 1581 de 2012.",
    docTitle: "Autorización para el tratamiento de datos personales",
    blocks: [
      { type: "p", text: "Ciudad y fecha: ______________________________________" },
      {
        type: "p",
        text: "Yo, ____________________________, identificado(a) con ____ No. ______________, en mi calidad de titular de los datos, autorizo de manera previa, expresa e informada a ____________________________ (responsable del tratamiento) para recolectar, almacenar, usar y verificar mis datos personales con la finalidad de evaluar, celebrar y ejecutar un contrato de arrendamiento.",
      },
      { type: "h", text: "Declaro que se me informó:" },
      {
        type: "ul",
        items: [
          "La finalidad del tratamiento (evaluación, suscripción y ejecución del arriendo).",
          "El carácter facultativo de responder preguntas sobre datos sensibles, si las hubiere.",
          "Mis derechos a conocer, actualizar, rectificar y suprimir mis datos, y a revocar esta autorización.",
          "Los canales para ejercer esos derechos ante el responsable.",
        ],
      },
      {
        type: "p",
        text: "Esta autorización se otorga conforme a la Ley 1581 de 2012 y sus decretos reglamentarios. El responsable se compromete a dar un trato confidencial a la información y a no usarla para fines distintos a los aquí señalados.",
      },
      {
        type: "p",
        text: "Canal para ejercer derechos (correo / dirección): ____________________________________________.",
      },
      { type: "sign", roles: ["Titular de los datos", "Responsable del tratamiento"] },
    ],
    sources: [
      { label: "Ley 1581 de 2012 (Habeas Data) — Función Pública", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981" },
      { label: "SIC — Protección de datos personales", href: "https://www.sic.gov.co/proteccion-de-datos-personales" },
    ],
  },
];

export function getTemplateBySlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export function getAllTemplateSlugs(): string[] {
  return TEMPLATES.map((t) => t.slug);
}
