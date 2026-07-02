/**
 * Correos de fundador con acceso admin permanente (built-in).
 *
 * Estos correos son SIEMPRE administradores, sin depender de variables de
 * entorno. Las variables `ADMIN_INTERNAL_EMAILS` (servidor) y
 * `NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS` (solo UI) siguen funcionando para AGREGAR
 * más correos; estos se suman a la lista siempre.
 */
export const FOUNDER_ADMIN_EMAILS: readonly string[] = [
  "clpezci@gmail.com",
  "clopezci@hotmail.com",
];

/** ¿El correo es uno de los fundadores? (normaliza mayúsculas/espacios). */
export function isFounderAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
