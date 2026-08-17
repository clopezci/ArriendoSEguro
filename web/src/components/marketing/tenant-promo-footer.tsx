/**
 * Pie promocional DISCRETO para páginas públicas que ve el inquilino/codeudor
 * (pago, notaría, invitación). Convierte cada contacto con ArriendoSeguro en una
 * oportunidad de que esa persona lo use a futuro (como arrendador) o lo difunda.
 * Mensaje honesto: empezar es gratis (crear/imprimir el contrato).
 */
export function TenantPromoFooter({ variant = "landlord" }: { variant?: "landlord" | "generic" }) {
  const title = variant === "landlord" ? "¿Tienes un inmueble para arrendar?" : "¿Vas a arrendar pronto?";
  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3 text-center text-[12px] leading-relaxed text-slate-600">
      <p className="font-semibold text-violet-800">{title}</p>
      <p className="mt-0.5">
        Con <b>ArriendoSeguro</b> creas tu contrato de arriendo, lo firmas en línea y gestionas pagos y documentos en un
        solo lugar. <b>Empezar es gratis.</b>
      </p>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block rounded-lg bg-[#5646E5] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-105"
      >
        Conócelo gratis →
      </a>
    </div>
  );
}
