import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { encryptSecret, decryptSecret, secretsConfigured } from "@/lib/security/agencySecrets";
import {
  generateTotpSecret,
  buildOtpauthUri,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
} from "@/lib/security/totp";

/**
 * Segundo factor (TOTP) del panel admin. Cada admin enrola una app autenticadora;
 * su secreto se guarda CIFRADO (AES, misma llave `AGENCY_SECRETS_KEY`) en
 * `admin_mfa/{uid}`. Una "sesión MFA" válida dura `MFA_SESSION_HOURS` horas: tras
 * verificar el código, los endpoints admin dejan pasar hasta que expire.
 *
 * Break-glass (si pierdes el autenticador y los códigos de respaldo): borra el
 * documento `admin_mfa/{uid}` desde la consola de Firestore (ya protegida con la
 * 2FA de tu cuenta Google) y vuelve a enrolar.
 */

export const ADMIN_MFA_COLLECTION = "admin_mfa";
const MFA_SESSION_HOURS = 8;

type AdminMfaDoc = {
  enrolled?: boolean;
  secretEnc?: string | null;
  pendingSecretEnc?: string | null;
  verifiedUntil?: string | null;
  backupCodeHashes?: string[];
  enrolledAt?: string;
};

async function getDoc(firestore: Firestore, uid: string): Promise<AdminMfaDoc | null> {
  const snap = await firestore.collection(ADMIN_MFA_COLLECTION).doc(uid).get();
  return snap.exists ? (snap.data() as AdminMfaDoc) : null;
}

/** ¿El admin tiene una sesión MFA vigente? (o no está enrolado todavía). */
export async function getAdminMfaStatus(
  firestore: Firestore,
  uid: string,
): Promise<{ enrolled: boolean; verified: boolean }> {
  const d = await getDoc(firestore, uid);
  const enrolled = d?.enrolled === true && Boolean(d?.secretEnc);
  const verified = Boolean(d?.verifiedUntil && new Date(d.verifiedUntil) > new Date());
  return { enrolled, verified };
}

/**
 * Para el guard: ¿hay que BLOQUEAR por MFA? Solo si YA está enrolado y la sesión
 * MFA no está vigente. Si no está enrolado, no bloquea (deja enrolar primero).
 */
export async function isAdminMfaBlocking(firestore: Firestore, uid: string): Promise<boolean> {
  const { enrolled, verified } = await getAdminMfaStatus(firestore, uid);
  return enrolled && !verified;
}

/** Inicia enrolamiento: genera y guarda (cifrado) un secreto PENDIENTE. */
export async function startAdminMfaEnroll(
  firestore: Firestore,
  uid: string,
  accountLabel: string,
): Promise<{ ok: true; otpauthUri: string; secret: string } | { ok: false; error: string }> {
  if (!secretsConfigured()) return { ok: false, error: "secrets_not_configured" };
  const d = await getDoc(firestore, uid);
  if (d?.enrolled) return { ok: false, error: "already_enrolled" };
  const secret = generateTotpSecret();
  const enc = encryptSecret(secret);
  if (!enc) return { ok: false, error: "encrypt_failed" };
  await firestore.collection(ADMIN_MFA_COLLECTION).doc(uid).set(
    { enrolled: false, pendingSecretEnc: enc, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { ok: true, otpauthUri: buildOtpauthUri(secret, accountLabel), secret };
}

/** Confirma enrolamiento con un código del autenticador. Devuelve códigos de respaldo (una vez). */
export async function confirmAdminMfaEnroll(
  firestore: Firestore,
  uid: string,
  code: string,
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const d = await getDoc(firestore, uid);
  if (!d?.pendingSecretEnc) return { ok: false, error: "no_pending" };
  const secret = decryptSecret(d.pendingSecretEnc);
  if (!secret) return { ok: false, error: "decrypt_failed" };
  if (!verifyTotp(secret, code)) return { ok: false, error: "invalid_code" };

  const backupCodes = generateBackupCodes(10);
  const until = new Date(Date.now() + MFA_SESSION_HOURS * 3600_000).toISOString();
  await firestore.collection(ADMIN_MFA_COLLECTION).doc(uid).set(
    {
      enrolled: true,
      secretEnc: d.pendingSecretEnc,
      pendingSecretEnc: FieldValue.delete(),
      backupCodeHashes: backupCodes.map(hashBackupCode),
      verifiedUntil: until,
      enrolledAt: new Date().toISOString(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, backupCodes };
}

/** Verifica un código TOTP (o de respaldo) y abre la sesión MFA. */
export async function verifyAdminMfa(
  firestore: Firestore,
  uid: string,
  code: string,
): Promise<{ ok: true; usedBackup: boolean } | { ok: false; error: string }> {
  const d = await getDoc(firestore, uid);
  if (!d?.enrolled || !d.secretEnc) return { ok: false, error: "not_enrolled" };
  const secret = decryptSecret(d.secretEnc);
  if (!secret) return { ok: false, error: "decrypt_failed" };

  const until = new Date(Date.now() + MFA_SESSION_HOURS * 3600_000).toISOString();

  if (verifyTotp(secret, code)) {
    await firestore.collection(ADMIN_MFA_COLLECTION).doc(uid).set(
      { verifiedUntil: until, updatedAtServer: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { ok: true, usedBackup: false };
  }

  // Intento con código de respaldo (se consume al usarse).
  const hashes = Array.isArray(d.backupCodeHashes) ? d.backupCodeHashes : [];
  const h = hashBackupCode(code);
  if (hashes.includes(h)) {
    await firestore.collection(ADMIN_MFA_COLLECTION).doc(uid).set(
      {
        verifiedUntil: until,
        backupCodeHashes: hashes.filter((x) => x !== h),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true, usedBackup: true };
  }

  return { ok: false, error: "invalid_code" };
}
