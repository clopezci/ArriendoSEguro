import { generateDocumentHash } from "../hash";
import { ANNEX_PLACEHOLDER_HTML, ANNEX_TITLES } from "./annexTemplates";
import type { ContractAnnex, ContractAnnexType } from "./types";
import { isPlaceholderAnnexType, validateAnnexData } from "./validateAnnexData";
import type { SignatureRecord } from "@/domain/signatures/types";

type RenderAnnexInput = {
  id: string;
  contractId: string;
  contractVersionId: string;
  leaseProcessId: string;
  annexType: ContractAnnexType;
};

export function renderAnnexPlaceholder(input: RenderAnnexInput): ContractAnnex {
  const now = new Date().toISOString();
  const htmlContent =
    ANNEX_PLACEHOLDER_HTML[input.annexType] ??
    `<article><h1>${ANNEX_TITLES[input.annexType]}</h1><p>Anexo pendiente por generar.</p></article>`;

  const annex: ContractAnnex = {
    id: input.id,
    contractId: input.contractId,
    contractVersionId: input.contractVersionId,
    leaseProcessId: input.leaseProcessId,
    annexType: input.annexType,
    title: ANNEX_TITLES[input.annexType],
    status: isPlaceholderAnnexType(input.annexType) ? "pending" : "generated",
    htmlContent,
    documentHash: generateDocumentHash(htmlContent),
    createdAt: now,
    updatedAt: now,
    generatedAt: now,
  };

  const issues = validateAnnexData(annex);
  if (issues.length > 0) {
    throw new Error(issues.map((i) => `${i.field}: ${i.message}`).join(" | "));
  }
  return annex;
}

export function renderElectronicSignatureEvidenceAnnex(input: {
  contract: { id: string; status?: string };
  contractVersion: { id: string; versionNumber?: number; documentHash: string };
  signatures: SignatureRecord[];
  leaseProcessId: string;
}): ContractAnnex {
  const now = new Date().toISOString();
  const rows = input.signatures
    .map(
      (s) => `
      <tr>
        <td>${s.partyType}</td>
        <td>${s.signerName}</td>
        <td>${s.signerDocument}</td>
        <td>${s.signerEmail}</td>
        <td>${s.signedAt ?? "-"}</td>
        <td>${s.signatureMethod}</td>
        <td>${s.ipAddress ?? "-"}</td>
        <td>${s.userAgent ?? "-"}</td>
      </tr>`,
    )
    .join("");

  const htmlContent = `
    <article>
      <h1>${ANNEX_TITLES.electronic_signature_evidence}</h1>
      <p>Contrato: ${input.contract.id}</p>
      <p>Versión contractual: ${input.contractVersion.id} (número ${input.contractVersion.versionNumber ?? 1})</p>
      <p>Hash documental: ${input.contractVersion.documentHash}</p>
      <p>Fecha de generación del anexo: ${now}</p>
      <p>Estado final del contrato: ${input.contract.status ?? "signed"}</p>
      <h2>Firmantes</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Rol</th>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Correo</th>
            <th>Fecha firma</th>
            <th>Método</th>
            <th>IP</th>
            <th>User-Agent</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Texto de aceptación:</p>
      <ul>
        <li>Declaro que he leído el contrato, entiendo su contenido y acepto firmarlo electrónicamente.</li>
        <li>Acepto el uso de firma electrónica simple para este contrato.</li>
      </ul>
    </article>
  `;

  return {
    id: `annex_sig_${Date.now()}`,
    contractId: input.contract.id,
    contractVersionId: input.contractVersion.id,
    leaseProcessId: input.leaseProcessId,
    annexType: "electronic_signature_evidence",
    title: ANNEX_TITLES.electronic_signature_evidence,
    status: "generated",
    htmlContent,
    documentHash: generateDocumentHash(htmlContent),
    createdAt: now,
    updatedAt: now,
    generatedAt: now,
  };
}

