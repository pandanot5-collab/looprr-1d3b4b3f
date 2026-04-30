import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as any).MSStream;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true);

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export const useInstallPrompt = () => {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const fn = () => {
      setInstalled(isStandalone());
      force((n) => n + 1);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const canPrompt = !!deferredPrompt;
  const ios = isIOS();
  const available = !installed && (canPrompt || ios);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        deferredPrompt = null;
        listeners.forEach((l) => l());
      }
      return outcome;
    }
    return "unavailable" as const;
  }, []);

  return { available, canPrompt, ios, installed, promptInstall };
};
