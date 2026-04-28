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
}: {
  onToken: (token: string) => void;
  action?: string;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !siteKey || !hostRef.current || !window.turnstile) return;
    if (widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(hostRef.current, {
      sitekey: siteKey,
      action,
      theme: "auto",
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [scriptReady, siteKey, action, onToken]);

  if (!siteKey) return null;

  return (
    <div className="space-y-1">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={hostRef} />
      <p className="text-[11px] text-slate-500">Control anti-bot protegido por Cloudflare Turnstile.</p>
    </div>
  );
}

