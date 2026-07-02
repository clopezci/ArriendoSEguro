import { generateDocumentHash } from "@/domain/contracts/hash";

/**
 * Otrosí de prórroga y reajuste del contrato de arrendamiento (renovación).
 *
 * Instrumento legalmente aplicable para renovar con la misma parte: prorroga el
 * término por un nuevo período y reajusta el canon según el IPC (Ley 820 de 2003,
 * art. 20), dejando vigentes las demás condiciones del contrato original. Se
 * asocia como anexo al contrato renovado.
 */
export function renderRenewalAddendum(input: {
  addendumDate: string;
  originalContractId: string;
  propertyAddress: string;
  landlordName: string;
  tenantName: string;
  codebtorNames: string[];
  previousStart: string;
  previousEnd: string;
  newStart: string;
  newEnd: string;
  termMonths: number;
  previousRent: string;
  newRent: string;
  newRentText: string;
  ipcPercent: number;
}): { html: string; hash: string } {
  const codebtorClause = input.codebtorNames.length
    ? `<p>Comparece(n) el(los) codeudor(es) solidario(s) <strong>${input.codebtorNames.join(", ")}</strong>, quien(es) ratifica(n) su obligación solidaria respecto del nuevo período aquí pactado.</p>`
    : "";

  const html = `
    <article>
      <h1>OTROSÍ DE PRÓRROGA Y REAJUSTE DEL CONTRATO DE ARRENDAMIENTO</h1>
      <p>En la fecha ${input.addendumDate}, las partes del contrato de arrendamiento de vivienda urbana del inmueble
      ubicado en <strong>${input.propertyAddress}</strong> (contrato No. ${input.originalContractId}), a saber,
      EL ARRENDADOR <strong>${input.landlordName}</strong> y EL ARRENDATARIO <strong>${input.tenantName}</strong>,
      de común acuerdo suscriben el presente OTROSÍ, que hace parte integral del contrato referido.</p>

      <h2>PRIMERA. PRÓRROGA DEL TÉRMINO</h2>
      <p>Las partes acuerdan prorrogar el contrato por un nuevo período de <strong>${input.termMonths} meses</strong>,
      contado desde el <strong>${input.newStart}</strong> hasta el <strong>${input.newEnd}</strong>. El período
      inmediatamente anterior comprendió del ${input.previousStart} al ${input.previousEnd}.</p>

      <h2>SEGUNDA. REAJUSTE DEL CANON</h2>
      <p>De conformidad con el artículo 20 de la Ley 820 de 2003, el canon mensual se reajusta en
      <strong>${input.ipcPercent}%</strong> (equivalente al IPC del año calendario anterior), quedando el nuevo canon
      mensual en <strong>${input.newRent}</strong> (${input.newRentText}). El canon del período anterior era de
      ${input.previousRent}. El reajuste no supera el tope legal del 100% del IPC del año anterior.</p>

      <h2>TERCERA. DEMÁS CONDICIONES</h2>
      <p>Todas las demás cláusulas y condiciones del contrato de arrendamiento original y de sus anexos continúan
      vigentes y sin modificación, en cuanto no se opongan a lo aquí pactado.</p>

      ${codebtorClause}

      <p>Para constancia, y en señal de conformidad, las partes aceptan y suscriben el presente otrosí de prórroga y
      reajuste, que se asocia como anexo al contrato de arrendamiento renovado.</p>
    </article>`;

  return { html, hash: generateDocumentHash(html) };
}
