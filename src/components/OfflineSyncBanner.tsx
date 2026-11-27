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
      className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        !online
          ? "border-[#C84023]/35 bg-[#C84023]/10 text-[#041A29]"
          : pending.length > 0
          ? "border-[#EDB512]/60 bg-[#F8D86F]/30 text-[#041A29]"
          : "border-[#16794A]/35 bg-[#16794A]/10 text-[#16794A]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {!online ? (
          <CloudOff className="h-5 w-5 shrink-0 text-[#C84023]" strokeWidth={1.8} />
        ) : pending.length > 0 ? (
          <RefreshCw className="h-5 w-5 shrink-0 text-[#005F96]" strokeWidth={1.8} />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#16794A]" strokeWidth={1.8} />
        )}
        <div>
          {!online ? (
            <p className="font-bold">
              Sin conexión · Modo campo offline activo
              {pending.length > 0 ? ` (${pending.length} guardados en tu celular)` : ""}
            </p>
          ) : pending.length > 0 ? (
            <p className="font-bold">
              {pending.length} reporte(s) en cola local listos para sincronizar con la CRA.
            </p>
          ) : (
            <p className="font-bold">{lastMsg}</p>
          )}
          {!online && (
            <p className="text-xs text-[#041A29]/75">
              Tus fotos y ubicación se guardan en el celular sin gastar datos y se envían solas al volver la señal.
            </p>
          )}
        </div>
      </div>

      {online && pending.length > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#005F96] px-4 text-xs font-black text-white transition hover:bg-[#041A29] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      )}
    </div>
  );
}
