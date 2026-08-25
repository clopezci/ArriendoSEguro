import type { DecodedIdToken } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { FOUNDER_ADMIN_EMAILS, isFounderAdminEmail } from "@/lib/admin/founder-admins";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Autorización del panel interno. Hay TRES fuentes de administradores, y el
 * acceso se concede si el correo está en cualquiera:
 *   1. Fundadores (built-in, en código) — nunca se pueden quitar.
 *   2. `ADMIN_INTERNAL_EMAILS` (variable de entorno del servidor).
 *   3. Lista guardada en Firestore (`admin_config/internal_admins.emails`),
 *      editable SOLO por un admin ya existente desde el panel.
 *
 * Nunca uses NEXT_PUBLIC_* para autorizar en API.
 *
 * Nota de seguridad: la versión SÍNCRONA (`getAdminInternalEmailSet` /
 * `isInternalAdminEmail`) solo considera fundadores + entorno. Es el "piso"
 * fail-safe: si algún sitio no migró a la versión async, JAMÁS concede acceso de
 * más — a lo sumo, un admin agregado por UI no es reconocido en ese punto. La
 * versión ASYNC (`*Async`) suma la lista de Firestore y es la que usa
 * `requireInternalAdmin`.
 */

export const INTERNAL_ADMINS_COLLECTION = "admin_config";
export const INTERNAL_ADMINS_DOC_ID = "internal_admins";

function envAdminEmails(): string[] {
  const raw = process.env.ADMIN_INTERNAL_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Fundadores + entorno (síncrono, sin Firestore). Piso fail-safe. */
export function getAdminInternalEmailSet(): Set<string> {
  return new Set([...FOUNDER_ADMIN_EMAILS, ...envAdminEmails()]);
}

export function isInternalAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminInternalEmailSet().has(email.trim().toLowerCase());
}

/** Correos extra guardados en Firestore (best-effort; [] si falla/no hay). */
export async function getStoredAdminEmails(): Promise<string[]> {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return [];
    const snap = await firestore.collection(INTERNAL_ADMINS_COLLECTION).doc(INTERNAL_ADMINS_DOC_ID).get();
    const data = snap.exists ? (snap.data() as { emails?: unknown }) : null;
    const emails = Array.isArray(data?.emails) ? (data!.emails as unknown[]) : [];
    return emails
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Fundadores + entorno + Firestore (async). Fuente completa de verdad. */
export async function getAdminInternalEmailSetAsync(): Promise<Set<string>> {
  const stored = await getStoredAdminEmails();
  return new Set([...FOUNDER_ADMIN_EMAILS, ...envAdminEmails(), ...stored]);
}

export async function isInternalAdminEmailAsync(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  // Piso rápido sin tocar Firestore.
  if (getAdminInternalEmailSet().has(target)) return true;
  const stored = await getStoredAdminEmails();
  return stored.includes(target);
}

/** ¿El correo es fundador (no removible desde la UI)? */
export function isFounderEmail(email: string | null | undefined): boolean {
  return isFounderAdminEmail(email);
}

export async function requireInternalAdmin(request: Request): Promise<
  | { ok: true; user: { uid: string; email: string; decoded: DecodedIdToken } }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  if (!(await isInternalAdminEmailAsync(auth.user.email))) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "auth", message: "No autorizado para el panel administrativo." }] },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: auth.user };
}
