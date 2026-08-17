"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Fotos de una zona del inventario: permite **tomar foto con la cámara** (móvil)
 * o elegir **varias imágenes de la galería a la vez**. Cada imagen se **comprime
 * en el navegador** (canvas) antes de subir —así no pesa de más (evita el error
 * 413 «Payload Too Large» y sube mucho más rápido)— y se envía a Storage vía
 * nuestra API. La subida es EN LOTE con **barra de progreso** para no impacientar.
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

export function InventoryZonePhotos({
  inventoryId,
  zoneId,
  photoUrls,
  onChange,
  maxPhotos = 30,
}: {
  inventoryId: string;
  zoneId: string;
  photoUrls: string[];
  onChange: (next: string[]) => void;
  /** Tope de fotos (control de costo/almacenamiento). */
  maxPhotos?: number;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const remaining = Math.max(0, maxPhotos - photoUrls.length);
  const atLimit = remaining <= 0;

  // Resolver miniaturas (URL firmada) para los storagePath gs://.
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

  /** Sube una o varias fotos EN LOTE: comprime → sube → va sumando al listado. */
  async function onPickMany(files: File[]) {
    if (!user || !inventoryId) {
      setMsg("Guarda primero el inventario para subir fotos.");
      return;
    }
    if (files.length === 0) return;
    if (remaining <= 0) {
      setMsg(`Llegaste al máximo de ${maxPhotos} fotos. Borra alguna si necesitas agregar otra.`);
      return;
    }
    // Respeta el tope: si eligieron más de las que caben, tomamos las primeras.
    let capped = false;
    if (files.length > remaining) {
      files = files.slice(0, remaining);
      capped = true;
    }
    setBusy(true);
    setMsg("");
    setProgress({ done: 0, total: files.length });
    const next = [...photoUrls];
    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const f = await compressImage(files[i]);
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
          // Vista previa INSTANTÁNEA con la imagen local ya comprimida.
          try { setThumbs((t) => ({ ...t, [upJson.storagePath!]: URL.createObjectURL(f) })); } catch { /* noop */ }
          next.push(upJson.storagePath);
          onChange([...next]); // se ve aparecer cada foto a medida que sube
          okCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setBusy(false);
    setProgress(null);
    const capNote = capped ? ` Solo caben ${maxPhotos} en total; el resto no se agregó.` : "";
    setMsg(
      failCount > 0
        ? `Subimos ${okCount} de ${files.length}. ${failCount} no se pudo(eron); intenta de nuevo esa(s).${capNote}`
        : `¡Listo! ${okCount} foto(s) guardada(s) ✓${capNote}`,
    );
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-700">Fotos de la zona</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Puedes elegir <b>varias de la galería a la vez</b>; se suben solas (comprimidas) con su barra de avance.
        <b> Hasta {maxPhotos} fotos</b> — elige las que mejor muestren el estado.
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {/* Dos opciones EXPLÍCITAS: algunos navegadores/webviews, sin `capture`,
            abrían la galería directo sin ofrecer la cámara. */}
        <label className={`cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 ${busy || atLimit ? "cursor-not-allowed opacity-50" : ""}`}>
          {busy ? "Subiendo…" : "📷 Tomar foto"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy || atLimit}
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) void onPickMany(fs);
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
              if (fs.length) void onPickMany(fs);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <span className={`text-[11px] ${atLimit ? "font-semibold text-amber-700" : "text-slate-500"}`}>{photoUrls.length}/{maxPhotos} foto(s)</span>
      </div>

      {/* Barra de progreso del lote. */}
      {progress && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
            <span>Subiendo {progress.done} de {progress.total}…</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {photoUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
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
      )}
      {msg && <p className="mt-1 text-[11px] text-emerald-700">{msg}</p>}
    </div>
  );
}
