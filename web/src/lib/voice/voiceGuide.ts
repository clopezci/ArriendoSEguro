/**
 * Guía por voz de la aplicación (para reducir fricción, pensada en adultos
 * mayores). Usa la síntesis de voz del navegador (Web Speech API). Se controla
 * con un único interruptor de "silencio" persistido en localStorage; cualquier
 * pantalla puede narrar con `speakGuide(...)` y todo respeta el mute.
 *
 * Best-effort: si el navegador no soporta voz, no hace nada. Los navegadores
 * pueden requerir una interacción del usuario antes de reproducir audio.
 */
const MUTE_KEY = "as-voice-guide-muted";
const listeners = new Set<(muted: boolean) => void>();

export function isVoiceMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* noop */ }
  if (muted) stopSpeaking();
  listeners.forEach((l) => l(muted));
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
}

/** Narra un texto (si la voz está activa). Cancela lo anterior. */
export function speakGuide(text: string): void {
  if (!text || !voiceSupported() || isVoiceMuted()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-CO";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* nunca romper la UX por la voz */
  }
}
