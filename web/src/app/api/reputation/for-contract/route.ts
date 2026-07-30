import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import {
  REPUTATION_CRITERIA,
  directionForRaterRole,
  type ReputationDirection,
} from "@/domain/reputation/criteria";

export const runtime = "nodejs";

const REVIEWS_COLLECTION = "reputation_reviews";
const RATEABLE_STATUSES = new Set(["signed", "closed", "finished", "completed"]);

type ReplyView = {
  reason: string;
  text: string;
  byRole: string;
  createdAt: string;
  attachmentUrl: string | null;
} | null;

type ReviewView = {
  direction: string;
  ratings: Record<string, number>;
  overall: number;
  raterRole: string;
  updatedAt: string;
  lowRating: boolean;
  lowCriteriaKeys: string[];
  replyDeadline: string | null;
  reply: ReplyView;
} | null;

async function readReview(
  firestore: NonNullable<ReturnType<typeof getAdminFirestore>>,
  contractId: string,
  direction: ReputationDirection,
): Promise<ReviewView> {
  const snap = await firestore.collection(REVIEWS_COLLECTION).doc(`${contractId}__${direction}`).get();
  if (!snap.exists) return null;
  const x = snap.data() as Record<string, unknown>;
  const rawReply = x.reply as Record<string, unknown> | undefined;
  return {
    direction,
    ratings: (x.ratings as Record<string, number>) ?? {},
    overall: Number(x.overall ?? 0),
    raterRole: String(x.raterRole ?? ""),
    updatedAt: String(x.updatedAt ?? ""),
    lowRating: Boolean(x.lowRating),
    lowCriteriaKeys: Array.isArray(x.lowCriteriaKeys) ? (x.lowCriteriaKeys as string[]) : [],
    replyDeadline: x.replyDeadline ? String(x.replyDeadline) : null,
    reply: rawReply
      ? {
          reason: String(rawReply.reason ?? ""),
          text: String(rawReply.text ?? ""),
          byRole: String(rawReply.byRole ?? ""),
          createdAt: String(rawReply.createdAt ?? ""),
          attachmentUrl: rawReply.attachmentUrl ? String(rawReply.attachmentUrl) : null,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const contractId = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!contractId) {
    return NextResponse.json(
      { success: false, errors: [{ field: "contractId", message: "Falta contractId." }] },
      { status: 422 },
    );
  }

  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  const myDirection = directionForRaterRole(participant.role);
  const cSnap = await firestore.collection("contracts").doc(contractId).get();
  const status = String((cSnap.data() as { status?: string } | undefined)?.status ?? "draft");
  const canRate = Boolean(myDirection) && RATEABLE_STATUSES.has(status);

  if (!myDirection) {
    return NextResponse.json({
      success: true,
      canRate: false,
      reason: "role",
      myDirection: null,
      criteria: [],
      myReview: null,
      counterpartReview: null,
    });
  }

  const otherDirection: ReputationDirection =
    myDirection === "landlord_to_tenant" ? "tenant_to_landlord" : "landlord_to_tenant";

  const myReview = await readReview(firestore, contractId, myDirection);
  // La calificación que recibí (soy su sujeto) es siempre visible para mí, para
  // poder ejercer el derecho de réplica. `otherDirection` es justamente esa.
  const counterpartReview = await readReview(firestore, contractId, otherDirection);

  return NextResponse.json({
    success: true,
    canRate,
    reason: canRate ? null : "status",
    contractStatus: status,
    myDirection,
    criteria: REPUTATION_CRITERIA[myDirection],
    myReview,
    counterpartReview,
  });
}
