"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Camera,
  Compass,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Trees,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { getPendingReports, flushOfflineQueue } from "@/lib/offline-db";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Trees },
  { href: "/reportar", label: "Reportar", icon: Camera },
  { href: "/escuelas", label: "Escuelas", icon: GraduationCap },
  { href: "/turista", label: "Turista QR", icon: Compass },
  { href: "/validar", label: "Mentores", icon: ShieldCheck },
  { href: "/cra", label: "Panel CRA", icon: MapPin },
  { href: "/participacion", label: "Proyectos", icon: Trees },
];

export function Navbar() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateStatus = async () => {
      setOnline(navigator.onLine);
      try {
        const p = await getPendingReports();
        setPendingCount(p.length);
      } catch {
        setPendingCount(0);
      }
    };
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    window.addEventListener("manglar-queue-changed", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      window.removeEventListener("manglar-queue-changed", updateStatus);
    };
  }, []);

  const handleManualSync = async () => {
    if (!online || syncing) return;
    setSyncing(true);
    try {
      await flushOfflineQueue();
      const p = await getPendingReports();
      setPendingCount(p.length);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      {/* Isla flotante superior en Desktop */}
      <header className="sticky top-4 z-30 mx-auto max-w-6xl px-4">
        <div className="mx-auto flex w-full items-center justify-between gap-3 rounded-full border border-[#08334C]/10 bg-white/90 px-4 py-2 shadow-[0_14px_34px_-18px_rgba(8,51,76,0.35)] backdrop-blur-xl">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDB512]"
          >
            <img
              src="/images/pwa-icon-192.png"
              alt="Manglar Vivo Atlántico"
              className="h-9 w-9 rounded-full object-cover ring-2 ring-[#005F96]/15"
            />
            <div className="leading-tight">
              <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-[#005F96]">
                CRA Atlántico
              </span>
              <span className="font-display block text-sm font-bold text-[#08334C]">
                Manglar Vivo
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold tracking-wide transition-all duration-300 ease-coastal ${
                    active
                      ? "bg-[#005F96] text-white shadow-sm"
                      : "text-[#08334C]/80 hover:bg-[#08334C]/5 hover:text-[#08334C]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!online ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D94E2A]/12 px-3 py-1.5 text-xs font-bold text-[#D94E2A]">
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">Modo Avión</span>
              </span>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#EDB512] px-3 py-1.5 text-xs font-black text-[#08334C] transition active:scale-95"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                  strokeWidth={2}
                />
                <span>Sincronizar ({pendingCount})</span>
              </button>
            ) : (
              <span className="hidden items-center gap-1.5 rounded-full bg-[#1F7A4C]/10 px-3 py-1.5 text-xs font-bold text-[#1F7A4C] sm:inline-flex">
                <span className="h-2 w-2 rounded-full bg-[#1F7A4C]" />
                Offline listo
              </span>
            )}

            <Link
              href="/reportar"
              className="group inline-flex items-center gap-2 rounded-full bg-[#005F96] py-1.5 pl-4 pr-1.5 text-xs font-black text-white transition-all duration-300 ease-coastal hover:bg-[#08334C] active:scale-[0.98]"
            >
              <span>Reportar</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EDB512] text-[#08334C] transition-transform duration-300 group-hover:scale-105">
                <Camera className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Barra inferior táctil en Móvil (>= 48px tap targets) */}
      <nav
        aria-label="Menú móvil"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#08334C]/10 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {[
            { href: "/", label: "Inicio", icon: Trees },
            { href: "/reportar", label: "Reportar", icon: Camera },
            { href: "/escuelas", label: "Escuelas", icon: GraduationCap },
            { href: "/validar", label: "Mentores", icon: ShieldCheck },
            { href: "/cra", label: "CRA", icon: MapPin },
          ].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-2xl px-1 py-1 text-[11px] font-bold transition ${
                  active
                    ? "bg-[#005F96]/10 text-[#005F96]"
                    : "text-[#08334C]/70 hover:text-[#08334C]"
                }`}
              >
                <Icon className="mb-0.5 h-5 w-5" strokeWidth={active ? 2.1 : 1.6} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
