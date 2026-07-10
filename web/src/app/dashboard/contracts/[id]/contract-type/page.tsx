"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { flashSaved } from "@/components/contracts/save-flash";
import { ContractOnboarding } from "@/components/contracts/contract-onboarding";
import { OathEvidenceBadge } from "@/components/contracts/oath-evidence-badge";
import type { ContractType } from "@/domain/contracts/types";
import { setActingAs, setContractType } from "@/features/contracts/wizard-state";

interface ContractTypeOption {
  id: ContractType;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  reason?: string;
}

const CONTRACT_TYPE_OPTIONS: ContractTypeOption[] = [
  {
    id: "VIVIENDA_URBANA",
    label: "Vivienda urbana",
    description:
      "Casa o apartamento en zona urbana destinado a vivir. Ley 820 de 2003.",
    icon: "🏢",
    available: true,
  },
  {
    id: "VIVIENDA_RURAL",
    label: "Vivienda rural",
    description:
      "Casa o vivienda ubicada en zona rural con destinación habitacional.",
    icon: "🏡",
    available: false,
    reason:
      "El contrato de vivienda rural tiene reglas específicas (uso del suelo y servicios) que estamos preparando.",
  },
  {
    id: "HABITACION",
    label: "Arrendamiento de habitación",
    description:
      "Una o más habitaciones dentro de una vivienda compartida.",
    icon: "🛏️",
    available: false,
    reason:
      "El arrendamiento por habitación tiene cláusulas de convivencia y servicios compartidos que estamos preparando.",
  },
  {
    id: "COMERCIAL",
    label: "Local comercial",
    description:
      "Local, oficina, bodega o consultorio para actividad económica.",
    icon: "🏬",
    available: false,
    reason:
      "El arrendamiento comercial está cubierto por el Código de Comercio (renovación, prima, mejoras útiles) y requiere su propia plantilla.",
  },
  {
    id: "RURAL_PRODUCTIVO",
    label: "Predio rural productivo",
    description:
      "Predio agrícola o pecuario con fines de explotación productiva.",
    icon: "🌾",
    available: false,
    reason:
      "El arrendamiento rural productivo se rige por reglas especiales (Ley 160 de 1994, contratos agrarios). Estamos en su análisis.",
  },
];

