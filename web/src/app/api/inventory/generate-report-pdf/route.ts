import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { auditEvent } from "@/features/contracts/audit-server";
import { requireInventoryParticipant } from "@/lib/auth/requireInventoryParticipant";

export const runtime = "nodejs";

const schema = z.object({ inventoryId: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: [{ field: "inventoryId", message: "inventoryId inválido." }] },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }
    const gate = await requireInventoryParticipant(request, firestore, parsed.data.inventoryId);
    if (!gate.ok) return gate.response;
    const invRef = firestore.collection("inventories").doc(parsed.data.inventoryId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "inventoryId", message: "Inventario no encontrado." }] },
        { status: 404 },
      );
    }
    const inventory = invSnap.data() as {
      contractId: string;
      contractVersionId: string;
      generatedHtml?: string;
      documentHash?: string;
    };
    if (!inventory.generatedHtml || !inventory.documentHash) {
      return NextResponse.json(
        { success: false, errors: [{ field: "inventory", message: "Primero debes generar el reporte HTML." }] },
        { status: 422 },
      );
    }

    const generatedAt = new Date().toISOString();
    const pdfBytes = await renderContractPdfFromHtml({
      html: inventory.generatedHtml,
      contractId: inventory.contractId,
      contractVersionId: inventory.contractVersionId,
      versionNumber: 1,
      documentHash: inventory.documentHash,
      generatedAt,
    });

    let pdfUrl = "";
    let pdfStoragePath = "";
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (bucketName) {
      const objectPath = `inventories/${parsed.data.inventoryId}/initial-report.pdf`;
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(objectPath);
      await file.save(Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        resumable: false,
      });
      const signed = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      });
      pdfUrl = signed[0] ?? "";
      pdfStoragePath = `gs://${bucketName}/${objectPath}`;
    } else {
      const localDir = path.join(process.cwd(), "tmp", "generated-pdfs");
      await mkdir(localDir, { recursive: true });
      const localPath = path.join(localDir, `inventory-${parsed.data.inventoryId}.pdf`);
      await writeFile(localPath, Buffer.from(pdfBytes));
      pdfUrl = `/api/inventory/pdf/${parsed.data.inventoryId}`;
      pdfStoragePath = localPath;
    }

    const annexRef = firestore.collection("contract_annexes").doc(`annex_inventory_${parsed.data.inventoryId}`);
    await Promise.all([
      invRef.set(
        {
          generatedPdfUrl: pdfUrl,
          pdfStoragePath,
          updatedAt: generatedAt,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      annexRef.set(
        { pdfUrl, updatedAt: generatedAt, updatedAtServer: FieldValue.serverTimestamp() },
        { merge: true },
      ),
    ]);
    auditEvent("inventory_report_generated", { inventoryId: parsed.data.inventoryId });
    return NextResponse.json({ success: true, pdfUrl, generatedAt });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo generar PDF del inventario." }] },
      { status: 500 },
    );
  }
}

