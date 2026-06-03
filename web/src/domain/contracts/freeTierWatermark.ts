/**
 * Marca de agua y CTA para el contrato generado en el **tier gratuito**.
 *
 * A diferencia del modo demo (que invalida el documento), aquí el contrato SÍ
 * es utilizable: solo lleva una marca discreta `arriendoseguro.app` y un llamado
 * a la acción en encabezado y pie que crea la necesidad de pasar a Plus (firma
 * con validez, inventario, soportes y evidencia). El objetivo es que la persona
 * entienda que el papel solo no basta y convierta.
 */

export const FREE_TIER_WATERMARK_TEXT = "arriendoseguro.app";

/** Encabezado breve (cada impresión recuerda el origen y el siguiente paso). */
export const FREE_TIER_HEADER_HTML = `
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
  firma con validez, inventario y soportes disponibles en Plus
</div>`;

/**
 * Pie con CTA enganchador. Pensado para "crear la necesidad": el contrato es el
 * principio, pero sin evidencia tu palabra vale lo mismo que la de la otra parte.
 */
export const FREE_TIER_FOOTER_CTA_HTML = `
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
  <p style="margin:0 0 8px;">
    Con <strong>ArriendoSeguro</strong> firmas con validez y evidencia (Ley 527 de
    1999), levantas el inventario del inmueble, registras cada pago y guardas todos
    los soportes: justo lo que marca la diferencia si las cosas se complican —y por
    una pequeña fracción de lo que cuesta un mal arriendo.
  </p>
  <p style="margin:0;font-weight:700;color:#5b21b6;">
    Protégete antes de entregar las llaves → <span style="text-decoration:underline;">arriendoseguro.app</span>
  </p>
</div>`;

/**
 * Envuelve el HTML del contrato con la marca discreta y el CTA (encabezado y
 * pie). El documento sigue siendo legible y usable.
 */
export function applyFreeTierWatermark(html: string): string {
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
  ${FREE_TIER_HEADER_HTML}
  ${html}
  ${FREE_TIER_FOOTER_CTA_HTML}
</div>`;
}
