"use client";

/**
 * Sincronización de borradores con el servidor (resume desde cualquier
 * dispositivo). Es **aditiva** sobre `localStorage`: el wizard sigue guardando
 * local primero (rápido, offline) y aquí empujamos/traemos del servidor.
 *
 * - `syncDraftToServer`: empuja un borrador (PUT) con debounce y sin bloquear
 *   la UI (fire-and-forget). Solo para usuarios autenticados y borradores reales
 *   (los de demo no se sincronizan).
 * - `pullServerDraftsIntoLocal`: trae los borradores del usuario y los combina
 *   con los locales ("más reciente gana"), devolviendo cuántos quedaron.
 */

import { getAuthClient } from "@/lib/firebase/client";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { mergeDraftsByRecency } from "@/domain/contracts/contractDraftSync";
import { getAllDrafts, saveAllDrafts, type ContractDraft } from "@/features/contracts/wizard-state";

const DEBOUNCE_MS = 1500;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function currentAuthHeaders(): Promise<HeadersInit | null> {
  try {
    const user = getAuthClient().currentUser;
    if (!user) return null;
    return await buildAuthHeaders(user);
  } catch {
    return null;
  }
}

async function putDraft(draft: ContractDraft): Promise<void> {
  const headers = await currentAuthHeaders();
  if (!headers) return;
  try {
    await fetch("/api/contracts/drafts", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ draft }),
      keepalive: true,
    });
  } catch {
    // Sin conexión o error transitorio: el borrador sigue salvo en localStorage
    // y se reintentará en el próximo guardado.
  }
}

/** Empuja el borrador al servidor con debounce por id (no bloquea la UI). */
export function syncDraftToServer(draft: ContractDraft): void {
  if (typeof window === "undefined") return;
  if (!draft?.id || draft.isDemo) return;

  const prev = pendingTimers.get(draft.id);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(() => {
    pendingTimers.delete(draft.id);
    void putDraft(draft);
  }, DEBOUNCE_MS);
  pendingTimers.set(draft.id, timer);
}

/**
 * Trae los borradores del servidor y los combina con los locales por recencia.
 * Devuelve el total tras la combinación, o null si no se pudo (sin sesión/red).
 */
export async function pullServerDraftsIntoLocal(): Promise<number | null> {
  if (typeof window === "undefined") return null;
  const headers = await currentAuthHeaders();
  if (!headers) return null;
  try {
    const res = await fetch("/api/contracts/drafts", { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; drafts?: ContractDraft[] };
    if (!data.success || !Array.isArray(data.drafts)) return null;

    const local = getAllDrafts();
    const merged = mergeDraftsByRecency(local, data.drafts);
    saveAllDrafts(merged);
    return merged.length;
  } catch {
    return null;
  }
}
