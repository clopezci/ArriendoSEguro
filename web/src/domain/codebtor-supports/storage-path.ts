import type { CodebtorSupportType } from "./support-schema";

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
 * Verifica que la ruta en Storage corresponda al contrato, tipo de soporte y bucket esperado.
 * Convención: `contracts/{contractId}/codebtor-supports/{supportType}/...`
 */
export function assertValidCodebtorSupportGsPath(
  storagePath: string,
  opts: { expectedBucket: string; contractId: string; supportType: CodebtorSupportType },
): { objectPath: string } | null {
  const parsed = parseGsUri(storagePath);
  if (!parsed) return null;
  if (parsed.bucket !== opts.expectedBucket) return null;
  const prefix = `contracts/${opts.contractId}/codebtor-supports/${opts.supportType}/`;
  if (!parsed.objectPath.startsWith(prefix) || parsed.objectPath.length <= prefix.length) return null;
  return { objectPath: parsed.objectPath };
}
