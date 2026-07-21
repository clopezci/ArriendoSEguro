import { generateDocumentHash } from "../hash";
import { ANNEX_PLACEHOLDER_HTML, ANNEX_TITLES } from "./annexTemplates";
import type { ContractAnnex, ContractAnnexType } from "./types";
import { isPlaceholderAnnexType, validateAnnexData } from "./validateAnnexData";
import type { SignatureRecord } from "@/domain/signatures/types";
import { formatAppDateTime } from "@/lib/datetime/appTime";

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
    .map((s) => {
      const ev = (s.evidenceJson ?? {}) as {
        otpVerifiedAt?: string;
        otpEmail?: string;
        consentBlockHash?: string;
      };
      return `
      <tr>
        <td>${s.partyType}</td>
        <td>${s.signerName}</td>
        <td>${s.signerDocument}</td>
        <td>${s.signerEmail}</td>
        <td>${formatAppDateTime(s.signedAt)}</td>
        <td>${s.signatureMethod}</td>
        <td>${formatAppDateTime(ev.otpVerifiedAt)}</td>
        <td>${ev.otpEmail ?? "-"}</td>
        <td style="word-break:break-all;font-size:10px;">${ev.consentBlockHash ?? "-"}</td>
        <td>${s.ipAddress ?? "-"}</td>
        <td>${s.userAgent ?? "-"}</td>
      </tr>`;
    })
    .join("");

  const htmlContent = `
    <article>
      <h1>${ANNEX_TITLES.electronic_signature_evidence}</h1>
      <p>Contrato: ${input.contract.id}</p>
      <p>Versión contractual: ${input.contractVersion.id} (número ${input.contractVersion.versionNumber ?? 1})</p>
      <p>Hash documental: ${input.contractVersion.documentHash}</p>
      <p>Fecha de generación del anexo: ${formatAppDateTime(now)}</p>
      <p style="font-size:11px;color:#475569;">Las fechas y horas de este anexo se muestran en <strong>hora de Colombia (GMT-5)</strong>. Internamente se registran en tiempo universal (UTC) para trazabilidad.</p>
      <p>Estado final del contrato: ${input.contract.status ?? "signed"}</p>
      <p><strong>Marco legal (orientación general):</strong> la firma electrónica y los datos de evidencia se relacionan con la Ley 527 de 1999 y normas concordantes. Este documento es generado por la plataforma ArriendoSeguro como constancia técnica; no sustituye asesoría legal ni actuación notarial.</p>
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
            <th>OTP verificado</th>
            <th>Correo verif. OTP</th>
            <th>Hash bloque consentimientos</th>
            <th>IP</th>
            <th>User-Agent</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Texto de aceptación mostrado en pantalla:</p>
      <ul>
        <li>Declaro que he leído el contrato, entiendo su contenido y acepto firmarlo electrónicamente.</li>
        <li>Acepto el uso de firma electrónica simple para este contrato.</li>
      </ul>
      <p>Reforzamiento: verificación por código de un solo uso (OTP) enviado al correo del firmante antes de registrar la firma.</p>
    </article>
  `;

  return {
    id: `annex_sig_evidence_${input.contract.id}_${input.contractVersion.id}`,
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

export function notarialAuthenticationAnnexId(contractId: string, contractVersionId: string): string {
  return `annex_notarial_auth_${contractId}_${contractVersionId}`;
}

/**
 * Constancia HTML del anexo; el PDF visible es el cargado por las partes
 * (autenticado en notaría), no generado desde este HTML.
 */
export function buildNotarialAuthenticationAnnex(input: {
  contractId: string;
  contractVersionId: string;
  leaseProcessId: string;
  uploadedAtIso: string;
  uploadedByRole: string;
}): ContractAnnex {
  const now = new Date().toISOString();
  const id = notarialAuthenticationAnnexId(input.contractId, input.contractVersionId);
  const htmlContent = `
    <article>
      <h1>${ANNEX_TITLES.notarial_authentication}</h1>
      <p>Expediente (contrato): ${input.contractId}</p>
      <p>Versión contractual: ${input.contractVersionId}</p>
      <p>Fecha de registro de la carga en la plataforma (UTC): ${input.uploadedAtIso}</p>
      <p>Rol de quien subió el archivo: ${input.uploadedByRole}</p>
      <p><strong>Importante:</strong> ArriendoSeguro no actúa como notaría ni revisa el contenido del documento autenticado. Este anexo solo archiva el PDF que cargaste como parte del expediente. Si prefieres un trámite totalmente electrónico, el Estado colombiano ofrece firma y autenticación digital gratuita a través de la Agencia Nacional Digital (Decreto 620 de 2020); la plataforma te indica cómo hacerlo.</p>
      <p><strong>Marco legal (orientación general):</strong> la autenticación de documentos y competencias notariales se rigen por la normativa colombiana aplicable. Si tienes dudas, consulta a un notario o a tu asesor jurídico.</p>
    </article>
  `;

  return {
    id,
    contractId: input.contractId,
    contractVersionId: input.contractVersionId,
    leaseProcessId: input.leaseProcessId,
    annexType: "notarial_authentication",
    title: ANNEX_TITLES.notarial_authentication,
    status: "generated",
    htmlContent,
    documentHash: generateDocumentHash(htmlContent),
    createdAt: now,
    updatedAt: now,
    generatedAt: now,
  };
}

