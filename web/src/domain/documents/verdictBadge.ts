/**
 * Texto + estilo (Tailwind) del veredicto de la validación IA de un documento
 * soporte. Asistivo y NO bloqueante. Compartido por las listas de soportes.
 */
export type SupportVerdict = { status: string; label?: string; reason?: string };

const AMBER = "border-amber-300 bg-amber-50 text-amber-800";
const RED = "border-rose-300 bg-rose-50 text-rose-700";

/**
 * Regla de seguridad (antifraude): NUNCA damos "verde" ni silencio cuando no hubo
 * una comparación real y positiva. Solo `match` es verde. Cualquier duda, fallo de
 * la IA o falta de datos para comparar se muestra como ALERTA ámbar "valida
 * manualmente", para no darle al dueño un falso "todo bien".
 */
export function verdictBadge(v: SupportVerdict, label?: string): { text: string; cls: string } | null {
  const l = v.label || label || "documento";
  switch (v.status) {
    case "checking":
      return { text: "Revisando con IA…", cls: "border-slate-200 bg-slate-50 text-slate-500" };
    case "match":
      return { text: "✓ Coincide", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "mismatch":
      return { text: "⚠ Nombre/número NO coincide — revisa el documento", cls: RED };
    case "wrong_type":
      return { text: `⚠ No parece ser ${l} — revísalo`, cls: RED };
    case "unreadable":
      return { text: "⚠ No se pudo leer — valídalo manualmente", cls: AMBER };
    case "unclear":
      return { text: "⚠ No se pudo comparar el nombre — valídalo manualmente", cls: AMBER };
    case "skipped": {
      const scanned = ["pdf_scanned", "doc_legacy", "unsupported_format", "pdf_error", "docx_error", "docx_empty"].includes(
        v.reason ?? "",
      );
      if (scanned) return { text: "⚠ No se pudo leer (escaneado) — revísalo a ojo", cls: AMBER };
      if ((v.reason ?? "") === "ai_off" || (v.reason ?? "") === "provider_error")
        return { text: "⚠ Validación por IA no disponible — valídalo manualmente", cls: AMBER };
      return { text: "⚠ No validado — valídalo manualmente", cls: AMBER };
    }
    default:
      return { text: "⚠ Sin validar — valídalo manualmente", cls: AMBER };
  }
}
