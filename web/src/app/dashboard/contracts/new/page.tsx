"use client";

import { useAuth } from "@/contexts/auth-context";
import {
  canCreateContract,
  createContractDraft,
  getUserAccessStatus,
} from "@/features/contracts/wizard-state";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewContractPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/ingresar?redirect=/dashboard/contracts/new");
      return;
    }
    const access = getUserAccessStatus(user.uid);
    const gate = canCreateContract(user, access);
    if (!gate.allowed) {
      router.replace("/dashboard/contracts");
      return;
    }
    const draft = createContractDraft({
      userId: user.uid,
      accessStatus: access,
      isDemo: access === "demo",
    });
    router.replace(`/dashboard/contracts/${draft.id}/landlord`);
  }, [user, router]);

  return <p className="text-sm text-slate-300">Creando expediente…</p>;
}

