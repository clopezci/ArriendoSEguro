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
  const isVeredal = viaTipo === "VEREDAL";
  const c = COPY[variant];

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-300 bg-slate-100/60 p-3">
      <p className="text-sm font-medium text-slate-800">{c.title}</p>
      <p className="text-[11px] leading-snug text-slate-500">{c.intro}</p>
      {legacyFreeTextAddress && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-50 p-2 text-[11px] text-amber-800">
          {c.legacyHint}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-700">Tipo de vía principal</span>
          <select
            name={`${prefix}ViaTipo`}
            value={viaTipo}
            onChange={(e) => setViaTipo(e.target.value as ViaTipoColombia)}
            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          >
            {VIA_TIPO_VALUES.map((v) => (
              <option key={v} value={v}>
                {VIA_TIPO_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        {isOtro && (
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-700">Nombre de la vía («Otro»)</span>
            <input
              key={`${prefix}-viaOtro-${viaTipo}`}
              name={`${prefix}ViaTipoOtro`}
              defaultValue={parts?.viaTipo === "OTRO" ? (parts.viaTipoOtro ?? "") : ""}
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
              placeholder="Ej. Autopista Norte, Transversal del peatonal…"
              autoComplete="off"
            />
          </label>
        )}

        {!isVeredal && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Número de la vía</span>
              <input
                name={`${prefix}ViaNumero`}
                required
                defaultValue={parts?.viaNumero ?? ""}
                inputMode="numeric"
                pattern="[0-9]{1,3}"
                title="Solo números, 1 a 3 dígitos"
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Ej. 72"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Letra de la vía (opcional)</span>
              <input
                name={`${prefix}ViaLetra`}
                maxLength={2}
                defaultValue={parts?.viaLetra ?? ""}
                pattern="[A-Za-z]{0,2}"
                title="Solo letras, máximo 2"
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="A, B…"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Número de cruce (después de #)</span>
              <input
                name={`${prefix}CruceNumero`}
                required
                defaultValue={parts?.cruceNumero ?? ""}
                inputMode="numeric"
                pattern="[0-9]{1,3}"
                title="Solo números"
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Ej. 10"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Placa / número local</span>
              <input
                name={`${prefix}Placa`}
                required
                defaultValue={parts?.placa ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Ej. 34 o 34B"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-700">Complemento (opcional)</span>
              <input
                name={`${prefix}Complemento`}
                defaultValue={parts?.complemento ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Apto, interior, conjunto…"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-700">Barrio o localidad del predio</span>
              <input
                name={`${prefix}Barrio`}
                required
                minLength={2}
                maxLength={80}
                defaultValue={parts?.barrio ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Nombre del barrio"
              />
            </label>
          </>
        )}

        {isVeredal && (
          <>
            <p className="sm:col-span-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[11px] text-emerald-900">
              Dirección <strong>veredal / rural</strong>: completa lo que aplique. Los campos urbanos no se piden.
            </p>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Vereda</span>
              <input
                name={`${prefix}Vereda`}
                required
                defaultValue={parts?.vereda ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Ej. La Aurora"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Vía (opcional)</span>
              <input
                name={`${prefix}ViaRural`}
                defaultValue={parts?.viaRural ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Ej. Vía a La Calera km 5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Parcelación / finca / lote (opcional)</span>
              <input
                name={`${prefix}Parcelacion`}
                defaultValue={parts?.parcelacion ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Ej. Parcelación El Roble, lote 7"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Tipo de predio (opcional)</span>
              <input
                name={`${prefix}TipoPredio`}
                defaultValue={parts?.tipoPredio ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Casa campestre, finca, lote…"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-700">Observaciones para ubicar el predio (opcional)</span>
              <textarea
                name={`${prefix}ObsRurales`}
                defaultValue={parts?.obsRurales ?? ""}
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                placeholder="Referencias, linderos, cómo llegar…"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
