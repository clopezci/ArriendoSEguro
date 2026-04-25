import type { User } from "firebase/auth";

/** Encabezado Authorization con ID token de Firebase (cliente). */
export async function buildAuthHeaders(user: User | null): Promise<HeadersInit> {
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
