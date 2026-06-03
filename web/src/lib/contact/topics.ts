/** Temas del formulario de contacto. Compartido entre cliente y servidor. */
export const CONTACT_TOPICS = [
  "Soporte con la plataforma",
  "Pregunta sobre contratos o firma",
  "Facturación o Plan Plus",
  "Tratamiento de datos / privacidad",
  "Alianzas o prensa",
  "Otro",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];
