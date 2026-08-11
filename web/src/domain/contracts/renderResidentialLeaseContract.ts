import {
  CLAUSULA_CODEUDOR,
  COMPARECENCIA_CODEUDOR,
  CONTRACT_TEMPLATE,
  FIRMA_CODEUDOR,
  NOTIFICACION_CODEUDOR,
  wrapContractHtml,
} from "./contractClauses";
import { buildContractVariables, injectVariables } from "./contractVariables";
import { codebtorCount, repeatCodebtorBlock } from "./codebtorBlocks";
import { getContractVersionDescription, withDocumentHash } from "./contractVersioning";
import {
  getSelectedClauseBodies,
  SPECIAL_CLAUSE_OTHER_ID,
} from "./specialClauseBodies";
import type {
  RenderedContract,
  ResidentialLeaseContractInput,
  SpecialClausesSelection,
} from "./types";
import { validateContractData } from "./validateContractData";

function escapeHtmlForContract(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Convierte texto libre a HTML preservando saltos de línea como párrafos
 * separados. Aplica `escapeHtmlForContract` para evitar inyección.
 */
function freeTextToParagraphs(text: string): string {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtmlForContract(line)}</p>`)
    .join("\n");
}

/**
 * Construye el HTML de la cláusula condicional "Cláusulas especiales
 * acordadas por las partes". Si no hay cláusulas habilitadas, retorna
 * cadena vacía (el placeholder simplemente desaparece del documento).
 *
 * Las cláusulas predefinidas se renderizan con su redacción curada
 * (`SPECIAL_CLAUSE_BODIES`). La opción "Otra" se imprime como texto
 * libre con disclaimer explícito de que su validez está sujeta a la
 * normatividad aplicable.
 */
function buildSpecialClausesBlock(
  selection: SpecialClausesSelection | undefined,
): string {
  if (!selection || !selection.enabled) return "";
  const bodies = getSelectedClauseBodies(selection.selected);
  // Si el aliado jurídico registró la redacción final («drafted»), esa prima
  // sobre el texto propuesto por el usuario. En cualquier caso, la cláusula libre
  // se imprime como acuerdo voluntario de las partes con el disclaimer de validez
  // legal que aparece a continuación.
  const drafted = selection.reviewStatus === "drafted" && Boolean(selection.finalText?.trim());
  const otherText = drafted ? (selection.finalText ?? "") : (selection.freeText ?? "");
  const hasOther =
    selection.selected.includes(SPECIAL_CLAUSE_OTHER_ID) &&
    Boolean(otherText && otherText.trim().length > 0);

  if (bodies.length === 0 && !hasOther) return "";

  const items = bodies
    .map(
      (b) =>
        `<li><strong>${escapeHtmlForContract(b.title)}.</strong> ${escapeHtmlForContract(b.body)}</li>`,
    )
    .join("\n");

  const otherBlock = hasOther
    ? `
  <p><strong>Otra cláusula acordada entre las partes.</strong></p>
  ${freeTextToParagraphs(otherText)}
  <p style="font-size:11px;color:#475569;">
    La presente cláusula adicional refleja un acuerdo voluntario entre las partes y su validez se encuentra sujeta a la
    normatividad colombiana aplicable. En caso de contradicción con la ley imperativa, primarán las normas legales.
  </p>`
    : "";

  return `
  <section>
    <h2>CLÁUSULAS ESPECIALES ACORDADAS POR LAS PARTES</h2>
    <p>
      Adicionalmente a las cláusulas anteriores y sin perjuicio del régimen general del contrato, las partes acuerdan
      expresamente las siguientes condiciones especiales relacionadas con el inmueble o su uso. Estas cláusulas se sujetan
      a la normatividad colombiana aplicable; en lo no previsto aquí primará la Ley 820 de 2003 y demás normas
      concordantes.
    </p>
    ${items ? `<ol>${items}</ol>` : ""}
    ${otherBlock}
  </section>`;
}

/**
 * Construye la sección de "Observaciones y acuerdos complementarios"
 * a partir del texto libre que las partes registran como anotaciones del
 * expediente. Lleva disclaimer legal explícito para que el texto libre no
 * se interprete como cláusula sustitutiva.
 */
function buildExpedienteNotesBlock(notes: string | undefined): string {
  const text = (notes ?? "").trim();
  if (text.length === 0) return "";
  return `
  <section>
    <h2>OBSERVACIONES Y ACUERDOS COMPLEMENTARIOS</h2>
    <p>
      Las partes dejan constancia de las siguientes observaciones operativas y acuerdos complementarios, que reflejan
      su voluntad y se entienden complementarios a las cláusulas anteriores. En caso de conflicto con las cláusulas
      legales del presente contrato o con la normatividad imperativa, primarán estas últimas.
    </p>
    ${freeTextToParagraphs(text)}
  </section>`;
}

/**
 * Cláusula condicional de garantía para servicios públicos (Art. 15 Ley 820 de
 * 2003). Solo aparece si las partes la habilitaron y pactaron un valor. Deja
 * claro que es la excepción permitida (exclusiva para servicios), distinta del
 * depósito general prohibido por el art. 16.
 */
export function buildUtilityGuaranteeBlock(input: ResidentialLeaseContractInput): string {
  const g = input.utilityServicesGuarantee;
  if (!g || !g.enabled || !(Number(g.agreedAmountCop) > 0)) return "";
  const agreed = `$${Math.round(Number(g.agreedAmountCop)).toLocaleString("es-CO")}`;
  const max = `$${Math.round(Number(g.maxAllowedCop)).toLocaleString("es-CO")}`;
  return `
  <section>
    <h2>GARANTÍA PARA SERVICIOS PÚBLICOS (ARTÍCULO 15, LEY 820 DE 2003)</h2>
    <p>
      Las partes pactan, de manera exclusiva para garantizar el pago de los servicios públicos domiciliarios del
      inmueble, una garantía a cargo de EL ARRENDATARIO por valor de ${agreed}, suma que no excede el valor de los
      dos (2) últimos períodos de facturación de dichos servicios (máximo legal: ${max}).
    </p>
    <p>
      Esta garantía se establece por excepción, al amparo del artículo 15 de la Ley 820 de 2003; se destina únicamente
      a cubrir obligaciones derivadas de los servicios públicos del inmueble y no constituye depósito en dinero ni
      caución real prohibida por el artículo 16 de la misma ley. Verificado el pago de dichos servicios a la
      terminación del contrato, la garantía se devolverá o aplicará conforme a la ley.
    </p>
  </section>`;
}

/**
 * Cláusula condicional de comprobantes de pago y notificaciones. Solo aparece si
 * el dueño eligió "notifications_and_upload" antes de firmar. BORRADOR sujeto a
 * revisión legal (como el resto del motor de cláusulas).
 */
function buildPaymentPolicyBlock(input: ResidentialLeaseContractInput): string {
  if (input.paymentSupportPolicy !== "notifications_and_upload") return "";
  return `
  <section>
    <h2>COMPROBANTES DE PAGO Y NOTIFICACIONES</h2>
    <p>
      EL ARRENDATARIO registrará en la plataforma ArriendoSeguro el comprobante de cada pago del canon dentro de los días
      siguientes a la fecha pactada. La plataforma enviará recordatorios a EL ARRENDATARIO y, de no registrarse el
      comprobante en el plazo, podrá enviarlos también a EL/LOS CODEUDOR(ES) solidario(s), conforme al protocolo informado
      a las partes. Este registro es un mecanismo de constancia y comunicación entre las partes; no sustituye los medios de
      pago ni las obligaciones legales del contrato, y su omisión no exonera del pago del canon. Ante controversias, las
      partes podrán registrar una conciliación en la plataforma. En lo no previsto aquí, primará la Ley 820 de 2003 y demás
      normas concordantes.
    </p>
    <p style="font-size:11px;color:#475569;">
      Cláusula operativa acordada voluntariamente por las partes; su validez se sujeta a la normatividad colombiana aplicable.
    </p>
  </section>`;
}

function withConditionalBlocks(
  template: string,
  input: ResidentialLeaseContractInput,
): string {
  const n = codebtorCount(input);
  return template
    .replaceAll("[COMPARECENCIA_CODEUDOR_CONDICIONAL]", repeatCodebtorBlock(COMPARECENCIA_CODEUDOR, n))
    .replaceAll("[CLAUSULA_CODEUDOR_CONDICIONAL]", repeatCodebtorBlock(CLAUSULA_CODEUDOR, n))
    .replaceAll("[NOTIFICACION_CODEUDOR_CONDICIONAL]", repeatCodebtorBlock(NOTIFICACION_CODEUDOR, n))
    .replaceAll("[FIRMA_CODEUDOR_CONDICIONAL]", repeatCodebtorBlock(FIRMA_CODEUDOR, n))
    .replaceAll(
      "[CLAUSULA_ACUERDOS_ESPECIALES_CONDICIONAL]",
      buildSpecialClausesBlock(input.specialClauses),
    )
    .replaceAll(
      "[OBSERVACIONES_COMPLEMENTARIAS_CONDICIONAL]",
      buildExpedienteNotesBlock(input.expedienteNotes),
    )
    .replaceAll(
      "[GARANTIA_SERVICIOS_PUBLICOS_CONDICIONAL]",
      buildUtilityGuaranteeBlock(input),
    )
    .replaceAll(
      "[NOTIFICACIONES_PAGO_CONDICIONAL]",
      buildPaymentPolicyBlock(input),
    );
}

/**
 * Genera HTML del contrato base (vivienda urbana) con bloques condicionales para codeudor.
 * - No firma ni emite PDF en esta capa (solo preparado).
 * - Retorna hash SHA-256 del HTML final para trazabilidad documental.
 */
export function renderResidentialLeaseContract(
  input: ResidentialLeaseContractInput,
): RenderedContract {
  const validation = validateContractData(input);
  if (!validation.ok) {
    const summary = validation.issues.map((i) => `${i.field}: ${i.message}`).join(" | ");
    throw new Error(`No se pudo generar contrato: ${summary}`);
  }

  const templated = withConditionalBlocks(CONTRACT_TEMPLATE, input);
  const vars = buildContractVariables(input);
  const body = injectVariables(templated, vars);
  const title = `Contrato ${input.contractVersion} - Arriendo Seguro`;
  const html = wrapContractHtml(body, title);

  return withDocumentHash({
    html,
    version: input.contractVersion,
    generatedAt: input.generatedAt,
    legalFramework: [
      "VIVIENDA_URBANA_CO",
      "TRATAMIENTO_DATOS_CO",
      "FIRMA_ELECTRONICA_CO",
    ],
  });
}

export function getContractRenderSummary(input: ResidentialLeaseContractInput): string {
  return [
    `Versión: ${input.contractVersion}`,
    `Descripción: ${getContractVersionDescription(input.contractVersion)}`,
    `Codeudor solidario: ${input.hasSolidaryCoDebtor ? "sí" : "no"}`,
  ].join("\n");
}

