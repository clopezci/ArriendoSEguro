"use client";

import { useAuth } from "@/contexts/auth-context";
import {
  createContractDraft,
} from "@/features/contracts/wizard-state";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

export default function NewContractPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      if (!user) {
        router.replace("/ingresar?redirect=/dashboard/contracts/new");
        return;
      }
      const headers = await buildAuthHeaders(user);

      // Verificamos que el usuario tenga consentimiento vigente de
      // tratamiento de datos antes de habilitar la creación de un contrato.
      // Si la consulta falla, no bloqueamos: la pantalla del wizard hará el
      // chequeo otra vez en su contexto.
      try {
        const consentRes = await fetch("/api/consents/check", { headers });
        const consentData = (await consentRes.json()) as {
          success?: boolean;
          hasActiveConsent?: boolean;
        };
        if (consentRes.ok && consentData.success && !consentData.hasActiveConsent) {
          router.replace(
            "/dashboard/consentimiento?redirect=/dashboard/contracts/new",
          );
          return;
        }
      } catch {
        // continuamos; el siguiente paso volverá a pedirlo si hace falta.
      }

      const accessRes = await fetch("/api/access/entitlements/me", { headers });
      const accessData = (await accessRes.json()) as {
        success?: boolean;
        plusActive?: boolean;
        demoActive?: boolean;
      };
      if (!accessRes.ok || !accessData.success) {
        router.replace("/dashboard/contracts/access-blocked");
        return;
      }

      if (accessData.plusActive) {
        const consume = await fetch("/api/access/contracts/consume-plus", {
          method: "POST",
          headers,
        });
        const consumeData = (await consume.json()) as { success?: boolean };
        if (!consume.ok || !consumeData.success) {
          router.replace("/dashboard/contracts/access-blocked");
          return;
        }
        const realDraft = createContractDraft({
          userId: user.uid,
          accessStatus: "paid",
          isDemo: false,
        });
        router.replace(`/dashboard/contracts/${realDraft.id}/contract-type`);
        return;
      }

      if (accessData.demoActive) {
        const demoDraft = createContractDraft({
          userId: user.uid,
          accessStatus: "demo",
          isDemo: true,
        });
        router.replace(`/dashboard/contracts/${demoDraft.id}/contract-type`);
        return;
      }
      router.replace("/dashboard/contracts/access-blocked");
    };
    void run();
  }, [user, router]);

  return <p className="text-sm text-slate-700">Creando expediente…</p>;
}

