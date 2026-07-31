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

      // `canCreateRealContract` solo es true si queda crédito Plus disponible.
      // NO consumimos el cupo aquí: el cobro por contrato se hace UNA sola vez
      // al FIRMAR (`signatures/start`), igual que en el flujo /nuevo. Antes este
      // flujo consumía al crear y, con el cobro en la firma, se cobraba dos
      // veces. Aquí solo verificamos que tenga cupo para dejarlo crear.
      if (accessData.canCreateRealContract) {
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

      // Tier gratuito (configurable en admin): sin Plus ni demo, igual puede
      // crear y generar el contrato (con marca de agua + CTA a Plus). Firma y
      // posventa siguen siendo Plus. Si el admin lo apagó, va a acceso
      // bloqueado. Consultamos el valor autoritativo del servidor.
      let freeEnabled = freeTierEnabled;
      try {
        const ftRes = await fetch("/api/free-tier");
        const ft = (await ftRes.json()) as { success?: boolean; enabled?: boolean };
        if (ftRes.ok && ft.success) freeEnabled = Boolean(ft.enabled);
      } catch {
        /* sin red: usamos el valor por defecto del entorno */
      }
      if (freeEnabled) {
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

