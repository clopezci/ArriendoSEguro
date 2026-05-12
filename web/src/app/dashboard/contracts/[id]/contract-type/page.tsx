"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import type { ContractType } from "@/domain/contracts/types";
import { setContractType } from "@/features/contracts/wizard-state";

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

  useEffect(() => {
    if (draft?.contractType) {
      setSelectedType(draft.contractType);
    }
  }, [draft?.contractType]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-300">Cargando…</p>;
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
    setContractType(id, "VIVIENDA_URBANA");
    router.push(`/dashboard/contracts/${id}/landlord`);
  }

  return (
    <WizardShell
      title="¿Qué tipo de contrato vas a generar?"
      currentStep={2}
      contractId={id}
    >
      <p className="text-sm text-slate-300">
        Hoy ArriendoSeguro genera el contrato de{" "}
        <strong className="text-violet-200">vivienda urbana</strong>, que es el
        más común en Colombia y está cubierto por la Ley 820 de 2003. Las demás
        modalidades vienen pronto y las puedes ver acá para que sepas con qué
        más vamos a apoyarte.
      </p>

      <ul
        className="mt-4 grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Tipo de contrato"
      >
        {CONTRACT_TYPE_OPTIONS.map((option) => {
          const isSelected = option.available && selectedType === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() =>
                  option.available
                    ? handleSelectAvailable(option)
                    : handleAttemptUnavailable(option)
                }
                className={[
                  "flex h-full w-full flex-col gap-2 rounded-xl border p-4 text-left transition",
                  option.available
                    ? isSelected
                      ? "border-violet-400 bg-violet-500/10 text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.35)]"
                      : "border-slate-700 bg-slate-900/60 text-slate-200 hover:border-violet-400 hover:text-violet-100"
                    : "cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-400",
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
                      option.available
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-slate-700/40 text-slate-300",
                    ].join(" ")}
                  >
                    {option.available ? "Disponible" : "Próximamente"}
                  </span>
                </span>
                <span className="text-xs leading-snug text-slate-300">
                  {option.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {unavailableNotice && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <p className="font-semibold">
            {unavailableNotice.label}: próximamente disponible
          </p>
          <p className="mt-1 text-amber-100/90">{unavailableNotice.reason}</p>
          <p className="mt-1 text-amber-100/80">
            Mientras tanto puedes continuar con{" "}
            <strong>vivienda urbana</strong> o salir y volver luego.
          </p>
          <button
            type="button"
            onClick={() => setUnavailableNotice(null)}
            className="mt-2 rounded border border-amber-400/60 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
          >
            Entendido
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/leases"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
        >
          Anterior
        </Link>
        <button
          type="button"
          onClick={handleContinue}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
        >
          Continuar con vivienda urbana
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        El tipo de contrato queda registrado en el expediente con su fecha de
        selección. Si más adelante habilitamos otra modalidad y quieres usarla,
        crearás un nuevo expediente con la nueva plantilla.
      </p>
    </WizardShell>
  );
}
