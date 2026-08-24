"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics/track";

/**
 * Micro-encuesta de INTENCIÓN DE SALIDA (no intrusiva). Solo aparece en las
 * páginas del embudo (inicio y asistente), UNA vez por sesión y, si el usuario
 * la ve, no vuelve a molestar en 14 días. Se dispara con:
 *  - Escritorio: el cursor sale por arriba (va a cerrar/cambiar de pestaña).
 *  - Cualquier dispositivo: 75 s de inactividad (respaldo suave).
 * Además registra un `page_abandon` pasivo cuando la página se oculta.
 *
 * Todo es best-effort y jamás bloquea la navegación. Motivos → `abandon_reason`.
 */
const ARMED_ROUTES = new Set(["/", "/nuevo"]);
const SEEN_KEY = "as_exit_survey_seen";
const COOLDOWN_DAYS = 14;
const DWELL_MS = 6000; // no molestar en los primeros segundos

const REASONS: { key: string; label: string; emoji: string }[] = [
  { key: "solo_mirando", label: "Solo estaba mirando", emoji: "👀" },
  { key: "equivocado", label: "Me equivoqué de sitio", emoji: "🤷" },
  { key: "no_es_lo_que_busco", label: "No es lo que buscaba", emoji: "🔍" },
  { key: "complicado", label: "Se me hizo complicado", emoji: "😵‍💫" },
  { key: "precio", label: "Por el precio", emoji: "💸" },
  { key: "falta_info", label: "Me faltó información", emoji: "❓" },
  { key: "otro", label: "Otro", emoji: "✍️" },
];

let shownThisSession = false;

export function ExitIntentSurvey() {
  const pathname = usePathname();
  const armed = ARMED_ROUTES.has(pathname);
  const [open, setOpen] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [showOther, setShowOther] = useState(false);
  const mountedAt = useRef(0);
  const abandonLogged = useRef(false);
  const returnLogged = useRef(false);
  const interacted = useRef(false);   // ¿el usuario tocó/movió algo? (apagar pantalla no cuenta)
  const lastVisibleAt = useRef(0);    // para ignorar el popstate que dispara "despertar" la pantalla

  const inCooldown = useCallback((): boolean => {
    try {
      const t = Number(localStorage.getItem(SEEN_KEY) ?? "0");
      return Number.isFinite(t) && Date.now() - t < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, []);

  const markSeen = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* noop */ }
  }, []);

  const trigger = useCallback(() => {
    if (shownThisSession || open) return;
    if (Date.now() - mountedAt.current < DWELL_MS) return;
    if (inCooldown()) return;
    // Requiere una interacción real (mover/tocar). Apagar/encender la pantalla NO
    // cuenta → así no aparece al despertar el celular/tablet.
    if (!interacted.current) return;
    // Ignora si acaba de volver a estar visible (despertar la pantalla ~1.5 s).
    if (Date.now() - lastVisibleAt.current < 1500) return;
    // NUNCA mostrar si la página no está visible.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const el = document.activeElement?.tagName;
    if (el === "INPUT" || el === "TEXTAREA" || el === "SELECT") return;
    shownThisSession = true;
    setOpen(true);
  }, [inCooldown, open]);

  useEffect(() => {
    if (!armed) return;
    mountedAt.current = Date.now();
    abandonLogged.current = false;
    returnLogged.current = false;
    lastVisibleAt.current = Date.now();

    // 1) Escritorio: el cursor sale por el borde superior (va a cerrar/cambiar tab).
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) trigger();
    };
    // 2) Registro PASIVO de abandono al ocultarse (sin UI: la página ya no se ve).
    const onHide = () => {
      if (abandonLogged.current) return;
      abandonLogged.current = true;
      track("page_abandon", { path: pathname });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") { onHide(); return; }
      lastVisibleAt.current = Date.now(); // marca el "despertar" para ignorar popstate espurio
      // Volvió a la app tras haberse ido → lo contamos como RETORNO (una vez).
      if (abandonLogged.current && !returnLogged.current) {
        returnLogged.current = true;
        track("app_return", { path: pathname });
      }
    };
    // Marca que hubo interacción real (tocar/mover/teclear). Apagar/encender la
    // pantalla no dispara ninguno de estos → la encuesta no aparece al despertar.
    const markInteracted = () => { interacted.current = true; };

    // 3) Móvil (y escritorio): TRAMPA del botón "Atrás". Al presionar atrás, la
    // página aún está visible → mostramos la encuesta en vez de dejarlo salir en
    // silencio. Se arma tras el umbral de permanencia y solo si no la ha visto.
    const armBackGuard = () => {
      if (shownThisSession || inCooldown()) return;
      try { history.pushState({ _asExitGuard: true }, ""); } catch { /* noop */ }
    };
    const onPop = () => {
      // Ignora el popstate espurio al despertar la pantalla, o sin interacción real.
      if (!interacted.current || Date.now() - lastVisibleAt.current < 1500) return;
      // Si ya la vio, o no aplica, o entró hace nada → dejar salir normal.
      if (shownThisSession || inCooldown() || Date.now() - mountedAt.current < DWELL_MS) return;
      // Re-empujamos el estado para retenerlo un momento y mostramos la encuesta.
      try { history.pushState({ _asExitGuard: true }, ""); } catch { /* noop */ }
      trigger();
    };
    const armTimer = window.setTimeout(armBackGuard, DWELL_MS);

    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("popstate", onPop);
    ["pointerdown", "keydown", "touchstart", "mousemove", "wheel"].forEach((ev) =>
      window.addEventListener(ev, markInteracted, { passive: true }),
    );

    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("popstate", onPop);
      ["pointerdown", "keydown", "touchstart", "mousemove", "wheel"].forEach((ev) =>
        window.removeEventListener(ev, markInteracted),
      );
    };
  }, [armed, pathname, trigger]);

  if (!armed || !open) return null;

  const pick = (key: string) => {
    if (key === "otro") { setShowOther(true); return; }
    track("abandon_reason", { reason: key, path: pathname });
    finish();
  };
  const sendOther = () => {
    track("abandon_reason", { reason: "otro", path: pathname, detail: otherText.trim().slice(0, 200) });
    finish();
  };
  const finish = () => { markSeen(); setThanks(true); window.setTimeout(() => setOpen(false), 1300); };
  const dismiss = () => { markSeen(); track("abandon_dismissed", { path: pathname }); setOpen(false); };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3" role="dialog" aria-live="polite">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-black/5">
        {thanks ? (
          <p className="py-2 text-center text-sm font-semibold text-emerald-700">¡Gracias! Nos ayudas a mejorar 💜</p>
        ) : showOther ? (
          <div>
            <p className="text-sm font-bold text-slate-900">Cuéntanos en una línea</p>
            <textarea
              autoFocus value={otherText} onChange={(e) => setOtherText(e.target.value)} rows={2}
              placeholder="¿Qué te faltó o qué mejorarías?"
              className="mt-2 w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={dismiss} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500">Cerrar</button>
              <button type="button" onClick={sendOther} className="rounded-lg bg-[#5646E5] px-3 py-1.5 text-xs font-bold text-white">Enviar</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">¿Nos ayudas con algo rápido? 🙏</p>
                <p className="text-xs text-slate-500">Si te fueras sin usar la aplicación, ¿por qué sería? (un toque, es anónimo)</p>
              </div>
              <button type="button" onClick={dismiss} aria-label="Cerrar" className="-mt-1 rounded-full px-2 py-0.5 text-lg leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r.key} type="button" onClick={() => pick(r.key)}
                  className="rounded-full border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#5646E5] hover:text-[#5646E5] active:scale-95">
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
