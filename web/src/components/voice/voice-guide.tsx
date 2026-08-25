"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isVoiceMuted, setVoiceMuted, onMuteChange, speakGuide, stopSpeaking, voiceSupported } from "@/lib/voice/voiceGuide";

/**
 * Texto de guía por pantalla. Devuelve null si esa ruta la narra la propia
 * pantalla (p. ej. el asistente `/nuevo` narra cada paso por su cuenta).
 */
function guideForPath(path: string): string | null {
  if (path === "/") return "Bienvenido a ArriendoSeguro. Aquí puedes crear el contrato de tu arriendo, paso a paso y fácil. Cuando quieras empezar, toca el botón de crear mi contrato.";
  if (path === "/nuevo") return null; // el asistente narra cada pregunta
  if (path === "/nuevo/contratos") return "Estos son tus contratos. Toca uno para continuarlo, revisarlo o administrar tu arriendo.";
  if (path.startsWith("/nuevo/gestionar")) {
    if (path.includes("/inventario")) return "Aquí haces el inventario del inmueble por zonas, con fotos y notas por voz. Al terminar se genera el acta de entrega.";
    return "Este es el panel para administrar tu arriendo. Elige una cosa a la vez: pagos, inventario, reputación, cierre y más.";
  }
  if (path === "/inquilino") return "Aquí administras tus arriendos como inquilino: registrar pagos, reportar daños, pedir tu paz y salvo y ver tu reputación.";
  if (path.startsWith("/inquilino/") && path.includes("/pagos")) return "Aquí registras tu pago del mes. Elige el comprobante con el botón, escribe el valor y la fecha, y envíalo. El dueño lo confirma.";
  if (path.startsWith("/dashboard/reputacion")) return "Esta es tu reputación. Puedes verla por rol, compartirla con un enlace o un código Q R, y consultar la de otra persona con su permiso.";
  if (path.startsWith("/dashboard/contracts") && path.includes("/mantenimiento")) return "Aquí reportas daños o solicitudes. Describe el problema, adjunta una foto si quieres, y envíalo al dueño.";
  if (path.startsWith("/dashboard/contracts") && path.includes("/terminacion")) return "Aquí avisas la no renovación o la terminación del contrato, según la ley. Se deja constancia y se avisa a la otra parte.";
  if (path.startsWith("/dashboard/contracts") && path.includes("/reputacion")) return "Aquí calificas la experiencia del arriendo. Si te calificaron a ti, también puedes responder.";
  if (path.startsWith("/dashboard/plans")) return "Aquí ves tu plan. Puedes pagar tu contrato de forma segura para desbloquear la firma y la descarga.";
  if (path === "/ingresar") return "Ingresa con tu correo, con Google, o crea una cuenta nueva para guardar tu avance. Es rápido y seguro.";
  if (path === "/funcionalidades") return "Aquí ves todo lo que puedes hacer en la aplicación. En cada tarjeta, toca cómo funciona para una guía rápida.";
  if (path.startsWith("/pago/")) return "Aquí subes tu comprobante de pago. Elige el archivo con el botón, escribe el valor y envíalo.";
  if (path.startsWith("/notaria/")) return "Aquí subes el documento firmado. Elige el archivo con el botón y con un toque queda guardado en el contrato.";
  if (path.startsWith("/invitacion/") || path.startsWith("/firma/")) return "Sigue los pasos para completar tu parte del contrato. Te guiaré en cada campo.";
  return null;
}

export function VoiceGuide() {
  const pathname = usePathname() ?? "";
  const [muted, setMuted] = useState(true); // hasta leer localStorage, asumimos apagado
  const [ready, setReady] = useState(false);
  const spokenGesture = useRef(false);

  // Sincroniza el estado con el interruptor persistido.
  useEffect(() => {
    setMuted(isVoiceMuted());
    setReady(true);
    const off = onMuteChange((m) => setMuted(m));
    return off;
  }, []);

  // Narra la guía de la pantalla al cambiar de ruta (si la voz está activa).
  useEffect(() => {
    if (!ready || muted) { stopSpeaking(); return; }
    const text = guideForPath(pathname);
    if (text) speakGuide(text);
    else stopSpeaking();
  }, [pathname, muted, ready]);

  // Los navegadores bloquean el audio hasta el primer gesto: al primer toque,
  // si la voz está activa y aún no ha hablado, narramos la pantalla actual.
  useEffect(() => {
    if (!ready || muted) return;
    const onFirst = () => {
      if (spokenGesture.current) return;
      spokenGesture.current = true;
      const text = guideForPath(pathname);
      if (text) speakGuide(text);
    };
    window.addEventListener("pointerdown", onFirst, { once: true, passive: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, [ready, muted, pathname]);

  if (!ready || !voiceSupported()) return null;

  const toggle = () => {
    const next = !muted;
    setVoiceMuted(next);
    setMuted(next);
    if (!next) {
      // Al reactivar, narra la pantalla actual de inmediato.
      const text = guideForPath(pathname);
      if (text) speakGuide(text);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Activar guía por voz" : "Silenciar guía por voz"}
      aria-pressed={!muted}
      title={muted ? "Activar la guía hablada" : "Silenciar la guía hablada"}
      className={`fixed bottom-24 left-4 z-[70] inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-lg transition active:scale-95 ${
        muted ? "border-2 border-slate-300 bg-white text-slate-600" : "bg-[#5646E5] text-white shadow-violet-500/30"
      }`}
    >
      <span className="text-lg leading-none">{muted ? "🔇" : "🔊"}</span>
      <span>{muted ? "Escuchar guía" : "Guía activada"}</span>
    </button>
  );
}
