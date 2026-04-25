import type { SignatureStatus } from "./types";

export function nextSignatureStatusOnOpen(current: SignatureStatus): SignatureStatus {
  if (current === "sent") return "opened";
  return current;
}

export function canBeSigned(current: SignatureStatus): boolean {
  return current === "sent" || current === "opened";
}

