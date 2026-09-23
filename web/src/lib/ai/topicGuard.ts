import "server-only";

/**
 * Limitador de alcance para los puntos de IA conversacional. Mantiene la IA
 * enfocada SOLO en el negocio (arriendo + ArriendoSeguro / temas legales del
 * arriendo). Si el usuario pregunta cultura general u otros temas ajenos, la IA
 * debe devolver un token centinela y el servidor lo reemplaza por un mensaje
 * predeterminado.
 *
 * Diseño para NO equivocarse (evitar falsos positivos, que son lo dañino):
 * el alcance se describe de forma GENEROSA y la instrucción dice explícitamente
 * que ante la duda responda con normalidad. Solo lo claramente ajeno se corta.
 */

/** Token que la IA debe devolver (y solo eso) cuando la pregunta es ajena. */
export const OFF_TOPIC_TOKEN = "FUERA_DE_ALCANCE";

/**
 * Instrucción de alcance para anexar al `system`. `scope` describe, en lenguaje
 * natural y amplio, de qué SÍ se puede hablar en ese punto.
 */
export function scopeInstruction(scope: string): string {
  return (
    "\n\nALCANCE (OBLIGATORIO): solo puedes ayudar con " +
    scope +
    ". Si la pregunta del usuario claramente NO tiene relación con eso " +
    "(por ejemplo: cultura general, matemáticas, programación, recetas, noticias, deportes, " +
    "entretenimiento, salud, política u otros temas ajenos), NO la respondas: responde EXACTAMENTE " +
    "con el texto " +
    OFF_TOPIC_TOKEN +
    " y nada más. Muy importante: ante la MENOR duda, o si hay CUALQUIER relación razonable con el alcance, " +
    "responde con normalidad y NO uses ese texto. Un saludo, una duda sobre cómo usar la app, o una pregunta " +
    "sobre arriendo, contrato, cláusulas, pagos o leyes del arriendo SIEMPRE están dentro del alcance."
  );
}

/**
 * ¿La respuesta de la IA indica que la pregunta quedó fuera de alcance? Detecta el
 * token aunque venga con puntuación o comillas, pero exige que la respuesta sea
 * esencialmente el token (respuesta corta), para no confundir una respuesta legítima
 * que mencione el tema de pasada.
 */
export function isOffTopic(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length > 60) return false; // una respuesta real es más larga que el centinela
  const normalized = trimmed.toUpperCase().replace(/[^A-Z_]/g, "");
  return normalized === OFF_TOPIC_TOKEN || normalized.includes(OFF_TOPIC_TOKEN);
}

/** Mensaje predeterminado que se le muestra al usuario cuando pregunta algo ajeno. */
export function offTopicMessage(feature: "assistant" | "legal"): string {
  if (feature === "legal") {
    return (
      "Solo puedo orientarte en temas legales del arrendamiento de vivienda en Colombia " +
      "(Ley 820, Código Civil, firma electrónica Ley 527 y protección de datos Ley 1581). " +
      "Para otros temas, te recomiendo una herramienta general o un profesional del área. " +
      "¿Tienes alguna duda sobre tu arriendo?"
    );
  }
  return (
    "Solo puedo ayudarte con tu arriendo y con el uso de ArriendoSeguro: crear, firmar y administrar " +
    "tu contrato, cláusulas, canon, inquilino/codeudor, pagos, inventario, reputación y los planes de la app. " +
    "Para otros temas, te recomiendo una herramienta general. ¿En qué te ayudo con tu arriendo?"
  );
}
