"use client";

import { OPEN_PREFERENCES_EVENT } from "@/lib/consent/cookie-consent";

/** Enlace del footer que reabre el panel de preferencias de cookies. */
export function CookiePreferencesLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}
      className="text-slate-700 underline-offset-4 hover:text-violet-700 hover:underline"
    >
      Preferencias de cookies
    </button>
  );
}
