/**
 * Recomendaciones de captura para que la validación por IA lea bien el documento.
 * Se muestra junto a las pantallas de subida de documentos/soportes.
 */
export function UploadPhotoTip({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 rounded-lg bg-[#ECE9FB]/70 px-2.5 py-1.5 text-[11px] leading-snug text-[#5646E5] ${className}`}>
      <span aria-hidden="true">📸</span>
      <span>
        Para que se lea bien: súbelo <b>derecho</b> (no al revés ni inclinado), con <b>buena luz</b>, el documento{" "}
        <b>completo</b> y sin reflejos. Si es una foto, <b>recorta solo el documento</b> (sin publicidad, sellos de correo
        ni otras hojas). Un PDF nítido funciona mejor que una foto.
      </span>
    </p>
  );
}
