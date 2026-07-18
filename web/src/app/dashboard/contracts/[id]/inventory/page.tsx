"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type InventoryState = "none" | "draft" | "completed";

export default function InventoryHomePage() {
  const id = String(useParams<{ id: string }>().id);
  const { state } = useDraftGuard(id);
  const { user } = useAuth();
  const [inventoryId, setInventoryId] = useState<string>("");
  const [inventoryState, setInventoryState] = useState<InventoryState>("none");
  const [contractVersionId, setContractVersionId] = useState<string>("");
  const [error, setError] = useState("");
  const [deliveryActGenerated, setDeliveryActGenerated] = useState(false);

  useEffect(() => {
    const run = async () => {
      const latest = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`).then((r) => r.json());
      const versionId = latest?.version?.id ?? latest?.contract?.currentVersionId ?? "";
      setContractVersionId(versionId);
      if (!versionId) return;
      const inv = await fetch(`/api/inventory/by-contract?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json());
      if (inv?.success && inv.inventory) {
        setInventoryId(String(inv.inventory.id));
        setInventoryState(inv.inventory.status === "completed" || inv.inventory.status === "signed" ? "completed" : "draft");
        const annex = await fetch(`/api/contracts/annexes/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json());
        const hasAct = (annex?.annexes ?? []).some((a: { annexType?: string; status?: string }) => a.annexType === "initial_delivery_act" && a.status === "generated");
        setDeliveryActGenerated(Boolean(hasAct));
      }
    };
    void run();
  }, [id, user]);

  if (state !== "ready") return <p className="text-sm text-slate-700">Cargando...</p>;

  return (
    <WizardShell title="Inventario y entrega" currentStep={11} contractId={id} variant="extra" macroStep="acta" lean>
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_20px_rgba(86,70,229,0.06)] p-4 text-sm text-slate-700">
        <p>Estado del inventario inicial: <strong>{inventoryState === "none" ? "Sin inventario" : inventoryState === "draft" ? "Inventario en borrador" : "Inventario completado"}</strong></p>
        <p className="mt-1">Estado del acta de entrega: <strong>{deliveryActGenerated ? "Acta generada" : inventoryState === "completed" ? "Lista para generar" : "Pendiente"}</strong></p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {inventoryState === "none" && (
          <Link
            href={`/dashboard/contracts/${id}/inventory/new?contractVersionId=${encodeURIComponent(contractVersionId)}`}
            className="rounded-xl bg-[#5646E5] px-4 py-2 text-sm font-medium text-white"
            onClick={(e) => {
              if (!contractVersionId) {
                e.preventDefault();
                setError("Primero guarda una versión contractual en la vista previa.");
              }
            }}
          >
            Crear inventario inicial
          </Link>
        )}
        {inventoryState !== "none" && inventoryId && (
          <>
            <Link
              href={`/dashboard/contracts/${id}/inventory/new?inventoryId=${encodeURIComponent(inventoryId)}&contractVersionId=${encodeURIComponent(contractVersionId)}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800"
            >
              Continuar inventario
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/inventory/preview?inventoryId=${encodeURIComponent(inventoryId)}`}
              className="rounded-2xl border border-emerald-500 px-4 py-2 text-sm text-emerald-700"
            >
              Ver inventario
            </Link>
            <Link
              href={`/dashboard/contracts/${id}/delivery-act?inventoryId=${encodeURIComponent(inventoryId)}&contractVersionId=${encodeURIComponent(contractVersionId)}`}
              className="rounded-lg border border-sky-500 px-4 py-2 text-sm text-sky-800"
            >
              Generar acta de entrega
            </Link>
          </>
        )}
      </div>
    </WizardShell>
  );
}

