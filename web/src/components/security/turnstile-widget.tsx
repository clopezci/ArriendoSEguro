"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({
  onToken,
  action = "auth_form",
  requiredForSubmit = false,
}: {
  onToken: (token: string) => void;
  action?: string;
  /** Si es true, el texto aclara que hay que completar Turnstile para poder enviar el formulario. */
  requiredForSubmit?: boolean;
}) {
  const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!scriptReady || !siteKey || !hostRef.current) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;

    const tryRender = () => {
      if (cancelled || !hostRef.current) return;
      if (!window.turnstile) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(tryRender, 50);
        } else {
          setLoadError(
            "No se pudo cargar Cloudflare Turnstile (comprobá bloqueadores de scripts o la red). Igual podés iniciar sesión usando solo la suma de seguridad, salvo que tengas activado el modo estricto de Turnstile.",
          );
        }
        return;
      }

      if (widgetIdRef.current) return;

      try {
        widgetIdRef.current = window.turnstile.render(hostRef.current!, {
          sitekey: siteKey,
          action,
          theme: "auto",
          callback: (token) => {
            setLoadError(null);
            onTokenRef.current(token);
          },
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => {
            setLoadError(
              "Turnstile reportó un error (revisá que el dominio esté permitido en el panel de Cloudflare: localhost en desarrollo y tu dominio en producción).",
            );
            onTokenRef.current("");
          },
        });
      } catch {
        setLoadError("No se pudo mostrar el control de Cloudflare.");
        onTokenRef.current("");
      }
    };

    tryRender();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
      }
      widgetIdRef.current = null;
    };
  }, [scriptReady, siteKey, action]);

  if (!siteKey) return null;

  return (
    <div className="space-y-1">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={hostRef} className="min-h-[65px]" />
      {loadError && (
        <p className="text-[11px] text-amber-700 dark:text-amber-200/90">{loadError}</p>
      )}
      <p className="text-[11px] text-slate-500">
        Verificación opcional con Cloudflare Turnstile.
        {requiredForSubmit
          ? " Es obligatoria para entrar con la configuración actual."
          : " Si aparece el recuadro y lo completás, sumamos una capa extra contra bots; si no cargó, igual podés usar la suma de arriba."}
      </p>
    </div>
  );
}

