/**
 * Marca de agua y CTA para el contrato generado en el **tier gratuito**.
 *
 * A diferencia del modo demo (que invalida el documento), aquí el contrato SÍ
 * es utilizable: lleva una marca discreta `arriendoseguro.app` y un llamado a la
 * acción en **encabezado y pie** (para que se imprima con el documento) que crea
 * la necesidad de continuar en Plus: el costo es una fracción mínima del valor
 * total del arriendo (canon × meses), y se invita a guardar el contrato con
 * correo/cuenta para retomarlo.
 */

export const FREE_TIER_WATERMARK_TEXT = "arriendoseguro.app";

export type FreeTierCtaOptions = {
  /** Valor total del contrato = canon mensual × meses (COP). */
  totalContractCop?: number;
  /** Precio de referencia de Plus (COP) para calcular el porcentaje. */
  plusPriceCop?: number;
  /** Mostrar invitación a dejar correo / crear cuenta (flujo sin sesión). */
  promptAccount?: boolean;
};

function formatCop(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

/** Frase del porcentaje del precio Plus sobre el valor total del contrato. */
function fractionLine(opts: FreeTierCtaOptions): string {
  const total = opts.totalContractCop ?? 0;
  const plus = opts.plusPriceCop ?? 0;
  if (total <= 0 || plus <= 0) {
    return "Protégelo por una pequeña fracción de lo que cuesta tu arriendo.";
  }
  const pctNum = (plus / total) * 100;
  const pct = pctNum >= 0.01 ? pctNum.toFixed(2).replace(".", ",") : "0,01";
  return `Tu contrato suma <strong>${formatCop(total)}</strong> en todo su plazo. Protegerlo con ArriendoSeguro cuesta <strong>menos del ${pct}%</strong> de ese valor.`;
}

function accountLine(opts: FreeTierCtaOptions): string {
  if (!opts.promptAccount) return "";
  return `<p style="margin:8px 0 0;">Deja tu correo o crea tu cuenta gratis para <strong>guardar este contrato</strong>, retomarlo cuando quieras y pasar a Plus si lo necesitas.</p>`;
}

/** Encabezado breve que también se imprime (recuerda origen y siguiente paso). */
function headerHtml(opts: FreeTierCtaOptions): string {
  const extra =
    opts.totalContractCop && opts.plusPriceCop
      ? " · respáldalo por una mínima fracción del valor de tu arriendo"
      : "";
  return `
<div style="
  border-bottom:1px solid #ddd6fe;
  color:#6d28d9;
  font-size:11px;
  letter-spacing:0.3px;
  padding:6px 0;
  margin-bottom:12px;
  text-align:center;
">
  Generado con <strong>arriendoseguro.app</strong> · versión gratuita ·
  un papel sin firma trazable, inventario ni soportes no te protege ante un conflicto${extra}
</div>`;
}

/** Pie con CTA enganchador (se imprime con el documento). */
function footerHtml(opts: FreeTierCtaOptions): string {
  return `
<div style="
  margin-top:28px;
  border:2px dashed #7c3aed;
  border-radius:12px;
  padding:16px 18px;
  background:#f5f3ff;
  color:#3b0764;
  font-size:12.5px;
  line-height:1.55;
">
  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#5b21b6;">
    Tienes el contrato. Te falta el respaldo que gana los conflictos.
  </p>
  <p style="margin:0 0 6px;">
    La mayoría de los problemas de arriendo se pierden por falta de pruebas: sin
    firma trazable, sin inventario con fotos y sin soportes de pago, tu palabra
    vale lo mismo que la de la otra parte. Un papel firmado, solo, no te protege.
  </p>
  <p style="margin:0 0 6px;">
    Con <strong>ArriendoSeguro</strong> firmas con validez y evidencia (Ley 527 de
    1999), levantas el inventario del inmueble, registras cada pago y guardas todos
    los soportes: justo lo que marca la diferencia si las cosas se complican.
  </p>
  <p style="margin:0 0 6px;">${fractionLine(opts)}</p>
  ${accountLine(opts)}
  <p style="margin:8px 0 0;font-weight:700;color:#5b21b6;">
    Protégete antes de entregar las llaves → <span style="text-decoration:underline;">arriendoseguro.app</span>
  </p>
</div>`;
}

/**
 * Envuelve el HTML del contrato con la marca discreta y el CTA (encabezado y
 * pie). El documento sigue siendo legible y usable.
 */
export function applyFreeTierWatermark(html: string, opts: FreeTierCtaOptions = {}): string {
  return `
<div style="position:relative;">
  <div style="
    position:fixed;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    pointer-events:none;
    z-index:9999;
    transform:rotate(-24deg);
    opacity:0.07;
    font-size:54px;
    font-weight:700;
    color:#7c3aed;
    letter-spacing:2px;
  ">
    ${FREE_TIER_WATERMARK_TEXT}
  </div>
  ${headerHtml(opts)}
  ${html}
  ${footerHtml(opts)}
</div>`;
}
