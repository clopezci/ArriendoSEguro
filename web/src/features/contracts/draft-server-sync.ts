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

function currentUid(): string | null {
  try {
    return getAuthClient().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

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

/**
 * Marca un borrador local como "ya sincronizado con el servidor" (guarda
 * `serverSyncedAt`). Esto habilita la propagación de borrados: en el `pull`, un
 * borrador con esta marca que ya no esté en el servidor se considera BORRADO en
 * otro equipo y se elimina localmente (no se resucita).
 */
function markLocalSynced(id: string): void {
  try {
    const all = getAllDrafts();
    const i = all.findIndex((d) => d.id === id);
    if (i < 0) return;
    all[i] = { ...all[i], serverSyncedAt: new Date().toISOString() };
    saveAllDrafts(all);
  } catch {
    /* si localStorage falla, no rompemos el flujo */
  }
}

async function putDraft(draft: ContractDraft): Promise<void> {
  const headers = await currentAuthHeaders();
  if (!headers) return;
  try {
    const res = await fetch("/api/contracts/drafts", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ draft }),
      keepalive: true,
    });
    if (res.ok) markLocalSynced(draft.id);
  } catch {
    // Sin conexión o error transitorio: el borrador sigue salvo en localStorage
    // y se reintentará en el próximo guardado.
  }
}

/**
 * Empuja el borrador al servidor AHORA (sin debounce) y espera la respuesta.
 * Se usa en momentos críticos —registro y fin del recorrido— para asegurar que
 * los datos quedan guardados en la cuenta antes de navegar, sin depender del
 * temporizador. Cancela cualquier debounce pendiente del mismo borrador.
 */
export async function flushDraftToServer(draft: ContractDraft): Promise<boolean> {
  if (typeof window === "undefined" || !draft?.id || draft.isDemo) return false;
  const prev = pendingTimers.get(draft.id);
  if (prev) { clearTimeout(prev); pendingTimers.delete(draft.id); }
  const headers = await currentAuthHeaders();
  if (!headers) return false;
  try {
    const res = await fetch("/api/contracts/drafts", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ draft }),
      keepalive: true,
    });
    if (res.ok) markLocalSynced(draft.id);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Empuja al servidor los borradores locales del usuario que AÚN NO se han
 * sincronizado (nuevos, creados offline). Así aparecen también en otros equipos.
 *
 * IMPORTANTE: NO re-sube los que ya tienen `serverSyncedAt`. Antes se subían
 * TODOS, y eso RESUCITABA en el servidor los borradores que se habían borrado en
 * otro equipo (el bug de "vuelven a aparecer los contratos borrados"). Los ya
 * sincronizados se mantienen al día por `syncDraftToServer`/`flushDraftToServer`
 * cuando se editan; su BORRADO lo propaga `pullServerDraftsIntoLocal`.
 */
export async function flushAllLocalDraftsToServer(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;
  const headers = await currentAuthHeaders();
  if (!headers) return;
  const neverSynced = getAllDrafts().filter(
    (d) => d.userId === userId && !d.isDemo && d.id && !d.serverSyncedAt,
  );
  await Promise.allSettled(
    neverSynced.map(async (draft) => {
      try {
        const res = await fetch("/api/contracts/drafts", {
          method: "PUT",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ draft }),
          keepalive: true,
        });
        if (res.ok) markLocalSynced(draft.id);
      } catch {
        /* best-effort */
      }
    }),
  );
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

    // Propaga BORRADOS entre equipos: si un borrador de ESTE usuario ya se había
    // sincronizado (`serverSyncedAt`) pero ya NO está en el servidor, es que se
    // borró en otro dispositivo → se elimina aquí también. Los que nunca se
    // sincronizaron (nuevos offline) se conservan hasta que suban.
    const uid = currentUid();
    const nowIso = new Date().toISOString();
    const serverIds = new Set(data.drafts.map((d) => String((d as { id?: string }).id ?? "")));
    const reconciled = merged
      // Todo borrador presente en el servidor queda marcado como sincronizado
      // (aunque el merge tomara una versión sin la marca). Así, si luego se borra
      // en otro equipo, aquí se detecta y elimina (no se resucita).
      .map((d) => (serverIds.has(d.id) && !d.serverSyncedAt ? { ...d, serverSyncedAt: nowIso } : d))
      .filter((d) => {
        if (d.isDemo) return true;
        if (uid && d.userId === uid && d.serverSyncedAt && !serverIds.has(d.id)) {
          return false; // estaba sincronizado y ya no está en el servidor → borrado en otro equipo
        }
        return true;
      });

    saveAllDrafts(reconciled);
    return reconciled.length;
  } catch {
    return null;
  }
}
