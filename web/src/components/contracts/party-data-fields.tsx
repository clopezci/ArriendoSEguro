"use client";

/**
 * Campos de persona (DATOS MÍNIMOS): nombre, documento colombiano, ciudad y
 * contacto. Se reutiliza en arrendador, arrendatario y codeudor.
 *
 * La dirección de notificación de las personas se retiró para simplificar (Ley
 * 820: el contenido mínimo del art. 3 no la exige; el art. 12 presume que se
 * notifica en el inmueble/donde se recibe el canon). Solo el inmueble lleva
 * dirección. La cláusula de notificaciones del contrato deja explícito el art. 12.
 */

import { DOCUMENT_TYPE_OPTIONS } from "@/domain/colombia/document-validation";
import type { InviteAttestation, PartyDraft } from "@/features/contracts/draft-types";
import { useMemo, useState } from "react";
import { OathEvidenceBadge } from "@/components/contracts/oath-evidence-badge";
import { ReadAloudButton } from "@/components/a11y/read-aloud";

// Textos completos para la lectura por voz (los mismos que se muestran, para que
// el usuario pueda escucharlos aunque el bloque esté colapsado tras aceptar).
const THIRD_PARTY_AUTH_READ =
  "Autorización del titular de los datos. Declaro que cuento con la autorización expresa del titular de estos datos personales para registrarlos en este contrato y que se lo comunicaré, conforme a la Ley 1581 de 2012 de Habeas Data.";
const SELF_DATA_AUTH_READ =
  "Autorización de tratamiento de mis datos. Autorizo el tratamiento de mis datos personales por ArriendoSeguro y por la contraparte de este contrato, para celebrar, ejecutar y controlar el arriendo, conforme a la Ley 1581 de 2012 de Habeas Data. Sé que puedo consultar, actualizar y suprimir mis datos, y conozco la política de tratamiento.";
const TRUTHFULNESS_OATH_READ =
  "Declaración bajo gravedad de juramento. Manifiesto que la información aquí consignada, nombres, documento, contacto, dirección y demás datos, es verídica, completa y actualizada. Conozco que entregar información falsa puede acarrear sanciones civiles, comerciales y penales, y autorizo a la contraparte a verificarla por los medios legales disponibles.";

