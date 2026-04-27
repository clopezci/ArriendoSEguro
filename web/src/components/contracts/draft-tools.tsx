"use client";

import { useAuth } from "@/contexts/auth-context";
import {
  canCreateContract,
  getDraft,
  getUserAccessStatus,
  type ContractDraft,
} from "@/features/contracts/wizard-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function useDraftGuard(id: string) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "blocked">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/ingresar?redirect=/dashboard/contracts/${id}/landlord`);
      return;
    }
    const access = getUserAccessStatus(user.uid);
    const gate = canCreateContract(user, access);
    if (!gate.allowed) {
      router.replace("/dashboard/leases");
      return;
    }
    const found = getDraft(id);
    if (!found || found.userId !== user.uid) {
      setState("blocked");
      return;
    }
    setDraft(found);
    setState("ready");
  }, [id, user, loading, router]);

  return { draft, state };
}

export function StepNav({
  backHref,
  backLabel = "Anterior",
  nextHref,
  nextLabel = "Guardar y continuar",
}: {
  backHref?: string;
  backLabel?: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {backHref && (
        <Link
          href={backHref}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
        >
          {backLabel}
        </Link>
      )}
      {nextHref && (
        <button
          form="wizard-form"
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

