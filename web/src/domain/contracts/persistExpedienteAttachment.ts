import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";

export type PersistedExpedienteAttachment = {
  storagePath: string;
  /** URL firmada (Storage) o ruta API interna (disco local). */
  publicUrl: string | null;
};

/**
 * Soportes opcionales de novedades del expediente (imagen o PDF), mismo patrón
 * que `persistContractPdfAsset` pero con `contentType` explícito.
 */
export async function persistExpedienteAttachment(input: {
  bytes: Uint8Array;
  storageObjectPath: string;
  contentType: string;
  contractId: string;
  novedadId: string;
}): Promise<PersistedExpedienteAttachment> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const buf = Buffer.from(input.bytes);

  if (bucketName) {
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(input.storageObjectPath);
    await file.save(buf, {
      contentType: input.contentType,
      resumable: false,
      metadata: { cacheControl: "private,max-age=3600" },
    });
    const signed = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    const publicUrl = signed[0] ?? null;
    return {
      storagePath: `gs://${bucketName}/${input.storageObjectPath}`,
      publicUrl,
    };
  }

  const localDir = path.join(process.cwd(), "tmp", "novedades-attachments");
  await mkdir(localDir, { recursive: true });
  const ext =
    input.contentType === "image/png"
      ? ".png"
      : input.contentType === "image/jpeg"
        ? ".jpg"
        : ".bin";
  const safe = `${input.contractId}_${input.novedadId}`.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const localPath = path.join(localDir, `nov-${safe}${ext}`);
  await writeFile(localPath, buf);
  const q = new URLSearchParams({ contractId: input.contractId, novedadId: input.novedadId });
  return {
    storagePath: localPath,
    publicUrl: `/api/contracts/novedades/attachment?${q.toString()}`,
  };
}
