import type { User } from "firebase/auth";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import type {
  SavedLandlordProfile,
  SavedProperty,
  SavedPropertyData,
} from "@/domain/saved-entities/savedEntities";

/**
 * Cliente para los datos del dueño y sus inmuebles guardados (atados a la
 * cuenta). Todas las llamadas envían el token; el servidor filtra por uid.
 */

export async function getMyLandlordProfile(user: User): Promise<SavedLandlordProfile | null> {
  try {
    const res = await fetch("/api/me/landlord-profile", { headers: { ...(await buildAuthHeaders(user)) } });
    const j = (await res.json()) as { success?: boolean; profile?: SavedLandlordProfile | null };
    return res.ok && j.success ? j.profile ?? null : null;
  } catch {
    return null;
  }
}

export async function saveMyLandlordProfile(user: User, profile: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/me/landlord-profile", {
      method: "PUT",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
      body: JSON.stringify({ profile }),
    });
    const j = (await res.json()) as { success?: boolean };
    return Boolean(res.ok && j.success);
  } catch {
    return false;
  }
}

export async function listMyProperties(user: User): Promise<SavedProperty[]> {
  try {
    const res = await fetch("/api/me/properties", { headers: { ...(await buildAuthHeaders(user)) } });
    const j = (await res.json()) as { success?: boolean; properties?: SavedProperty[] };
    return res.ok && j.success ? j.properties ?? [] : [];
  } catch {
    return [];
  }
}

export async function saveMyProperty(
  user: User,
  input: { label: string; property: SavedPropertyData | unknown },
): Promise<{ ok: boolean; id?: string }> {
  try {
    const res = await fetch("/api/me/properties", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
      body: JSON.stringify(input),
    });
    const j = (await res.json()) as { success?: boolean; id?: string };
    return { ok: Boolean(res.ok && j.success), id: j.id };
  } catch {
    return { ok: false };
  }
}

export async function deleteMyProperty(user: User, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/me/properties?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...(await buildAuthHeaders(user)) },
    });
    const j = (await res.json()) as { success?: boolean };
    return Boolean(res.ok && j.success);
  } catch {
    return false;
  }
}
