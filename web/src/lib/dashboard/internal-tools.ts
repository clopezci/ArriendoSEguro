/**
 * Herramientas internas de desarrollo/admin en el dashboard (demo local, mock approve, etc.).
 */
export function canSeeInternalDashboardTools(
  userEmail: string | null | undefined,
): boolean {
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
