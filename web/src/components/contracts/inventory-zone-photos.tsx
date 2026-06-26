"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Fotos de una zona del inventario: permite **tomar foto con la cámara** (móvil)
 * o elegir una imagen, la sube a Storage y guarda su `storagePath` en `photoUrls`.
 * Muestra miniaturas resolviendo una URL firmada de lectura.
 */
export function InventoryZonePhotos({
  inventoryId,
  zoneId,
  photoUrls,
  onChange,
}: {
  inventoryId: string;
  zoneId: string;
  photoUrls: string[];
  onChange: (next: string[]) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

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

  async function onPick(file: File) {
    if (!user || !inventoryId) {
      setMsg("Guarda primero el inventario para subir fotos.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const up = await fetch("/api/inventory/zone-photo/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ inventoryId, selectedZoneId: zoneId, filename: file.name || "foto.jpg", contentType: file.type || "image/jpeg", sizeBytes: file.size }),
      });
      const upJson = (await up.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!up.ok || !upJson.success || !upJson.uploadUrl || !upJson.storagePath) {
        setMsg(upJson.errors?.[0]?.message ?? "No se pudo preparar la subida.");
        return;
      }
      const put = await fetch(upJson.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "image/jpeg" }, body: file });
      if (!put.ok) {
        setMsg("No se pudo subir la foto.");
        return;
      }
      onChange([...photoUrls, upJson.storagePath]);
      setMsg("Foto agregada. Recuerda guardar la zona.");
    } catch {
      setMsg("Error de red al subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-700">Fotos de la zona</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {/* Sin `capture`: en móvil el sistema ofrece Cámara o Galería; en escritorio, elegir archivo. */}
        <label className="cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
          {busy ? "Subiendo…" : "📷 Tomar o elegir foto"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <span className="text-[11px] text-slate-500">{photoUrls.length} foto(s)</span>
      </div>
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
