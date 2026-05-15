import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { readPdfBytesFlexible } from "@/domain/contracts/readStoredPdfBytes";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit";
import { codebtorSupportsCollection, type CodebtorSupportDoc } from "@/domain/codebtor-supports/firestore-supports";

export const runtime = "nodejs";

const MAX_ANNEX_HTML_CHARS = 2_000_000;
/** Límite conservador para Vercel / memoria del proceso (paquete sin comprimir aprox.). */
const MAX_BUNDLE_BYTES_TOTAL = 52 * 1024 * 1024;
const MAX_BUNDLE_BYTES_PER_FILE = 22 * 1024 * 1024;

function resolvePublicAssetUrl(request: Request, url: string | null | undefined): string | null {
  const t = url?.trim() ?? "";
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const origin = fromEnv && /^https?:\/\//i.test(fromEnv) ? fromEnv : new URL(request.url).origin;
    return `${origin.replace(/\/$/, "")}${t}`;
  }
  return null;
}

function safeSegment(s: string, max = 56): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return (t || "archivo").slice(0, max);
}

type AnnexDoc = {
  id?: string;
  annexType?: string;
  title?: string;
  pdfUrl?: string | null;
  pdfStoragePath?: string | null;
  htmlContent?: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
    const bundleContext = (url.searchParams.get("context") ?? "").trim();
    if (!contractId || !contractVersionId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "query", message: "contractId y contractVersionId son obligatorios." }] },
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

    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    const versionRef = firestore.collection("contract_versions").doc(contractVersionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "Versión no encontrada." }] },
        { status: 404 },
      );
    }
    const version = versionSnap.data() as {
      contractId?: string;
      pdfStoragePath?: string;
      pdfUrl?: string;
    };
    if (version?.contractId !== contractId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] },
        { status: 422 },
      );
    }

    const zip = new JSZip();
    const manifest: string[] = [];
    manifest.push(`Paquete de evidencia — contrato ${contractId}`);
    manifest.push(`Versión contractual: ${contractVersionId}`);
    manifest.push(`Generado: ${new Date().toISOString()}`);
    manifest.push(
      `Límites del paquete: máximo ~${MAX_BUNDLE_BYTES_TOTAL / 1024 / 1024} MB en total y ~${MAX_BUNDLE_BYTES_PER_FILE / 1024 / 1024} MB por archivo.`,
    );
    manifest.push("");

    let bundleBytes = 0;

    function byteSize(data: Buffer | Uint8Array | string): number {
      return typeof data === "string" ? Buffer.byteLength(data, "utf8") : data.length;
    }

    function tryAdd(name: string, data: Buffer | Uint8Array | string, manifestLine: string): void {
      const n = byteSize(data);
      if (n > MAX_BUNDLE_BYTES_PER_FILE) {
        manifest.push(
          `- (omitido) ${manifestLine}: supera el máximo por archivo (${Math.round(n / 1024 / 1024)} MB).`,
        );
        return;
      }
      if (bundleBytes + n > MAX_BUNDLE_BYTES_TOTAL) {
        manifest.push(
          `- (omitido) ${manifestLine}: superaría el máximo total del paquete (ya llevamos ~${Math.round(bundleBytes / 1024 / 1024)} MB).`,
        );
        return;
      }
      zip.file(name, data);
      bundleBytes += n;
      manifest.push(`- ${manifestLine}`);
    }

    const contractPdf = await readPdfBytesFlexible({
      pdfStoragePath: version.pdfStoragePath,
      pdfUrl: resolvePublicAssetUrl(request, version.pdfUrl),
    });
    if (contractPdf?.length) {
      tryAdd("01-contrato.pdf", contractPdf, "01-contrato.pdf (PDF del contrato)");
    } else {
      manifest.push("- (omitido) PDF del contrato: aún no generado o no accesible desde el servidor.");
    }

    const invSnap = await firestore
      .collection("inventories")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .where("inventoryType", "==", "initial")
      .limit(1)
      .get();

    if (!invSnap.empty) {
      const inv = invSnap.docs[0]?.data() as {
        id?: string;
        pdfStoragePath?: string;
        deliveryActPdfStoragePath?: string;
      };
      const invPdf = await readPdfBytesFlexible({
        pdfStoragePath: inv.pdfStoragePath,
        pdfUrl: null,
      });
      if (invPdf?.length) {
        tryAdd("02-inventario-inicial.pdf", invPdf, "02-inventario-inicial.pdf");
      } else {
        manifest.push("- (omitido) Inventario: PDF no generado o no accesible.");
      }

      const actaBuf = inv.deliveryActPdfStoragePath
        ? await readPdfBytesFlexible({ pdfStoragePath: inv.deliveryActPdfStoragePath, pdfUrl: null })
        : null;
      if (actaBuf?.length) {
        tryAdd("03-acta-entrega-inicial.pdf", actaBuf, "03-acta-entrega-inicial.pdf");
      } else {
        manifest.push("- (omitido) Acta de entrega: PDF no generado o no accesible.");
      }
    } else {
      manifest.push("- (omitido) Inventario / acta: no hay inventario inicial para esta versión.");
    }

    const annexSnap = await firestore
      .collection("contract_annexes")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .get();

    const seen = new Set<string>();
    let annexIndex = 0;
    for (const d of annexSnap.docs) {
      const row = d.data() as AnnexDoc;
      const key = row.id ?? d.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const type = row.annexType ?? "anexo";
      const base = safeSegment(`${type}_${key.slice(-10)}`);

      const pdfBuf = await readPdfBytesFlexible({
        pdfStoragePath: row.pdfStoragePath ?? null,
        pdfUrl: resolvePublicAssetUrl(request, row.pdfUrl),
      });
      if (pdfBuf?.length) {
        annexIndex += 1;
        const name = `anexos/${String(annexIndex).padStart(2, "0")}_${base}.pdf`;
        tryAdd(name, pdfBuf, `${name} (${row.title ?? type})`);
        continue;
      }

      const html = row.htmlContent?.trim();
      if (html && html.length <= MAX_ANNEX_HTML_CHARS) {
        annexIndex += 1;
        const name = `anexos/${String(annexIndex).padStart(2, "0")}_${base}.html`;
        tryAdd(name, html, `${name} (HTML — ${row.title ?? type})`);
      } else if (html) {
        manifest.push(`- (omitido) ${row.title ?? type}: HTML demasiado grande para el paquete.`);
      } else {
        manifest.push(`- (omitido) ${row.title ?? type}: sin PDF ni HTML disponible.`);
      }
    }

    const supportsSnap = await codebtorSupportsCollection(firestore, contractId).get();
    let supportIndex = 0;
    for (const d of supportsSnap.docs) {
      const row = d.data() as Partial<CodebtorSupportDoc>;
      if (row.voided || row.contractVersionId !== contractVersionId) continue;
      const st = row.supportType ?? "otro";
      const base = safeSegment(`${st}_${d.id.slice(-8)}`);
      const ct = (row.contentType ?? "").toLowerCase();
      const ext = ct.includes("png") ? "png" : ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : "pdf";
      const buf = await readPdfBytesFlexible({ pdfStoragePath: row.storagePath ?? null, pdfUrl: null });
      if (buf?.length) {
        supportIndex += 1;
        const name = `soportes-codeudor/${String(supportIndex).padStart(2, "0")}_${base}.${ext}`;
        tryAdd(name, buf, `${name} (${row.originalFilename ?? st})`);
      } else {
        manifest.push(`- (omitido) Soporte codeudor (${st}): no se pudo leer desde Storage.`);
      }
    }

    manifest.push("");
    manifest.push(
      "Notas: los archivos omitidos pueden deberse a que aún no se generó el PDF, a rutas no accesibles desde el servidor, a URLs firmadas expiradas o a los límites de tamaño del paquete. Vuelve a generar o descarga individual desde la vista de evidencia.",
    );
    zip.file("00-LEEME.txt", manifest.join("\n"));

    const out = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    auditEvent("evidence_bundle_downloaded", {
      contractId,
      contractVersionId,
      role: participant.role,
      approxBytes: out.length,
      contextTag: bundleContext === "notary" ? "notary" : "general",
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="evidencia-${safeSegment(contractId, 24)}-${stamp}.zip"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("contracts/evidence-bundle", err);
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo generar el paquete ZIP." }] },
      { status: 500 },
    );
  }
}
