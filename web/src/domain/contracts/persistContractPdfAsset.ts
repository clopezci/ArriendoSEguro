import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";

export type PersistedContractPdf = {
  pdfStoragePath: string;
  /** URL firmada (Storage) o ruta API interna (disco local). */
  pdfUrl: string | null;
};

/**
 * Guarda bytes PDF en Firebase Storage (si hay bucket) o en disco local (`tmp/generated-pdfs`).
 * En local, `pdfUrl` apunta a `/api/contracts/annexes/pdf` para descarga autenticada.
 */
export async function persistContractPdfAsset(input: {
  pdfBytes: Uint8Array;
  /** Ruta del objeto dentro del bucket, sin prefijo gs:// (ej. contracts/{id}/annexes/foo.pdf). */
  storageObjectPath: string;
  /** Id del documento en `contract_annexes` (para URL local). */
  annexFirestoreDocId: string;
}): Promise<PersistedContractPdf> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const buf = Buffer.from(input.pdfBytes);

  if (bucketName) {
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(input.storageObjectPath);
    await file.save(buf, {
      contentType: "application/pdf",
      resumable: false,
      metadata: { cacheControl: "private,max-age=3600" },
    });
    const signed = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    const pdfUrl = signed[0] ?? null;
    return {
      pdfStoragePath: `gs://${bucketName}/${input.storageObjectPath}`,
      pdfUrl,
    };
  }

  const localDir = path.join(process.cwd(), "tmp", "generated-pdfs");
  await mkdir(localDir, { recursive: true });
  const safeId = input.annexFirestoreDocId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const localPath = path.join(localDir, `annex-${safeId}.pdf`);
  await writeFile(localPath, buf);
  const q = new URLSearchParams({ annexId: input.annexFirestoreDocId });
  return {
    pdfStoragePath: localPath,
    pdfUrl: `/api/contracts/annexes/pdf?${q.toString()}`,
  };
}
