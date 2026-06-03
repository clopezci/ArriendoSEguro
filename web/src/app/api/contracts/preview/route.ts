import { NextResponse } from "next/server";
import {
  contractPreviewRequestSchema,
  type ContractPreviewResponse,
} from "@/domain/contracts/api-types";
import { renderResidentialLeaseDispatch } from "@/domain/contracts/renderResidentialLeaseDispatch";
import { applyDemoWatermark } from "@/domain/contracts/demoWatermark";
import { applyFreeTierWatermark, type FreeTierCtaOptions } from "@/domain/contracts/freeTierWatermark";
import { validateContractData } from "@/domain/contracts/validateContractData";
import { generateDocumentHash } from "@/domain/contracts/hash";
import { freeTierEnabled } from "@/lib/config";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getPlanPlusPricingForPublicPages } from "@/domain/platform-payments/plan-plus-pricing";

export const runtime = "nodejs";
const MAX_JSON_BYTES = 128_000;

/**
 * TODO(auth): validar sesión del usuario antes de permitir preview.
 * TODO(access): validar accessStatus = "paid" o "demo" server-side.
 */
export async function POST(request: Request) {
  try {
    const len = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(len) && len > MAX_JSON_BYTES) {
      return NextResponse.json<ContractPreviewResponse>(
        {
          success: false,
          html: null,
          validationErrors: [{ field: "payload", message: "Solicitud demasiado grande." }],
          contractVersionDraft: null,
        },
        { status: 413 },
      );
    }

    const raw = await request.text();
    if (raw.length > MAX_JSON_BYTES) {
      return NextResponse.json<ContractPreviewResponse>(
        {
          success: false,
          html: null,
          validationErrors: [{ field: "payload", message: "Solicitud demasiado grande." }],
          contractVersionDraft: null,
        },
        { status: 413 },
      );
    }

    const json = JSON.parse(raw) as unknown;
    const parsedReq = contractPreviewRequestSchema.safeParse(json);
    if (!parsedReq.success) {
      return NextResponse.json<ContractPreviewResponse>(
        {
          success: false,
          html: null,
          validationErrors: parsedReq.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
          contractVersionDraft: null,
        },
        { status: 422 },
      );
    }

    const payload = parsedReq.data.contractPayload;
    const validation = validateContractData(payload);
    if (!validation.ok) {
      return NextResponse.json<ContractPreviewResponse>(
        {
          success: false,
          html: null,
          validationErrors: validation.issues,
          contractVersionDraft: null,
        },
        { status: 422 },
      );
    }

    let rendered;
    try {
      rendered = renderResidentialLeaseDispatch(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo generar la vista previa del contrato.";
      return NextResponse.json<ContractPreviewResponse>(
        {
          success: false,
          html: null,
          validationErrors: [{ field: "contractVersion", message: msg }],
          contractVersionDraft: null,
        },
        { status: 422 },
      );
    }
    const useFreeWatermark = !parsedReq.data.isDemo && freeTierEnabled && Boolean(parsedReq.data.isFreeTier);

    // Para el CTA del tier gratis: valor total del contrato (canon × meses) y
    // precio de referencia de Plus, para mostrar "menos del 0,X% del valor".
    let freeOpts: FreeTierCtaOptions = {};
    if (useFreeWatermark) {
      const total =
        (Number(payload.lease?.monthlyRent) || 0) * (Number(payload.lease?.termMonths) || 0);
      let plusPriceCop = 0;
      try {
        const pricing = await getPlanPlusPricingForPublicPages(getAdminFirestore());
        plusPriceCop = Number(pricing.checkoutCop) || 0;
      } catch {
        /* sin precio: el CTA usa el copy genérico */
      }
      freeOpts = { totalContractCop: total, plusPriceCop };
    }

    const html = parsedReq.data.isDemo
      ? applyDemoWatermark(rendered.html)
      : useFreeWatermark
        ? applyFreeTierWatermark(rendered.html, freeOpts)
        : rendered.html;
    // Importante: el hash debe calcularse sobre el HTML que se envía al
    // cliente, no sobre el HTML "limpio" pre-watermark. De lo contrario,
    // cuando el cliente vuelva a enviar el HTML al endpoint de
    // `save-draft-version`, el rehash del servidor no coincidirá con el
    // hash devuelto en este preview y el guardado de la versión fallará
    // con "Hash no coincide con el HTML recibido" en modo demo
    // (regresión vista en producción al añadir la marca de agua).
    const documentHash =
      parsedReq.data.isDemo || useFreeWatermark ? generateDocumentHash(html) : rendered.documentHash;
    return NextResponse.json<ContractPreviewResponse>({
      success: true,
      html,
      validationErrors: [],
      contractVersionDraft: {
        versionNumber: 1,
        generatedAt: rendered.generatedAt,
        documentHash,
        hasSolidaryCoDebtor: payload.hasSolidaryCoDebtor,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("contracts/preview error", error);
    }
    return NextResponse.json<ContractPreviewResponse>(
      {
        success: false,
        html: null,
        validationErrors: [{ field: "server", message: "No se pudo generar la vista previa." }],
        contractVersionDraft: null,
        message: "Error interno al generar la vista previa.",
      },
      { status: 500 },
    );
  }
}