export function PartyDataFields({
  party,
  oathId,
  contractDraftId,
  thirdPartyAuthorization = false,
  selfDataAuthorization = false,
  attestation = null,
}: {
  party: PartyDraft;
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
  /**
   * `true` cuando quien llena el formulario ES el titular de los datos (p. ej. el
   * invitado en su enlace). Pide la autorización de tratamiento de sus PROPIOS
   * datos (Ley 1581 de 2012), en primera persona.
   */
  selfDataAuthorization?: boolean;
  /**
   * Cuando el dato viene del enlace y el titular YA aceptó allí (con su
   * identidad y evidencia), se pasa aquí. En ese caso NO se muestran los checks
   * al dueño: se muestra un resumen de solo lectura de la evidencia del titular
   * y se envía el juramento como aceptado (por el titular) para no bloquear.
   */
  attestation?: InviteAttestation | null;
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
  const [selfAuthChecked, setSelfAuthChecked] = useState<boolean>(false);

  const hint = useMemo(() => {
    return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === docType)?.hint ?? "";
  }, [docType]);

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

      {attestation ? (
        // El titular ya aceptó por el enlace (o un tercero autorizado ingresó sus
        // datos). El dueño NO vuelve a marcar nada: se muestra la evidencia en
        // solo lectura y se envía el juramento como aceptado (input oculto).
        attestation.mode === "third_party" ? (
          <div className="sm:col-span-2 rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
            <p className="font-semibold text-sky-900">
              ✓ Datos ingresados por {attestation.attestedByName ?? "el arrendatario"} (con autorización declarada)
            </p>
            <p className="mt-1">
              Declaró contar con la <strong>autorización del codeudor</strong> (Ley 1581 de 2012) para registrar sus
              datos. El codeudor <strong>confirmará la veracidad y aceptará el tratamiento de sus datos al firmar</strong>{" "}
              el contrato.
            </p>
            <p className="mt-1 text-sky-800/80">
              Evidencia: {new Date(attestation.acceptedAt).toLocaleString("es-CO")}
              {attestation.city ? ` · ${attestation.city}` : ""}
              {attestation.ip ? ` · IP ${attestation.ip}` : ""}.
            </p>
            <input type="hidden" name="truthfulnessOath" value="on" />
          </div>
        ) : (
          <div className="sm:col-span-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900">
            <p className="font-semibold text-emerald-900">✓ Aceptaciones registradas por el titular vía enlace</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                Declaración bajo gravedad de juramento:{" "}
                <strong>{attestation.truthfulnessOathAccepted ? "aceptada" : "no aceptada"}</strong>.
              </li>
              <li>
                Autorización de tratamiento de datos (Ley 1581):{" "}
                <strong>{attestation.dataAuthorizationAccepted ? "aceptada" : "no aceptada"}</strong>.
              </li>
              <li className="text-emerald-800/80">
                Evidencia: {new Date(attestation.acceptedAt).toLocaleString("es-CO")}
                {attestation.city ? ` · ${attestation.city}` : ""}
                {attestation.ip ? ` · IP ${attestation.ip}` : ""}.
              </li>
            </ul>
            <p className="mt-1 text-[11px] text-emerald-800/80">
              Lo aceptó el propio titular; por eso no necesitas marcarlo tú. Si necesitas cambiar sus datos, vuelve a
              invitarlo para conservar la evidencia correcta.
            </p>
            <input type="hidden" name="truthfulnessOath" value={attestation.truthfulnessOathAccepted ? "on" : ""} />
          </div>
        )
      ) : thirdPartyAuthorization ? (
        // Quien ingresa NO es el titular (p. ej. el dueño ingresando los datos del
        // inquilino/codeudor, o el inquilino ingresando al codeudor). SOLO declara
        // que tiene la autorización para registrar esos datos. Las aceptaciones
        // PERSONALES del titular (juramento, autorización de datos, firma
        // electrónica y obligación solidaria) NO las puede dar un tercero: las hace
        // el propio titular AL FIRMAR. Por eso solo se muestra esta casilla.
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
              <strong>Autorización del titular de los datos.</strong>
              {!authChecked && (
                <>
                  {" "}Declaro que <strong>cuento con la autorización expresa del titular</strong> de estos datos
                  personales para registrarlos en este contrato y que se lo comunicaré, conforme a la Ley 1581 de 2012
                  (Habeas Data).
                </>
              )}
            </span>
          </label>
          <OathEvidenceBadge
            active={authChecked}
            oathId={`${oathId ?? "party"}_third_party_authorization`}
            contractDraftId={contractDraftId}
          />
          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-[11px] text-amber-800/90">
              Las demás aceptaciones —<strong>declaración bajo juramento</strong>, autorización de tratamiento de datos
              y, si es codeudor, <strong>firma electrónica</strong> y <strong>obligación solidaria</strong>— las hará{" "}
              <strong>el propio titular al firmar</strong> el contrato. No puedes aceptarlas por otra persona.
            </p>
            <ReadAloudButton text={THIRD_PARTY_AUTH_READ} label="Escuchar esta declaración" />
          </div>
          {/* El titular acepta al firmar; el input oculto solo satisface el esquema.
              La página guarda estas aceptaciones como PENDIENTES (no como del dueño). */}
          <input type="hidden" name="truthfulnessOath" value="on" />
        </div>
      ) : (
        <>
          {selfDataAuthorization && (
            <div className="sm:col-span-2 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  name="dataAuthorizationOath"
                  required
                  checked={selfAuthChecked}
                  onChange={(e) => setSelfAuthChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-300"
                />
                <span>
                  <strong>Autorización de tratamiento de mis datos.</strong>
                  {!selfAuthChecked && (
                    <>
                      {" "}<strong>Autorizo el tratamiento de mis datos personales</strong> por ArriendoSeguro y por la
                      contraparte de este contrato, para celebrar, ejecutar y controlar el arriendo, conforme a la Ley
                      1581 de 2012 (Habeas Data). Sé que puedo consultar, actualizar y suprimir mis datos, y conozco la
                      política de tratamiento.
                    </>
                  )}
                </span>
              </label>
              <OathEvidenceBadge
                active={selfAuthChecked}
                oathId={`${oathId ?? "party"}_data_authorization`}
                contractDraftId={contractDraftId}
              />
              <div className="mt-1 flex justify-end">
                <ReadAloudButton text={SELF_DATA_AUTH_READ} label="Escuchar esta autorización" />
              </div>
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
                <strong>Declaración bajo gravedad de juramento.</strong>
                {!oathChecked && (
                  <>
                    {" "}Manifiesto que la información aquí consignada (nombres, documento, contacto, dirección y demás
                    datos) es verídica, completa y actualizada. Conozco que entregar información falsa puede acarrear
                    sanciones civiles, comerciales y penales (artículos 442 y 443 del Código Penal colombiano sobre falso
                    testimonio y fraude procesal, y demás normas aplicables), y autorizo a la contraparte a verificarla
                    por los medios legales disponibles.
                  </>
                )}
              </span>
            </label>
            <OathEvidenceBadge
              active={oathChecked}
              oathId={oathId ?? "party_truthfulness_oath"}
              contractDraftId={contractDraftId}
            />
            <div className="mt-1 flex justify-end">
              <ReadAloudButton text={TRUTHFULNESS_OATH_READ} label="Escuchar el juramento" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
