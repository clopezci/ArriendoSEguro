"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Fotos de una zona del inventario. Flujo tipo "ráfaga":
 *  1) Tomas fotos con la cámara (una tras otra) o eliges varias de la galería;
 *     cada una entra a una **bandeja local** (galería virtual) con su miniatura,
 *     SIN subir todavía. Puedes descartar las que no sirvan.
 *  2) Cuando termines, pulsas **«Cargar»** y se suben TODAS juntas con una
 *     **barra de progreso**.
 * Cada imagen se **comprime en el navegador** (canvas) antes de subir —así no
 * pesa de más (evita el error 413 «Payload Too Large» y sube más rápido)— y se
 * guarda en Storage vía nuestra API. Hay un **tope de fotos** (`maxPhotos`).
 */

/**
 * Reduce la imagen a un máximo de lado (por defecto 1600px) y la reencoda a JPEG.
 * Una foto de celular (3–8 MB) baja a ~200–600 KB. Si no se puede decodificar
 * (p. ej. HEIC en algunos navegadores), devuelve el archivo original.
 */
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let width = bitmap.width;
    let height = bitmap.height;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // ya era pequeña
    const baseName = (file.name || "foto").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName || "foto"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // si no se pudo decodificar, sube el original
  }
}

type PendingPhoto = { id: string; file: File; preview: string };

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  }
}

