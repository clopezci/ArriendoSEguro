"use client";

import { useId } from "react";

/**
 * Botón CLARO y en español para elegir un archivo, en lugar del `<input type=file>`
 * nativo (que sale en inglés "Choose file / No file chosen" y no parece botón).
 * Pensado para que personas mayores lo entiendan de una. Muestra el nombre del
 * archivo elegido. Acepta foto o PDF por defecto (en celular abre cámara/galería).
 */
export function FileButton({
  file,
  onFile,
  accept = "image/*,.pdf",
  label = "Elegir archivo",
  changeLabel = "Cambiar archivo",
  disabled = false,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  label?: string;
  changeLabel?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <label
        htmlFor={id}
        className={`inline-flex items-center gap-2 rounded-xl border-2 border-[#5646E5] bg-white px-4 py-2.5 text-sm font-bold text-[#5646E5] shadow-sm transition ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#5646E5]/5 active:scale-95"
        }`}
      >
        📎 {file ? changeLabel : label}
      </label>
      <span className="mt-1.5 block truncate text-[11px] font-medium text-slate-700">
        {file ? `✓ ${file.name}` : "Ningún archivo seleccionado aún"}
      </span>
    </div>
  );
}
