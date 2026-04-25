import { createHash } from "node:crypto";

export function makeWompiEvent(input: {
  reference: string;
  status: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED" | "ERROR";
  amountInCents: number;
  currency: string;
  txId: string;
  secret: string;
}) {
  const event = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: input.txId,
        status: input.status,
        amount_in_cents: input.amountInCents,
        currency: input.currency,
        reference: input.reference,
        payment_method_type: "CARD",
      },
    },
    signature: {
      properties: [
        "data.transaction.id",
        "data.transaction.status",
        "data.transaction.amount_in_cents",
        "data.transaction.reference",
      ],
      checksum: "",
    },
  };
  const base =
    `${event.data.transaction.id}` +
    `${event.data.transaction.status}` +
    `${event.data.transaction.amount_in_cents}` +
    `${event.data.transaction.reference}`;
  event.signature.checksum = createHash("sha256").update(`${base}${input.secret}`).digest("hex");
  return event;
}

