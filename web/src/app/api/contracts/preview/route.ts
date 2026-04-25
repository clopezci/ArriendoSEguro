import { NextResponse } from "next/server";
import {
  contractPreviewRequestSchema,
  type ContractPreviewResponse,
} from "@/domain/contracts/api-types";
import { renderResidentialLeaseContract } from "@/domain/contracts/renderResidentialLeaseContract";
import { validateContractData } from "@/domain/contracts/validateContractData";

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

    const rendered = renderResidentialLeaseContract(payload);
    return NextResponse.json<ContractPreviewResponse>({
      success: true,
      html: rendered.html,
      validationErrors: [],
      contractVersionDraft: {
        versionNumber: 1,
        generatedAt: rendered.generatedAt,
        documentHash: rendered.documentHash,
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

