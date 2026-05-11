"use client";

import Link from "next/link";
import { useId } from "react";
import { getCurrentConsentText } from "@/domain/consents/consentVersions";

interface DataConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Cuando es true se aplica estilo de error y se muestra el mensaje. */
  invalid?: boolean;
  errorMessage?: string;
  /** Variante visual: `light` para fondos claros (form actual), `dark` para fondos oscuros del dashboard. */
  variant?: "light" | "dark";
}

/**
 * Checkbox de consentimiento informado para tratamiento de datos personales.
 * Diseño mobile-first: el label completo es el área clicable y el touch
 * target del checkbox cumple el mínimo de 44×44 px en pantallas pequeñas.
 */
export function DataConsentCheckbox({
  checked,
  onChange,
  invalid = false,
  errorMessage,
  variant = "light",
}: DataConsentCheckboxProps) {
  const id = useId();
  const text = getCurrentConsentText();

  const isDark = variant === "dark";
  const containerCls = isDark
    ? "rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-200"
    : "rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200";
  const invalidCls = invalid
    ? isDark
      ? "border-rose-500 ring-1 ring-rose-500"
      : "border-rose-500 ring-1 ring-rose-500"
    : "";
  const linkCls = isDark
    ? "text-violet-300 underline-offset-4 hover:underline"
    : "text-sky-600 underline-offset-4 hover:underline dark:text-sky-400";

  return (
    <div className={`${containerCls} ${invalidCls}`}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400 text-violet-600 focus:ring-violet-500"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && errorMessage ? `${id}-error` : undefined}
        />
        <span className="leading-snug">
          {text.shortText}{" "}
          <Link
            href="/legal/aviso-privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
            onClick={(e) => e.stopPropagation()}
          >
            Ver aviso completo
          </Link>
          .
        </span>
      </label>
      <p
        className={`mt-1.5 pl-8 text-[11px] ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        Versión {text.version} · Publicado {text.publishedAt}
      </p>
      {invalid && errorMessage && (
        <p
          id={`${id}-error`}
          className="mt-2 pl-8 text-xs font-medium text-rose-600 dark:text-rose-400"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
