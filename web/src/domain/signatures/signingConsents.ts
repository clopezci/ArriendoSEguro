import { createHash } from "node:crypto";

import { SIGNING_CONSENT_TEXTS } from "./signingConsentTexts";

export { SIGNING_CONSENT_TEXTS };

/** Hash estable del bloque de consentimientos para evidencia (Bloque 7). Solo servidor. */
export function hashConsentBlock(): string {
  const payload = JSON.stringify(SIGNING_CONSENT_TEXTS);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