export function InventoryZonePhotos({
  inventoryId,
  zoneId,
  photoUrls,
  onChange,
  maxPhotos = 30,
  onPendingChange,
}: {
  inventoryId: string;
  zoneId: string;
  photoUrls: string[];
  onChange: (next: string[]) => void;
  /** Tope de fotos (control de costo/almacenamiento). */
  maxPhotos?: number;
  /** Avisa al padre cuántas fotos quedan en la bandeja sin subir (para no
   *  finalizar y perderlas). */
  onPendingChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // Bandeja local: fotos tomadas/elegidas que aún NO se han subido.
  const [pending, setPending] = useState<PendingPhoto[]>([]);

  const total = photoUrls.length + pending.length; // subidas + en bandeja
  const capacity = Math.max(0, maxPhotos - total);
  const atLimit = capacity <= 0;

  // Avisar al padre del número de fotos SIN subir (para bloquear "finalizar").
  useEffect(() => { onPendingChange?.(pending.length); }, [pending.length, onPendingChange]);

  // Resolver miniaturas (URL firmada) para los storagePath gs:// ya subidos.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) return;
      for (const sp of photoUrls) {
        if (!sp.startsWith("gs://") || thumbs[sp]) continue;
        try {
          const res = await fetch(`/api/inventory/zone-photo/download-url?storagePath=${encodeURIComponent(sp)}`, {
            headers: { ...(await buildAuthHeaders(user)) },
          });
          const j = (await res.json()) as { success?: boolean; downloadUrl?: string };
          if (!cancelled && res.ok && j.success && j.downloadUrl) {
            setThumbs((t) => ({ ...t, [sp]: j.downloadUrl! }));
          }
        } catch {
          /* noop */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoUrls, user, thumbs]);

  /** Agrega fotos a la bandeja (aún sin subir), respetando el tope. */
  function addToTray(files: File[]) {
    if (files.length === 0) return;
    if (!inventoryId) {
      setMsg("Guarda primero el inventario para agregar fotos.");
      return;
    }
    if (capacity <= 0) {
      setMsg(`Llegaste al máximo de ${maxPhotos} fotos. Borra alguna si necesitas otra.`);
      return;
    }
    const take = files.slice(0, capacity);
    const capped = files.length > capacity;
    const additions: PendingPhoto[] = take.map((file) => {
      let preview = "";
      try { preview = URL.createObjectURL(file); } catch { /* noop */ }
      return { id: newId(), file, preview };
    });
    setPending((p) => [...p, ...additions]);
    setMsg(capped ? `Agregamos ${take.length}; solo caben ${maxPhotos} en total.` : "");
  }

  /** Quita una foto de la bandeja antes de subir. */
  function removePending(id: string) {
    setPending((p) => {
      const found = p.find((x) => x.id === id);
      if (found?.preview) { try { URL.revokeObjectURL(found.preview); } catch { /* noop */ } }
      return p.filter((x) => x.id !== id);
    });
  }

  /** Sube TODAS las fotos de la bandeja con barra de progreso. */
  async function uploadTray() {
    if (!user || !inventoryId || pending.length === 0 || busy) return;
    setBusy(true);
    setMsg("");
    const items = [...pending];
    setProgress({ done: 0, total: items.length });
    const uploadedPaths: string[] = [];
    const failed: PendingPhoto[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        const f = await compressImage(it.file);
        const q = new URLSearchParams({
          inventoryId,
          selectedZoneId: zoneId,
          filename: f.name || "foto.jpg",
          contentType: f.type || "image/jpeg",
        });
        const up = await fetch(`/api/inventory/zone-photo/upload?${q.toString()}`, {
          method: "POST",
          headers: { "content-type": f.type || "image/jpeg", ...(await buildAuthHeaders(user)) },
          body: f,
        });
        let upJson: { success?: boolean; storagePath?: string; errors?: { message?: string }[] } = {};
        try { upJson = (await up.json()) as typeof upJson; } catch { /* respuesta no-JSON */ }
        if (up.ok && upJson.success && upJson.storagePath) {
          // Reusa la miniatura local ya generada (no la revocamos: sigue visible).
          if (it.preview) setThumbs((t) => ({ ...t, [upJson.storagePath!]: it.preview }));
          uploadedPaths.push(upJson.storagePath);
        } else {
          failed.push(it);
        }
      } catch {
        failed.push(it);
      }
      setProgress({ done: i + 1, total: items.length });
    }
    if (uploadedPaths.length > 0) onChange([...photoUrls, ...uploadedPaths]);
    setPending(failed); // solo quedan en bandeja las que fallaron
    setBusy(false);
    setProgress(null);
    setMsg(
      failed.length > 0
        ? `Subimos ${uploadedPaths.length}. ${failed.length} no se pudo(eron); quedaron en la bandeja para reintentar.`
        : `¡Listo! ${uploadedPaths.length} foto(s) guardada(s) ✓`,
    );
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-700">Fotos de la zona</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Toma varias <b>(una tras otra)</b> o elige de la galería; se juntan abajo y luego pulsas <b>Cargar</b>.
        <b> Hasta {maxPhotos} fotos.</b>
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {/* Cámara: cada toque agrega UNA a la bandeja (efecto ráfaga). */}
        <label className={`cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 ${busy || atLimit ? "cursor-not-allowed opacity-50" : ""}`}>
          📷 Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy || atLimit}
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) addToTray(fs);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <label className={`cursor-pointer rounded-lg border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-violet-500 ${busy || atLimit ? "cursor-not-allowed opacity-50" : ""}`}>
          🖼️ Galería (varias)
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy || atLimit}
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) addToTray(fs);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <span className={`text-[11px] ${atLimit ? "font-semibold text-amber-700" : "text-slate-500"}`}>
          {photoUrls.length} subida(s){pending.length > 0 ? ` · ${pending.length} sin cargar` : ""} · máx {maxPhotos}
        </span>
      </div>

      {/* Bandeja local (sin subir) con botón «Cargar». */}
      {pending.length > 0 && (
        <div className="mt-2 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/50 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-violet-800">Por cargar ({pending.length})</p>
            <button
              type="button"
              onClick={() => { pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)); setPending([]); }}
              disabled={busy}
              className="text-[11px] font-medium text-slate-500 underline disabled:opacity-50"
            >
              Vaciar bandeja
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="Por cargar" className="h-16 w-16 rounded border border-violet-300 object-cover opacity-90" />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-rose-600 text-[11px] font-bold text-white"
                    aria-label="Descartar foto"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void uploadTray()}
            disabled={busy}
            className="mt-2.5 w-full rounded-xl bg-[#12B886] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            {busy ? "Cargando…" : `⬆️ Cargar ${pending.length} foto(s)`}
          </button>
          {/* Barra de progreso del lote. */}
          {progress && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span>Subiendo {progress.done} de {progress.total}…</span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#12B886] transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fotos ya subidas. */}
      {photoUrls.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-emerald-700">Subidas ({photoUrls.length})</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {photoUrls.map((sp, i) => (
              <div key={`${sp}-${i}`} className="relative">
                {thumbs[sp] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[sp]} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded border border-slate-300 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded border border-slate-300 bg-slate-100 text-[10px] text-slate-500">
                    {sp.startsWith("gs://") ? "…" : "foto"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onChange(photoUrls.filter((_, j) => j !== i))}
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-rose-600 text-[11px] font-bold text-white"
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="mt-1.5 text-[11px] text-emerald-700">{msg}</p>}
    </div>
  );
}
