"use client";

import { useAuth } from "@/contexts/auth-context";
import {
  createContractDraft,
} from "@/features/contracts/wizard-state";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { freeTierEnabled } from "@/lib/config";

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
        canCreateRealContract?: boolean;
        canUseDemo?: boolean;
      };
      if (!accessRes.ok || !accessData.success) {
        router.replace("/dashboard/contracts/access-blocked");
        return;
      }

      // `canCreateRealContract` solo es true si queda crédito por
      // consumir en algún entitlement Plus. Si el usuario ya gastó su
      // crédito y vuelve aquí, lo mandamos a la pantalla de acceso
      // bloqueado con motivo claro, en lugar de intentar consumir y
      // fallar a mitad del flujo.
      if (accessData.canCreateRealContract) {
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

      if (accessData.canUseDemo) {
        const demoDraft = createContractDraft({
          userId: user.uid,
          accessStatus: "demo",
          isDemo: true,
        });
        router.replace(`/dashboard/contracts/${demoDraft.id}/contract-type`);
        return;
      }

      // Tier gratuito: sin Plus ni demo, igual puede crear y generar el
      // contrato (saldrá con marca de agua + CTA a Plus). Firma y posventa
      // siguen siendo Plus. Se puede apagar con NEXT_PUBLIC_FREE_TIER_ENABLED.
      if (freeTierEnabled) {
        const freeDraft = createContractDraft({
          userId: user.uid,
          accessStatus: "free",
          isDemo: false,
        });
        router.replace(`/dashboard/contracts/${freeDraft.id}/contract-type`);
        return;
      }

      router.replace("/dashboard/contracts/access-blocked");
    };
    void run();
  }, [user, router]);

  return <p className="text-sm text-slate-700">Creando expediente…</p>;
}

