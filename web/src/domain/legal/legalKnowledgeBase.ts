/**
 * Base de conocimiento normativo (Colombia) para respuestas con RESPALDO REAL.
 *
 * Cada entrada cita una norma vigente con su artículo y un enlace a la fuente
 * OFICIAL para verificar el texto. Los resúmenes son orientativos (no sustituyen
 * asesoría jurídica) y deben mantenerse fieles a la norma: NO inventar.
 *
 * Se usa como contexto ("RAG") del endpoint /api/legal/ask: se recuperan las
 * entradas más relevantes a la pregunta y se le pide a la IA responder SOLO con
 * base en ese contexto, citando la fuente.
 */

export type LegalEntry = {
  id: string;
  law: string;        // Nombre de la norma
  ref: string;        // Artículo/sección
  title: string;      // Tema
  summary: string;    // Resumen fiel y orientativo
  keywords: string[]; // Para la recuperación por similitud simple
  url: string;        // Fuente oficial
};

const SS = "http://www.secretariasenado.gov.co/senado/basedoc"; // Secretaría del Senado (textos oficiales)

export const LEGAL_KB: LegalEntry[] = [
  // ===================== LEY 820 DE 2003 (arrendamiento de vivienda urbana) =====================
  {
    id: "l820-obj",
    law: "Ley 820 de 2003",
    ref: "Arts. 1–2",
    title: "Objeto y contrato de arrendamiento de vivienda urbana",
    summary:
      "La Ley 820 de 2003 regula el arrendamiento de vivienda urbana. El contrato es aquel por el cual las partes acuerdan, la una, conceder el goce de un inmueble urbano destinado a vivienda y, la otra, pagar por ese goce un precio (canon). Puede constar por escrito o de palabra, pero se recomienda escrito.",
    keywords: ["arrendamiento", "vivienda", "urbana", "contrato", "definicion", "objeto", "canon", "goce"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-canon",
    law: "Ley 820 de 2003",
    ref: "Art. 18",
    title: "Precio del arrendamiento (canon máximo)",
    summary:
      "El canon mensual lo fijan las partes, pero NO puede exceder el uno por ciento (1%) del valor comercial del inmueble o de la parte que se arrienda. Ese valor comercial no puede superar el equivalente a dos veces el avalúo catastral vigente.",
    keywords: ["canon", "precio", "1%", "uno por ciento", "valor comercial", "avaluo", "catastral", "maximo", "tope", "renta"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-reajuste",
    law: "Ley 820 de 2003",
    ref: "Art. 20",
    title: "Reajuste anual del canon",
    summary:
      "Cada doce (12) meses de ejecución del contrato, el arrendador puede incrementar el canon en una proporción que no sea superior al cien por ciento (100%) del incremento del IPC (índice de precios al consumidor) del año calendario inmediatamente anterior. El arrendador debe informar el nuevo canon y la fecha desde la cual rige.",
    keywords: ["reajuste", "incremento", "aumento", "anual", "ipc", "12 meses", "subir canon", "actualizacion"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-deposito",
    law: "Ley 820 de 2003",
    ref: "Art. 16",
    title: "Prohibición de depósitos y cauciones reales",
    summary:
      "En el arrendamiento de vivienda urbana NO se pueden exigir depósitos en dinero ni otras cauciones reales para garantizar el cumplimiento (por ejemplo, pedir uno o dos meses de arriendo 'en depósito'). Para garantizar se admiten garantías o fianzas personales (codeudor) u otras admitidas por la ley.",
    keywords: ["deposito", "caucion", "garantia", "prohibido", "meses de deposito", "codeudor", "fiador", "fianza", "consignar"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-termino",
    law: "Ley 820 de 2003",
    ref: "Art. 5",
    title: "Término y prórroga del contrato",
    summary:
      "El término del contrato es el que acuerden las partes; a falta de estipulación se entiende por doce (12) meses. El contrato se prorroga automáticamente por un término igual, siempre que las partes cumplan sus obligaciones y se paguen los reajustes autorizados.",
    keywords: ["termino", "duracion", "12 meses", "prorroga", "renovacion", "automatica", "vigencia", "plazo"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-oblig-arrendador",
    law: "Ley 820 de 2003",
    ref: "Art. 8",
    title: "Obligaciones del arrendador",
    summary:
      "El arrendador debe: entregar al arrendatario el inmueble en buen estado de servicio, seguridad y sanidad; mantener el bien en estado de servir para el fin arrendado (reparaciones necesarias, salvo daños del arrendatario); y garantizar el goce pacífico del inmueble durante el contrato.",
    keywords: ["obligaciones", "arrendador", "dueño", "entregar", "buen estado", "reparaciones", "mantenimiento", "goce"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-oblig-arrendatario",
    law: "Ley 820 de 2003",
    ref: "Art. 9",
    title: "Obligaciones del arrendatario",
    summary:
      "El arrendatario debe: pagar el canon en el lugar y plazo pactados; cuidar el inmueble y darle el uso convenido; pagar los servicios, cosas o usos conexos y adicionales pactados; y devolver el inmueble al terminar el contrato en el estado en que lo recibió, salvo el deterioro natural por el uso legítimo.",
    keywords: ["obligaciones", "arrendatario", "inquilino", "pagar", "canon", "cuidar", "servicios", "devolver", "uso"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-servicios",
    law: "Ley 820 de 2003",
    ref: "Art. 15",
    title: "Servicios públicos: garantía y solidaridad",
    summary:
      "Para amparar el pago de los servicios públicos del inmueble arrendado, las partes pueden constituir garantías o fianzas. El arrendador puede exigir al arrendatario la constitución de garantías o cauciones para asegurar el pago de los servicios que queden a cargo del arrendatario, cumpliendo el procedimiento que fija la ley para evitar que el propietario quede obligado solidariamente por deudas de servicios.",
    keywords: ["servicios publicos", "agua", "luz", "gas", "solidaridad", "garantia", "colillas", "deuda", "recibo"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-subarriendo",
    law: "Ley 820 de 2003",
    ref: "Art. 17",
    title: "Cesión y subarriendo",
    summary:
      "El arrendatario NO puede ceder el contrato ni subarrendar el inmueble sin la autorización expresa del arrendador. Si lo hace sin autorización, el arrendador puede dar por terminado el contrato y exigir la restitución, o considerar como arrendatario al subarrendatario.",
    keywords: ["subarriendo", "subarrendar", "cesion", "ceder", "autorizacion", "tercero", "realquilar"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-term-arrendador",
    law: "Ley 820 de 2003",
    ref: "Art. 22",
    title: "Terminación por parte del arrendador",
    summary:
      "El arrendador puede terminar el contrato durante su vigencia por causales como: no pago del canon o de servicios/cuotas a cargo del arrendatario; subarriendo o cesión no autorizados; cambio de destinación del inmueble; deterioro no atribuible al uso normal; y realización de mejoras/obras no autorizadas. También puede terminar a la fecha de vencimiento con preaviso y, en ciertos casos de terminación unilateral, con indemnización y preaviso conforme a la ley.",
    keywords: ["terminacion", "arrendador", "desalojo", "no pago", "mora", "causales", "restitucion", "preaviso", "indemnizacion"],
    url: `${SS}/ley_0820_2003.html`,
  },
  {
    id: "l820-term-arrendatario",
    law: "Ley 820 de 2003",
    ref: "Art. 24",
    title: "Terminación por parte del arrendatario",
    summary:
      "El arrendatario puede terminar unilateralmente el contrato dentro del término inicial o en las prórrogas, avisando por escrito con la antelación que fije la ley (preaviso) y pagando la indemnización que la ley señale, salvo acuerdo distinto. También puede terminar por incumplimiento del arrendador (por ejemplo, suspensión de servicios a su cargo, perturbación grave del goce o desconocimiento de sus derechos), caso en el cual la ley no contempla indemnización a su cargo. Los montos y el procedimiento exactos se rigen por la Ley 820 de 2003 y sus modificatorias.",
    keywords: ["terminacion", "arrendatario", "inquilino", "entregar antes", "preaviso", "indemnizacion", "irme", "desocupar"],
    url: `${SS}/ley_0820_2003.html`,
  },

  // ===================== CÓDIGO CIVIL (arrendamiento y propiedad) =====================
  {
    id: "cc-arr-def",
    law: "Código Civil",
    ref: "Art. 1973",
    title: "Definición general del arrendamiento",
    summary:
      "El arrendamiento es un contrato en que las dos partes se obligan recíprocamente: la una a conceder el goce de una cosa, o a ejecutar una obra o prestar un servicio, y la otra a pagar por este goce, obra o servicio un precio determinado. Es la base del arrendamiento de cosas (además de la regulación especial de vivienda urbana en la Ley 820).",
    keywords: ["arrendamiento", "definicion", "codigo civil", "goce", "precio", "cosa", "contrato", "general"],
    url: `${SS}/codigo_civil.html`,
  },
  {
    id: "cc-arr-entrega",
    law: "Código Civil",
    ref: "Arts. 1982–1987",
    title: "Obligaciones del arrendador (entrega y mantenimiento)",
    summary:
      "El arrendador está obligado a entregar la cosa arrendada, a mantenerla en estado de servir para el fin del arrendamiento y a librar al arrendatario de toda turbación o embarazo en el goce. Debe hacer las reparaciones necesarias, salvo las locativas, que corresponden por regla general al arrendatario.",
    keywords: ["entrega", "reparaciones", "necesarias", "locativas", "mantener", "turbacion", "obligaciones arrendador", "codigo civil"],
    url: `${SS}/codigo_civil.html`,
  },
  {
    id: "cc-arr-arrendatario",
    law: "Código Civil",
    ref: "Arts. 1996–2005",
    title: "Obligaciones del arrendatario (uso, cuidado y restitución)",
    summary:
      "El arrendatario debe usar la cosa según los términos o el espíritu del contrato, emplear en su conservación el cuidado de un buen padre de familia, responder por los deterioros que provengan de su culpa o de las personas a su cargo, y restituir la cosa al terminar el arrendamiento en el estado en que fue entregada, tomándose en cuenta el deterioro por uso y goce legítimos.",
    keywords: ["arrendatario", "uso", "cuidado", "deterioro", "restituir", "devolver", "conservacion", "codigo civil"],
    url: `${SS}/codigo_civil.html`,
  },
  {
    id: "cc-propiedad",
    law: "Código Civil",
    ref: "Art. 669",
    title: "Derecho de dominio (propiedad)",
    summary:
      "El dominio (propiedad) es el derecho real sobre una cosa corporal para gozar y disponer de ella, no siendo contra ley o contra derecho ajeno. Es el respaldo de que quien arrienda tenga la facultad de hacerlo (como propietario o mediante poder/autorización del propietario).",
    keywords: ["propiedad", "dominio", "propietario", "titular", "derecho real", "gozar", "disponer", "propiedad raiz"],
    url: `${SS}/codigo_civil.html`,
  },
  {
    id: "cc-tradicion",
    law: "Código Civil",
    ref: "Arts. 673, 756",
    title: "Tradición y registro de la propiedad inmueble",
    summary:
      "La propiedad de los bienes inmuebles se transfiere por la tradición, que respecto de inmuebles se hace mediante la inscripción del título en la Oficina de Registro de Instrumentos Públicos. Por eso el Certificado de Tradición y Libertad es la prueba idónea de quién es el propietario de un inmueble.",
    keywords: ["tradicion", "registro", "instrumentos publicos", "certificado de tradicion", "libertad", "propietario", "escritura", "inmueble"],
    url: `${SS}/codigo_civil.html`,
  },

  // ===================== LEY 527 DE 1999 (mensajes de datos y firma electrónica) =====================
  {
    id: "l527-mensajes",
    law: "Ley 527 de 1999",
    ref: "Arts. 5, 10, 11",
    title: "Validez y fuerza probatoria de los mensajes de datos",
    summary:
      "No se niegan efectos jurídicos, validez ni fuerza obligatoria a una información por estar en forma de mensaje de datos. Los mensajes de datos son admisibles como medio de prueba y su fuerza probatoria se valora conforme a las reglas de la sana crítica, teniendo en cuenta su confiabilidad, integridad e identificación de su iniciador.",
    keywords: ["mensaje de datos", "electronico", "validez", "prueba", "fuerza probatoria", "digital", "documento electronico"],
    url: `${SS}/ley_0527_1999.html`,
  },
  {
    id: "l527-firma",
    law: "Ley 527 de 1999",
    ref: "Art. 7",
    title: "Firma electrónica (equivalente funcional de la firma)",
    summary:
      "Cuando la ley exija una firma, ese requisito se entiende satisfecho en un mensaje de datos si se ha utilizado un método que permita identificar al iniciador y indicar que aprueba el contenido, y ese método es tan confiable como resulte apropiado para los fines del mensaje. Es la base legal de la firma electrónica del contrato en ArriendoSeguro.",
    keywords: ["firma", "electronica", "firma electronica", "equivalente funcional", "identificar", "aprobar", "otp", "codigo"],
    url: `${SS}/ley_0527_1999.html`,
  },

  // ===================== LEY 1581 DE 2012 + DECRETO 1074 DE 2015 (protección de datos) =====================
  {
    id: "l1581-principios",
    law: "Ley 1581 de 2012",
    ref: "Art. 4",
    title: "Principios del tratamiento de datos personales",
    summary:
      "El tratamiento de datos personales se rige por principios como legalidad, finalidad, libertad, veracidad/calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad. Los datos solo pueden tratarse para finalidades legítimas informadas al titular.",
    keywords: ["datos personales", "habeas data", "principios", "finalidad", "tratamiento", "privacidad", "proteccion de datos"],
    url: `${SS}/ley_1581_2012.html`,
  },
  {
    id: "l1581-autorizacion",
    law: "Ley 1581 de 2012",
    ref: "Art. 9",
    title: "Autorización previa del titular",
    summary:
      "El tratamiento de datos personales requiere la autorización previa e informada del titular, salvo las excepciones legales. La autorización puede constar por cualquier medio que pueda ser objeto de consulta posterior. Por eso la app pide autorización al tratar documentos y datos.",
    keywords: ["autorizacion", "consentimiento", "titular", "previa", "informada", "datos", "habeas data", "tratamiento"],
    url: `${SS}/ley_1581_2012.html`,
  },
  {
    id: "l1581-derechos",
    law: "Ley 1581 de 2012",
    ref: "Art. 8",
    title: "Derechos del titular de los datos",
    summary:
      "El titular puede conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; ser informado del uso dado a sus datos; presentar quejas ante la SIC por infracciones; revocar la autorización y/o solicitar la supresión cuando proceda; y acceder gratuitamente a sus datos.",
    keywords: ["derechos", "titular", "conocer", "actualizar", "rectificar", "suprimir", "revocar", "sic", "habeas data"],
    url: `${SS}/ley_1581_2012.html`,
  },
  {
    id: "d1074-rnbd",
    law: "Decreto 1074 de 2015 (DUR Comercio)",
    ref: "Libro 2, Parte 2, Título 2 (Cap. 25 y ss.)",
    title: "Reglamentación de la protección de datos (RNBD)",
    summary:
      "El Decreto Único Reglamentario del sector Comercio, Industria y Turismo (1074 de 2015) compila la reglamentación de la Ley 1581, incluyendo la política de tratamiento, el manejo de la autorización, la atención de consultas y reclamos y el Registro Nacional de Bases de Datos (RNBD) ante la Superintendencia de Industria y Comercio.",
    keywords: ["decreto 1074", "reglamento", "rnbd", "registro nacional de bases de datos", "sic", "politica de tratamiento", "datos"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=76608",
  },
];

/** Normaliza texto para comparar (minúsculas, sin tildes, solo letras/números). */
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["de", "la", "el", "los", "las", "un", "una", "y", "o", "en", "que", "por", "para", "del", "al", "con", "se", "mi", "su", "es", "como", "cual", "cuanto", "puedo", "debe", "hay"]);

/**
 * Recupera las entradas más relevantes a una pregunta (similitud simple por
 * palabras clave). Devuelve hasta `k` entradas ordenadas por relevancia.
 */
export function retrieveLegalContext(question: string, k = 6): LegalEntry[] {
  const q = norm(question);
  const tokens = q.split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
  if (tokens.length === 0) return [];
  const scored = LEGAL_KB.map((e) => {
    const hay = norm(e.keywords.join(" ") + " " + e.title + " " + e.summary + " " + e.law);
    let score = 0;
    for (const t of tokens) {
      if (e.keywords.some((kw) => norm(kw).includes(t) || t.includes(norm(kw)))) score += 3;
      else if (hay.includes(t)) score += 1;
    }
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.e);
}
