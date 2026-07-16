"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getDraft } from "@/features/contracts/wizard-state";
import { pullServerDraftsIntoLocal } from "@/features/contracts/draft-server-sync";
import type { ContractDraft } from "@/features/contracts/wizard-state";
import { PropertyDocUpload } from "@/components/contracts/property-doc-upload";
import { PoderUpload } from "@/components/contracts/poder-upload";
import { OwnerPartyDocSlots } from "@/components/contracts/owner-party-doc-slots";
import { InviteSupportsOwnerList } from "@/components/contracts/invite-supports-owner-list";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";
import type { PropertyDocType } from "@/domain/contracts/draftPropertyDocs";

/**
 * Documentos del contrato (paso 1 de "Termina tu contrato"), en bento.
 * Reúne TODO lo que se sube en el flujo, con la MISMA fuente de datos (el
 * borrador, keyed por el id del contrato). Por eso lo que ya subiste al
 * principio aparece aquí como "✓ Ya subiste", no como pendiente.
 *
 * - Documento de propiedad + poder (si eres apoderado).
 * - Documentos del inquilino y del/los codeudor(es): si tú llenas los datos,
 *   los subes aquí; si enviaste enlace, cada parte los sube y aquí los ves.
 *   Si faltan, se marca en rojo para que los persigas antes de cerrar.
 */
export default function DocumentosTerminarPage() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  const { user } = useAuth();
  // Persistencia cross-device: partimos de lo local (rápido) pero traemos el
  // borrador del servidor para que las casillas/estado aparezcan aunque abras
  // desde otro dispositivo o navegador.
  const [draft, setDraft] = useState<ContractDraft | null>(() => getDraft(id));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await pullServerDraftsIntoLocal().catch(() => null);
      if (!cancelled) setDraft(getDraft(id));
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  const actingAs = draft?.actingAs;
  const isProxy = actingAs === "proxy";
  const expectedName = (isProxy ? draft?.grantorFullName : draft?.landlord?.fullName) ?? "";
  const reqTenant = draft?.requiredDocsTenant ?? [];
  const reqCodebtor = draft?.requiredDocsCodebtor ?? [];
  const hasPrimaryCodebtor = Boolean(draft?.solidaryCoDebtor?.fullName?.trim());
  const extraCodebtors = draft?.solidaryCoDebtors ?? [];
  const codebtorSlots = hasPrimaryCodebtor ? [0, ...extraCodebtors.map((_, i) => i + 1)] : [];

  // Si ya hay documento subido, PropertyDocUpload se muestra recogido y no
  // necesita el tipo; para re-subir, el usuario lo elige.
  const [docType, setDocType] = useState<string>("");

  const back = () => router.push(`/nuevo/gestionar/${id}/terminar`);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={back} className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Volver</button>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Documentos</span>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-none tracking-tight">Documentos del contrato</h1>
        <p className="mt-3 text-lg text-slate-500">Lo que ya subiste aparece marcado. Sube lo que falte antes de cerrar.</p>

        <RequiresSavedContract id={id}>
          {/* Propiedad + poder */}
          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Propiedad</h2>
            <PropertyDocUpload
              contractDraftId={id}
              docType={docType}
              onDocType={(v: PropertyDocType) => setDocType(v)}
              expectedName={expectedName}
              actingAs={actingAs}
            />
            {isProxy && <PoderUpload contractDraftId={id} />}
          </section>

          {/* Documentos del inquilino */}
          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Inquilino</h2>
            {reqTenant.length > 0 ? (
              <OwnerPartyDocSlots contractDraftId={id} role="tenant" requiredDocs={reqTenant} />
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
                No marcaste documentos obligatorios para el inquilino. Aun así puedes revisar abajo lo que haya subido.
              </p>
            )}
            <InviteSupportsOwnerList contractDraftId={id} role="tenant" title="📎 Documentos que subió el inquilino" />
          </section>

          {/* Documentos del/los codeudor(es) */}
          {codebtorSlots.length > 0 && (
            <section className="mt-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {codebtorSlots.length > 1 ? "Codeudores" : "Codeudor"}
              </h2>
              {codebtorSlots.map((slot) => (
                <div key={slot} className="space-y-3">
                  {codebtorSlots.length > 1 && <p className="text-xs font-semibold text-slate-600">Codeudor {slot + 1}</p>}
                  {reqCodebtor.length > 0 && (
                    <OwnerPartyDocSlots contractDraftId={id} role="solidaryCoDebtor" codebtorSlot={slot} requiredDocs={reqCodebtor} />
                  )}
                  <InviteSupportsOwnerList contractDraftId={id} role="solidaryCoDebtor" codebtorSlot={slot} title={`📎 Documentos que subió el codeudor${codebtorSlots.length > 1 ? " " + (slot + 1) : ""}`} />
                </div>
              ))}
            </section>
          )}

          {/* Alerta + recomendación de validación */}
          <div className="mt-6 rounded-3xl border-2 border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-900">
            <p className="font-bold">⚠️ Antes de cerrar, tú validas</p>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              <li className="flex gap-2"><span aria-hidden="true">•</span><span><b>Si tú llenas los datos</b> de las partes, súbelos aquí en su nombre. <b>Si enviaste el enlace</b>, cada parte los sube; revisa arriba que ya estén.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Si al inquilino o al codeudor le <b>falta</b> algún documento que exigiste, aparece <b>sin marcar</b>: persíguelo o súbelo tú.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Aunque ya estén subidos, <b>ábrelos y valida</b> que sean legibles y correspondan a lo que pediste (cédula vigente, colillas del periodo, carta laboral reciente, etc.).</span></li>
            </ul>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            <button onClick={back} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]">← Volver</button>
            <button onClick={back} className="rounded-2xl bg-[#12B886] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">Listo, continuar →</button>
          </div>
        </RequiresSavedContract>
      </div>
    </div>
  );
}
