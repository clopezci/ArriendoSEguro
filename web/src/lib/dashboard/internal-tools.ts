import { isFounderAdminEmail } from "@/lib/admin/founder-admins";

/**
 * Herramientas internas de desarrollo/admin en el dashboard (demo local, mock approve, etc.).
 *
 * Los correos de fundador SIEMPRE ven el menú Admin (built-in), sin depender de
 * variables de entorno. El resto se controla con `NEXT_PUBLIC_ADMIN_INTERNAL_*`.
 * Recuerda: esto es SOLO UI; la autorización real en API la hace el servidor.
 */
export function canSeeInternalDashboardTools(
  userEmail: string | null | undefined,
): boolean {
  if (isFounderAdminEmail(userEmail)) return true;
  const isDev = process.env.NODE_ENV !== "production";
  const envFlag = process.env.NEXT_PUBLIC_ADMIN_INTERNAL_ENABLED === "true";
  const internalUiEnabled = isDev || envFlag;
  if (!internalUiEnabled) return false;
  if (isDev) return true;
  const allowed = (process.env.NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return userEmail ? allowed.includes(userEmail.toLowerCase()) : false;
}
