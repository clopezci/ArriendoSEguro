"use client";

// Compatibilidad: el botón vive ahora en `read-aloud.tsx` junto al provider y los
// controles globales (pausa/continuar/velocidad). Se re-exporta para conservar
// los imports existentes.
export { ReadAloudButton } from "./read-aloud";
