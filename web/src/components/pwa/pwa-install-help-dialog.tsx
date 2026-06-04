"use client";

import { useEffect, useRef } from "react";

type PwaInstallHelpDialogProps = {
  mode: "ios" | "android" | "desktop";
  onClose: () => void;
};

export function PwaInstallHelpDialog({ mode, onClose }: PwaInstallHelpDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Accesibilidad: cerrar con Escape y llevar el foco al diálogo al abrir.
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    mode === "ios"
      ? "Instalar en iPhone o iPad"
      : mode === "android"
        ? "Instalar en Android"
        : "Instalar en tu computador";

  const steps =
    mode === "ios"
      ? [
          "Abre esta página en Safari (no en un navegador dentro de otra app).",
          "Toca el botón Compartir (ícono con flecha hacia arriba).",
          "Elige «Añadir a pantalla de inicio».",
          "Confirma con «Añadir». Verás el acceso directo en tu pantalla de inicio.",
        ]
      : mode === "android"
        ? [
            "Abre esta página en Chrome (recomendado).",
            "Toca el menú ⋮ (tres puntos) arriba a la derecha.",
            "Elige «Instalar aplicación» o «Añadir a pantalla de inicio».",
            "Confirma. El ícono de ArriendoSeguro quedará en tu pantalla de inicio.",
          ]
        : [
            "Usa Chrome o Edge en escritorio.",
            "Busca el ícono de instalación en la barra de direcciones (⊕ o monitor con flecha) o abre el menú ⋮ → «Instalar ArriendoSeguro…».",
            "Confirma la instalación. Podrás abrir la app desde el menú Inicio o la barra de tareas.",
            "Si no ves la opción, agrega esta página a favoritos para acceder rápido.",
          ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-help-title"
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-[101] w-full max-w-md rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.25)] focus:outline-none"
      >
        <h2 id="install-help-title" className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Así tendrás acceso rápido a contratos, expedientes y el panel sin buscar la página cada vez.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