export default function ContractTypeStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ContractType>(
    "VIVIENDA_URBANA",
  );
  const [unavailableNotice, setUnavailableNotice] = useState<{
    label: string;
    reason: string;
  } | null>(null);
  const [acting, setActing] = useState<"owner" | "proxy">("owner");
  const [proxyAccepted, setProxyAccepted] = useState(false);
  const [actingError, setActingError] = useState("");
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    if (draft?.contractType) {
      setSelectedType(draft.contractType);
    }
  }, [draft?.contractType]);

  useEffect(() => {
    if (draft?.actingAs) setActing(draft.actingAs);
    if (draft?.proxyDeclarationAcceptedAt) setProxyAccepted(true);
  }, [draft?.actingAs, draft?.proxyDeclarationAcceptedAt]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function handleSelectAvailable(option: ContractTypeOption) {
    if (!option.available) return;
    setSelectedType(option.id);
    setContractType(id, option.id);
    setUnavailableNotice(null);
  }

  function handleAttemptUnavailable(option: ContractTypeOption) {
    setContractType(id, option.id);
    setUnavailableNotice({
      label: option.label,
      reason:
        option.reason ??
        "Esta modalidad de contrato aún no está disponible en ArriendoSeguro.",
    });
  }

  function handleContinue() {
    if (acting === "proxy" && !proxyAccepted) {
      setActingError("Para continuar como apoderado debes aceptar la declaración bajo juramento.");
      return;
    }
    setActingError("");
    setContractType(id, "VIVIENDA_URBANA");
    setActingAs(id, acting, proxyAccepted);
    flashSaved(() => router.push(`/dashboard/contracts/${id}/landlord`));
  }

  const availableOptions = CONTRACT_TYPE_OPTIONS.filter((o) => o.available);
  const otherOptions = CONTRACT_TYPE_OPTIONS.filter((o) => !o.available);

  function renderOption(option: ContractTypeOption) {
    const isSelected = option.available && selectedType === option.id;
    return (
      <li key={option.id}>
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={() => (option.available ? handleSelectAvailable(option) : handleAttemptUnavailable(option))}
          className={[
            "flex h-full w-full flex-col gap-2 rounded-xl border p-4 text-left transition",
            option.available
              ? isSelected
                ? "border-violet-500 bg-violet-100/60 text-violet-800 shadow-[0_0_18px_rgba(139,92,246,0.35)]"
                : "border-slate-300 bg-white/95 text-slate-800 hover:border-violet-500 hover:text-violet-800"
              : "cursor-not-allowed border-slate-300 bg-white/80 text-slate-600",
          ].join(" ")}
        >
          <span className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base font-semibold">
              <span aria-hidden>{option.icon}</span>
              <span>{option.label}</span>
            </span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                option.available ? "bg-emerald-500/20 text-emerald-700" : "bg-slate-200/70 text-slate-700",
              ].join(" ")}
            >
              {option.available ? "Disponible" : "Próximamente"}
            </span>
          </span>
          <span className="text-xs leading-snug text-slate-700">{option.description}</span>
        </button>
      </li>
    );
  }

  return (
    <WizardShell
      title="¿Qué tipo de contrato vas a generar?"
      currentStep={1}
      contractId={id}
    >
      <div className="mb-4">
        <ContractOnboarding />
      </div>

      <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white">GRATIS</span>
          Tu contrato es gratis
        </p>
        <ul className="mt-2 space-y-1 text-[13px] leading-relaxed">
          <li>✓ Generas y descargas <strong>un contrato completo gratis</strong> (sin firma digital).</li>
          <li>
            ✓ La <strong>firma digital también puede ser gratis</strong>: si invitas a <strong>3 personas</strong> que
            usen ArriendoSeguro, la desbloqueas sin costo. También puedes activarla al instante por un valor mínimo.
          </li>
        </ul>
      </div>

      <p className="text-sm text-slate-700">
        Hoy ArriendoSeguro genera el contrato de{" "}
        <strong className="text-violet-700">vivienda urbana</strong>, que es el
        más común en Colombia y está cubierto por la Ley 820 de 2003. Las demás
        modalidades vienen pronto y las puedes ver acá para que sepas con qué
        más vamos a apoyarte.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de contrato disponible">
        {availableOptions.map((option) => renderOption(option))}
      </ul>

      {otherOptions.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            aria-expanded={showOthers}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-violet-500 hover:text-violet-800"
          >
            {showOthers ? "Ocultar otras modalidades" : `Ver otras modalidades (${otherOptions.length}, próximamente)`}
            <span aria-hidden="true">{showOthers ? "▲" : "▼"}</span>
          </button>
          {showOthers && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Otras modalidades (próximamente)">
              {otherOptions.map((option) => renderOption(option))}
            </ul>
          )}
        </div>
      )}

      {unavailableNotice && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-100/60 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold">
            {unavailableNotice.label}: próximamente disponible
          </p>
          <p className="mt-1 text-amber-800">{unavailableNotice.reason}</p>
          <p className="mt-1 text-amber-700">
            Mientras tanto puedes continuar con{" "}
            <strong>vivienda urbana</strong> o salir y volver luego.
          </p>
          <button
            type="button"
            onClick={() => setUnavailableNotice(null)}
            className="mt-2 rounded border border-amber-400/60 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-500/20"
          >
            Entendido
          </button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-violet-300 bg-violet-50/40 p-4">
        <h2 className="text-sm font-semibold text-violet-900">¿En qué calidad arriendas?</h2>
        <p className="mt-1 text-xs text-slate-600">
          Es válido arrendar a nombre de otra persona. Si eres apoderado, al final deberás subir el poder autenticado.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Calidad en que arriendas">
          {([
            { v: "owner", label: "Soy el dueño (propietario)", desc: "Eres el propietario del inmueble." },
            { v: "proxy", label: "Soy apoderado", desc: "Arriendas a nombre del propietario con poder vigente." },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={acting === o.v}
              onClick={() => {
                setActing(o.v);
                setActingError("");
              }}
              className={`flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition ${
                acting === o.v
                  ? "border-violet-500 bg-violet-100/60 text-violet-800"
                  : "border-slate-300 bg-white/95 text-slate-800 hover:border-violet-500"
              }`}
            >
              <span className="font-semibold">{o.label}</span>
              <span className="text-xs text-slate-600">{o.desc}</span>
            </button>
          ))}
        </div>

        {acting === "proxy" && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100/60 p-3 text-xs leading-relaxed text-amber-900">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={proxyAccepted}
                onChange={(e) => setProxyAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span>
                <strong>Declaración bajo la gravedad de juramento (apoderado).</strong>
                {!proxyAccepted && (
                  <>
                    {" "}Declaro que cuento con <strong>poder vigente y suficiente</strong> para arrendar este inmueble a
                    nombre de su propietario, que la información es veraz, y me comprometo a{" "}
                    <strong>subir el poder autenticado</strong> en la sección de evidencias del expediente. Asumo la
                    responsabilidad legal y económica por esta declaración.
                  </>
                )}
              </span>
            </label>
            <OathEvidenceBadge active={proxyAccepted} oathId="proxy_declaration_oath" contractDraftId={id} />
          </div>
        )}
        {actingError && <p className="mt-2 text-xs text-rose-700">{actingError}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/leases"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
        >
          Anterior
        </Link>
        <button
          type="button"
          onClick={handleContinue}
          className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
        >
          Continuar con vivienda urbana
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        El tipo de contrato queda registrado en el expediente con su fecha de
        selección. Si más adelante habilitamos otra modalidad y quieres usarla,
        crearás un nuevo expediente con la nueva plantilla.
      </p>
    </WizardShell>
  );
}
