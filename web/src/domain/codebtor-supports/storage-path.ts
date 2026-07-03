import type { CodebtorSupportType, SupportParty } from "./support-schema";

/** Segmento de ruta en Storage según la parte. Codeudor conserva el histórico. */
export function supportPathSegment(party: SupportParty): string {
  return party === "tenant" ? "tenant-supports" : "codebtor-supports";
}

/** Interpreta `gs://bucket/object/path...` para validación y descarga con Admin SDK. */
export function parseGsUri(gs: string): { bucket: string; objectPath: string } | null {
  const t = gs.trim();
  if (!t.startsWith("gs://")) return null;
  const rest = t.slice(5);
  const i = rest.indexOf("/");
  if (i <= 0) return null;
  const bucket = rest.slice(0, i);
  const objectPath = rest.slice(i + 1);
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

/**
 * Verifica que la ruta en Storage corresponda al contrato, parte, tipo de soporte
 * y bucket esperado.
 * Convención: `contracts/{contractId}/{party}-supports/{supportType}/...`
 */
export function assertValidSupportGsPath(
  storagePath: string,
  opts: { expectedBucket: string; contractId: string; party: SupportParty; supportType: CodebtorSupportType },
): { objectPath: string } | null {
  const parsed = parseGsUri(storagePath);
  if (!parsed) return null;
  if (parsed.bucket !== opts.expectedBucket) return null;
  const prefix = `contracts/${opts.contractId}/${supportPathSegment(opts.party)}/${opts.supportType}/`;
  if (!parsed.objectPath.startsWith(prefix) || parsed.objectPath.length <= prefix.length) return null;
  return { objectPath: parsed.objectPath };
}
