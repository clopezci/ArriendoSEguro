"use client";

/**
 * Campos de persona (nombre, documento colombiano, contacto y dirección urbana estructurada).
 * Se reutiliza en arrendador, arrendatario y codeudor para mantener una sola fuente de validación visual.
 */

import { DOCUMENT_TYPE_OPTIONS } from "@/domain/colombia/document-validation";
import type { PartyDraft } from "@/features/contracts/draft-types";
import { useMemo, useState } from "react";
import { UrbanAddressFields } from "@/components/contracts/urban-address-fields";
import { OathEvidenceBadge } from "@/components/contracts/oath-evidence-badge";

export function PartyDataFields({
  party,
  legacyFreeTextAddressMessage,
  oathId,
  contractDraftId,
  thirdPartyAuthorization = false,
}: {
  party: PartyDraft;
  /** Si hay texto viejo sin partes, invitamos a reemplazar usando el formato nuevo. */
  legacyFreeTextAddressMessage?: boolean;
  /**
   * Identificador del juramento para correlacionar la evidencia en
   * auditoría. Ej: "landlord_truthfulness_oath",
   * "tenant_truthfulness_oath", "codebtor_truthfulness_oath".
   */
  oathId?: string;
  contractDraftId?: string;
  /**
   * `true` cuando quien llena el formulario NO es el titular de los datos (p. ej.
   * el dueño ingresando los datos del inquilino o codeudor). Exige declarar que
   * se cuenta con la autorización del titular (Habeas Data, Ley 1581 de 2012).
   */
  thirdPartyAuthorization?: boolean;
}) {
  const [docType, setDocType] = useState(
    party.documentType === "TI" ? "CC" : String(party.documentType ?? "CC"),
  );

  // Estado local del check de juramento para activar la evidencia
  // dinámica. El valor se sigue enviando vía `name="truthfulnessOath"`
  // para conservar la integración con `wizard-state` sin tocar el
  // contrato existente.
  const [oathChecked, setOathChecked] = useState<boolean>(
    Boolean(party.truthfulnessOathAccepted),
  );
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  const hint = useMemo(() => {
    return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === docType)?.hint ?? "";
  }, [docType]);

  const parts = party.notificationAddressParts;

  return (
    <>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-700">Nombre completo</span>
        <input
          name="fullName"
          required
          minLength={5}
          maxLength={120}
          defaultValue={party.fullName ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          placeholder="Como aparece en el documento"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-700">Tipo de documento</span>
        <select
          name="documentType"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
        >
          {DOCUMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-700">Número de documento</span>
        <input
          name="documentNumber"
          required
          autoComplete="off"
          defaultValue={party.documentNumber ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          placeholder="Sin puntos ni espacios"
        />
        {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-700">Ciudad de residencia / notificación</span>
        <input
          name="city"
          required
          minLength={2}
          maxLength={60}
          defaultValue={party.city ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          placeholder="Ej. Bogotá D.C."
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-700">Correo electrónico</span>
        <input
          name="email"
          type="email"
          required
          defaultValue={party.email ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-700">Teléfono (10 dígitos, sin +57)</span>
        <input
          name="phone"
          inputMode="numeric"
          required
          defaultValue={party.phone ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          placeholder="Ej. 3001234567"
        />
      </label>

      <UrbanAddressFields
        prefix="addr"
        parts={parts}
        variant="notificacion"
        legacyFreeTextAddress={!!legacyFreeTextAddressMessage && !!party.notificationAddress}
      />

      {thirdPartyAuthorization && (
        <div className="sm:col-span-2 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              name="thirdPartyAuthorizationOath"
              required
              checked={authChecked}
              onChange={(e) => setAuthChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-300"
            />
            <span>
              <strong>Autorización del titular de los datos.</strong> Declaro que <strong>cuento con la autorización
              expresa del titular</strong> de estos datos personales para registrarlos en este contrato y que se lo
              comunicaré, conforme a la Ley 1581 de 2012 (Habeas Data). El titular podrá confirmarlos y ejercer sus
              derechos al momento de firmar.
            </span>
          </label>
          <OathEvidenceBadge
            active={authChecked}
            oathId={`${oathId ?? "party"}_third_party_authorization`}
            contractDraftId={contractDraftId}
          />
        </div>
      )}

      <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            name="truthfulnessOath"
            required
            checked={oathChecked}
            onChange={(e) => setOathChecked(e.target.checked)}
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
        <OathEvidenceBadge
          active={oathChecked}
          oathId={oathId ?? "party_truthfulness_oath"}
          contractDraftId={contractDraftId}
        />
      </div>
    </>
  );
}
