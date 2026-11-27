"use client";

import { useEffect } from "react";
import { flushOfflineQueue } from "@/lib/offline-db";
import { preloadOfflineLayers } from "@/lib/spatial-offline";

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Pre-cargar capas geojson para que estén listas en modo avión
    preloadOfflineLayers().catch(() => {});

    const tryFlush = () => {
      if (navigator.onLine) {
        flushOfflineQueue().catch(() => {});
      }
    };

    tryFlush();
    window.addEventListener("online", tryFlush);
    const onVis = () => {
      if (document.visibilityState === "visible") tryFlush();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
