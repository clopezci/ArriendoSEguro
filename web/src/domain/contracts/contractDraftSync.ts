/**
 * Borradores de contrato en servidor (resume-desde-cualquier-dispositivo).
 *
 * El wizard guarda el borrador en `localStorage` (rápido, offline). De forma
 * **aditiva**, cada guardado se sincroniza a Firestore (`contract_drafts`) atado
 * al usuario autenticado, para que pueda retomar el expediente desde otro equipo.
 *
 * Reglas de diseño:
 * - El dueño SIEMPRE es el uid del token en el servidor; nunca confiamos en el
 *   `userId` que venga en el cuerpo para decidir propiedad.
 * - Sin costo relevante: una escritura por guardado (con debounce en el cliente).
 * - El merge "más reciente gana" por `lastUpdatedAt` permite combinar lo local
 *   con lo del servidor sin perder avances.
 *
 * Este módulo es **puro** (sin Firebase ni `window`) para poder reusarlo en el
 * route handler (servidor) y en el cliente, y cubrirlo con tests.
 */

import { z } from "zod";

export const CONTRACT_DRAFTS_COLLECTION = "contract_drafts";

/**
 * Tope defensivo del tamaño del borrador serializado. Un expediente normal pesa
 * unos pocos KB; 256K deja margen amplio y evita documentos abusivos.
 */
export const MAX_DRAFT_PAYLOAD_CHARS = 256 * 1024;

/** Validación mínima del envoltorio; el resto del borrador se acepta tal cual. */
const draftEnvelopeSchema = z
  .object({
    id: z.string().min(1).max(200),
    userId: z.string().min(1).max(200),
    lastUpdatedAt: z.string().min(1).max(60),
  })
  .passthrough();

export type IncomingDraft = z.infer<typeof draftEnvelopeSchema> & Record<string, unknown>;

export type ParseDraftResult =
  | { ok: true; draft: IncomingDraft }
  | { ok: false; message: string };

export function parseIncomingDraft(raw: unknown): ParseDraftResult {
  const parsed = draftEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Borrador inválido: faltan id, userId o lastUpdatedAt." };
  }
  const size = JSON.stringify(parsed.data).length;
  if (size > MAX_DRAFT_PAYLOAD_CHARS) {
    return { ok: false, message: "El borrador supera el tamaño permitido." };
  }
  return { ok: true, draft: parsed.data as IncomingDraft };
}

/** Documento que se persiste en Firestore. El dueño se fija en el servidor. */
export function buildDraftDocument(ownerUid: string, draft: IncomingDraft): {
  ownerUid: string;
  draftId: string;
  lastUpdatedAt: string;
  payload: IncomingDraft;
} {
  return {
    ownerUid,
    draftId: draft.id,
    lastUpdatedAt: draft.lastUpdatedAt,
    payload: draft,
  };
}

type WithIdAndTime = { id: string; lastUpdatedAt?: string };

function timeOf(d: WithIdAndTime): number {
  const t = Date.parse(d.lastUpdatedAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * Combina borradores locales y del servidor por `id`, conservando la versión
 * con `lastUpdatedAt` más reciente. No muta las entradas.
 */
export function mergeDraftsByRecency<T extends WithIdAndTime>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const d of local) byId.set(d.id, d);
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing || timeOf(r) > timeOf(existing)) {
      byId.set(r.id, r);
    }
  }
  return [...byId.values()].sort((a, b) => timeOf(b) - timeOf(a));
}
