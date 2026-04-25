import { hashSignatureToken } from "./generateSignatureToken";

export function parseSignatureToken(token: string): { signatureId: string; tokenHash: string } | null {
  const [signatureId, secret] = token.split(".");
  if (!signatureId || !secret || secret.length < 20) return null;
  return { signatureId, tokenHash: hashSignatureToken(token) };
}

export function isTokenExpired(tokenExpiresAt: string): boolean {
  const ts = new Date(tokenExpiresAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() > ts;
}

