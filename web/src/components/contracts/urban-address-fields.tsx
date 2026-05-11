"use client";

/**
 * Dirección urbana colombiana (malla tipo calle/carrera # cruce-placa + barrio).
 * Mismo criterio para notificación de partes y para ubicación del inmueble en el expediente.
 */

import {
  VIA_TIPO_LABELS,
  VIA_TIPO_VALUES,
  type ColombianNotificationAddressParts,
  type UrbanAddressFormPrefix,
  type ViaTipoColombia,
} from "@/domain/colombia/structured-address";
import { useEffect, useState } from "react";

type Variant = "notificacion" | "inmueble";

const COPY: Record<
  Variant,
  { title: string; intro: string; legacyHint: string }
> = {
  notificacion: {
    title: "Dirección de notificación (norma urbana)",
    intro:
      "Armá la dirección como suele escribirse en Colombia (tipo de vía + número + # cruce-placa + barrio). Si algo falla la validación, tus datos arriba no se borran: corregís solo lo indicado.",
    legacyHint:
      "Tenías una dirección guardada en texto libre. Volvé a cargarla con estos campos para que el contrato quede ordenado.",
  },
  inmueble: {
    title: "Dirección del inmueble a arrendar (alineada a nomenclatura urbana)",
    intro:
      "Usá la misma lógica que en catastro y correspondencia: tipo de vía, número principal, cruce y placa, más barrio. Ciudad y departamento van aparte. Esto no sustituye la consulta oficial en el catastro.",
    legacyHint:
      "Tenías la dirección del inmueble a arrendar en una sola línea. Completá estos campos para mantener formato uniforme.",
  },
};

export function UrbanAddressFields({
  prefix,
  parts,
  variant,
  legacyFreeTextAddress,
}: {
  prefix: UrbanAddressFormPrefix;
  parts?: ColombianNotificationAddressParts | null;
  variant: Variant;
  /** Había texto libre guardado sin partes estructuradas. */
  legacyFreeTextAddress?: boolean;
}) {
  const [viaTipo, setViaTipo] = useState<ViaTipoColombia>(
    (parts?.viaTipo as ViaTipoColombia | undefined) ?? "CALLE",
  );

  useEffect(() => {
    if (parts?.viaTipo) setViaTipo(parts.viaTipo as ViaTipoColombia);
  }, [parts?.viaTipo]);

  const isOtro = viaTipo === "OTRO";
  const c = COPY[variant];

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-700/80 bg-slate-950/40 p-3">
      <p className="text-sm font-medium text-slate-200">{c.title}</p>
      <p className="text-[11px] leading-snug text-slate-500">{c.intro}</p>
      {legacyFreeTextAddress && (
        <p className="rounded-lg border border-amber-700/40 bg-amber-950/30 p-2 text-[11px] text-amber-100">
          {c.legacyHint}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-300">Tipo de vía principal</span>
          <select
            name={`${prefix}ViaTipo`}
            value={viaTipo}
            onChange={(e) => setViaTipo(e.target.value as ViaTipoColombia)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {VIA_TIPO_VALUES.map((v) => (
              <option key={v} value={v}>
                {VIA_TIPO_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label className={`text-sm sm:col-span-2 ${!isOtro ? "opacity-50" : ""}`}>
          <span className="mb-1 block text-slate-300">
            Nombre de la vía (solo si elegiste «Otro (especificar)»)
          </span>
          <input
            key={`${prefix}-viaOtro-${viaTipo}`}
            name={`${prefix}ViaTipoOtro`}
            disabled={!isOtro}
            defaultValue={parts?.viaTipo === "OTRO" ? (parts.viaTipoOtro ?? "") : ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:cursor-not-allowed disabled:bg-slate-900/80"
            placeholder={isOtro ? "Ej. Autopista Norte, Transversal del peatonal…" : "No aplica: elegí un tipo de vía de la lista."}
            autoComplete="off"
          />
          <span className="mt-1 block text-[10px] text-slate-500">
            Este campo solo se usa cuando el tipo de vía es «Otro»; si no, queda deshabilitado a propósito.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Número de la vía</span>
          <input
            name={`${prefix}ViaNumero`}
            required
            defaultValue={parts?.viaNumero ?? ""}
            inputMode="numeric"
            pattern="[0-9]{1,3}"
            title="Solo números, 1 a 3 dígitos"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Ej. 72"
          />
          <span className="mt-1 block text-[10px] text-slate-500">Solo dígitos (sin letras). Ejemplo: 72</span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Letra de la vía (opcional)</span>
          <input
            name={`${prefix}ViaLetra`}
            maxLength={2}
            defaultValue={parts?.viaLetra ?? ""}
            pattern="[A-Za-z]{0,2}"
            title="Solo letras, máximo 2"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="A, B…"
          />
          <span className="mt-1 block text-[10px] text-slate-500">
            Opcional. Solo letras (sin números). Se une al número de vía en el texto final (ej. 72A).
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Número de cruce (después de #)</span>
          <input
            name={`${prefix}CruceNumero`}
            required
            defaultValue={parts?.cruceNumero ?? ""}
            inputMode="numeric"
            pattern="[0-9]{1,3}"
            title="Solo números"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Ej. 10"
          />
          <span className="mt-1 block text-[10px] text-slate-500">Solo dígitos. Es el primer número del par cruce-placa.</span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Placa / número local</span>
          <input
            name={`${prefix}Placa`}
            required
            defaultValue={parts?.placa ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Ej. 34 o 34B"
          />
          <span className="mt-1 block text-[10px] text-slate-500">
            Segundo tramo del par (puede incluir letras o guion, según tu dirección real).
          </span>
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-300">Complemento (opcional)</span>
          <input
            name={`${prefix}Complemento`}
            defaultValue={parts?.complemento ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Apto, interior, conjunto…"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-300">Barrio o localidad del predio</span>
          <input
            name={`${prefix}Barrio`}
            required
            minLength={2}
            maxLength={80}
            defaultValue={parts?.barrio ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="Nombre del barrio"
          />
          <span className="mt-1 block text-[10px] text-slate-500">
            No confundir con ciudad: la ciudad la cargás en el campo correspondiente del formulario.
          </span>
        </label>
      </div>
    </div>
  );
}
