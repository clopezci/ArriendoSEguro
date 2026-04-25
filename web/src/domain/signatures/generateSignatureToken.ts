import { createHash, randomBytes } from "node:crypto";

export function hashSignatureToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSignatureToken(signatureId: string): { token: string; tokenHash: string } {
  const secret = randomBytes(24).toString("hex");
  const token = `${signatureId}.${secret}`;
  return { token, tokenHash: hashSignatureToken(token) };
}

