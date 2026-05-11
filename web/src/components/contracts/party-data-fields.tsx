"use client";

/**
 * Campos de persona (nombre, documento colombiano, contacto y dirección urbana estructurada).
 * Se reutiliza en arrendador, arrendatario y codeudor para mantener una sola fuente de validación visual.
 */

import { DOCUMENT_TYPE_OPTIONS } from "@/domain/colombia/document-validation";
import type { PartyDraft } from "@/features/contracts/draft-types";
import { useMemo, useState } from "react";
import { UrbanAddressFields } from "@/components/contracts/urban-address-fields";

export function PartyDataFields({
  party,
  legacyFreeTextAddressMessage,
}: {
  party: PartyDraft;
  /** Si hay texto viejo sin partes, invitamos a reemplazar usando el formato nuevo. */
  legacyFreeTextAddressMessage?: boolean;
}) {
  const [docType, setDocType] = useState(
    party.documentType === "TI" ? "CC" : String(party.documentType ?? "CC"),
  );

  const hint = useMemo(() => {
    return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === docType)?.hint ?? "";
  }, [docType]);

  const parts = party.notificationAddressParts;

  return (
    <>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-300">Nombre completo</span>
        <input
          name="fullName"
          required
          minLength={5}
          maxLength={120}
          defaultValue={party.fullName ?? ""}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="Como aparece en el documento"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-300">Tipo de documento</span>
        <select
          name="documentType"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        >
          {DOCUMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-300">Número de documento</span>
        <input
          name="documentNumber"
          required
          autoComplete="off"
          defaultValue={party.documentNumber ?? ""}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="Sin puntos ni espacios"
        />
        {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-300">Ciudad de residencia / notificación</span>
        <input
          name="city"
          required
          minLength={2}
          maxLength={60}
          defaultValue={party.city ?? ""}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="Ej. Bogotá D.C."
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-300">Correo electrónico</span>
        <input
          name="email"
          type="email"
          required
          defaultValue={party.email ?? ""}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-300">Teléfono (10 dígitos, sin +57)</span>
        <input
          name="phone"
          inputMode="numeric"
          required
          defaultValue={party.phone ?? ""}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="Ej. 3001234567"
        />
      </label>

      <UrbanAddressFields
        prefix="addr"
        parts={parts}
        variant="notificacion"
        legacyFreeTextAddress={!!legacyFreeTextAddressMessage && !!party.notificationAddress}
      />

      <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            name="truthfulnessOath"
            required
            defaultChecked={Boolean(party.truthfulnessOathAccepted)}
            className="mt-0.5 h-4 w-4 accent-amber-300"
          />
          <span>
            <strong>Declaración bajo gravedad de juramento.</strong> Manifiesto
            que la información aquí consignada (nombres, documento, contacto,
            dirección y demás datos) es verídica, completa y actualizada.
            Conozco que entregar información falsa puede acarrear sanciones
            civiles, comerciales y penales (artículos 442 y 443 del Código
            Penal colombiano sobre falso testimonio y fraude procesal, y
            demás normas aplicables), y autorizo a la contraparte a
            verificarla por los medios legales disponibles.
          </span>
        </label>
      </div>
    </>
  );
}
