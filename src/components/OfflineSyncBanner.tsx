"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { flushOfflineQueue, getPendingReports, type PendingReportRecord } from "@/lib/offline-db";

export function OfflineSyncBanner({ onSynced }: { onSynced?: () => void }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<PendingReportRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const refresh = async () => {
    setOnline(navigator.onLine);
    const items = await getPendingReports();
    setPending(items);
  };

  useEffect(() => {
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("manglar-queue-changed", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("manglar-queue-changed", refresh);
    };
  }, []);

  const handleSync = async () => {
    if (!online || syncing) return;
    setSyncing(true);
    try {
      const res = await flushOfflineQueue();
      await refresh();
      if (res.synced > 0) {
        setLastMsg(`Se sincronizaron ${res.synced} reporte(s) con la CRA.`);
        onSynced?.();
      }
    } finally {
      setSyncing(false);
    }
  };

  if (online && pending.length === 0 && !lastMsg) return null;

  return (
    <div
      role="status"
      className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
        !online
          ? "border-[#D94E2A]/30 bg-[#D94E2A]/10 text-[#08334C]"
          : pending.length > 0
          ? "border-[#EDB512]/50 bg-[#F8D86F]/30 text-[#08334C]"
          : "border-[#1F7A4C]/30 bg-[#1F7A4C]/10 text-[#1F7A4C]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {!online ? (
          <CloudOff className="h-5 w-5 shrink-0 text-[#D94E2A]" strokeWidth={1.7} />
        ) : pending.length > 0 ? (
          <RefreshCw className="h-5 w-5 shrink-0 text-[#005F96]" strokeWidth={1.7} />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1F7A4C]" strokeWidth={1.7} />
        )}
        <div>
          {!online ? (
            <p className="font-bold">
              Sin conexión a internet · Modo campo activo
              {pending.length > 0 ? ` (${pending.length} en cola local)` : ""}
            </p>
          ) : pending.length > 0 ? (
            <p className="font-bold">
              Tienes {pending.length} reporte(s) guardado(s) en el dispositivo listo(s) para subir.
            </p>
          ) : (
            <p className="font-bold">{lastMsg}</p>
          )}
          {!online && (
            <p className="text-xs text-[#08334C]/75">
              Tus fotos originales (con EXIF), GPS y cruce espacial se guardan en IndexedDB y subirán automáticamente al reconectar.
            </p>
          )}
        </div>
      </div>

      {online && pending.length > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[#005F96] px-4 py-2 text-xs font-black text-white transition hover:bg-[#08334C] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      )}
    </div>
  );
}
