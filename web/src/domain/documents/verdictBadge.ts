/**
 * Texto + estilo (Tailwind) del veredicto de la validación IA de un documento
 * soporte. Asistivo y NO bloqueante. Compartido por las listas de soportes.
 */
export type SupportVerdict = { status: string; label?: string; reason?: string };

export function verdictBadge(v: SupportVerdict, label?: string): { text: string; cls: string } | null {
  const l = v.label || label || "documento";
  switch (v.status) {
    case "checking":
      return { text: "Revisando con IA…", cls: "border-slate-200 bg-slate-50 text-slate-500" };
    case "match":
      return { text: "✓ Coincide", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "mismatch":
      return { text: "⚠ Nombre/número no coincide", cls: "border-rose-300 bg-rose-50 text-rose-700" };
    case "wrong_type":
      return { text: `⚠ No parece ser ${l}`, cls: "border-rose-300 bg-rose-50 text-rose-700" };
    case "unreadable":
      return { text: "No se pudo leer (revisa a ojo)", cls: "border-amber-200 bg-amber-50 text-amber-700" };
    case "skipped":
      return ["pdf_scanned", "doc_legacy", "unsupported_format", "pdf_error", "docx_error", "docx_empty"].includes(v.reason ?? "")
        ? { text: "No se pudo leer (escaneado); revisa a ojo", cls: "border-amber-200 bg-amber-50 text-amber-700" }
        : null;
    default:
      return null;
  }
}
