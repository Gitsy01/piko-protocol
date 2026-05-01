"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePwa() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const isLocalhost =
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

    async function clearServiceWorkerState() {
      const [registrations, cacheKeys] = await Promise.all([
        navigator.serviceWorker.getRegistrations(),
        caches.keys(),
      ]);

      await Promise.all(registrations.map((registration) => registration.unregister()));
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator && isLocalhost) {
      clearServiceWorkerState().catch(() => undefined);
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update().catch(() => undefined))
        .catch(() => undefined);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function promptInstall() {
    if (!installEvent) {
      return false;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
      return true;
    }

    return false;
  }

  async function enableNotifications(body: string) {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: "SHOW_NEARBY_REWARD",
      body,
    });
    setNotificationsEnabled(true);
    return true;
  }

  return {
    canInstall: installEvent != null,
    notificationsEnabled,
    promptInstall,
    enableNotifications,
  };
}
