"use client";

import { useId, useState, type ChangeEvent } from "react";

/**
 * Botón CLARO y en español para elegir un archivo, en lugar del `<input type=file>`
 * nativo (que sale en inglés "Choose file / No file chosen" y no parece botón).
 * Pensado para que personas mayores lo entiendan de una. Muestra el nombre del
 * archivo elegido. Acepta foto o PDF por defecto (en celular abre cámara/galería).
 *
 * Dos modos:
 *  - Controlado: pasa `file` + `onFile` (estado en el padre).
 *  - En formulario: pasa `name` (se lee por FormData); el nombre se muestra solo.
 */
export function FileButton({
  file,
  onFile,
  name,
  accept = "image/*,.pdf",
  label = "Elegir archivo",
  changeLabel = "Cambiar archivo",
  disabled = false,
  onChange,
}: {
  file?: File | null;
  onFile?: (f: File | null) => void;
  name?: string;
  accept?: string;
  label?: string;
  changeLabel?: string;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  const controlled = typeof onFile === "function";
  const [localName, setLocalName] = useState("");
  const shownName = controlled ? file?.name ?? "" : localName;

  return (
    <div>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (controlled) onFile?.(f);
          else setLocalName(f?.name ?? "");
          onChange?.(e);
        }}
      />
      <label
        htmlFor={id}
        className={`inline-flex items-center gap-2 rounded-xl border-2 border-[#5646E5] bg-white px-4 py-2.5 text-sm font-bold text-[#5646E5] shadow-sm transition ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#5646E5]/5 active:scale-95"
        }`}
      >
        📎 {shownName ? changeLabel : label}
      </label>
      <span className="mt-1.5 block truncate text-[11px] font-medium text-slate-700">
        {shownName ? `✓ ${shownName}` : "Ningún archivo seleccionado aún"}
      </span>
    </div>
  );
}
