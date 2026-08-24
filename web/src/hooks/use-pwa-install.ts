"use client";

import { useCallback, useEffect, useState } from "react";

/** Evento `beforeinstallprompt` (Chromium / Edge / Android). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PwaInstallUiState = "loading" | "hidden" | "native" | "ios" | "manual";
export type PwaInstallHelpMode = "ios" | "android" | "desktop";

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ se hace pasar por "Mac" (UA de escritorio) pero es táctil.
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  if (/Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return true;
  return false;
}

export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [uiState, setUiState] = useState<PwaInstallUiState>("loading");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setUiState("hidden");
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setUiState("native");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const timer = window.setTimeout(() => {
      setUiState((prev) => {
        if (prev === "native") return prev;
        if (isIosDevice()) return "ios";
        return "manual";
      });
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const onInstallClick = useCallback(async () => {
    if (uiState === "ios" || uiState === "manual") {
      openHelp();
      return;
    }
    if (!deferredPrompt) {
      openHelp();
      return;
    }
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setUiState("hidden");
    } catch {
      openHelp();
    } finally {
      setBusy(false);
      setDeferredPrompt(null);
    }
  }, [uiState, deferredPrompt, openHelp]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, closeHelp]);

  const helpMode: PwaInstallHelpMode =
    uiState === "ios" ? "ios" : isAndroidDevice() ? "android" : "desktop";
  const visible = uiState !== "hidden" && uiState !== "loading";

  return {
    uiState,
    busy,
    helpOpen,
    helpMode,
    visible,
    openHelp,
    closeHelp,
    onInstallClick,
  };
}
