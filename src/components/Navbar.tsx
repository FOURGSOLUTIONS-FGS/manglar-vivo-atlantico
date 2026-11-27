"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Camera,
  ChevronDown,
  Compass,
  GraduationCap,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Trees,
  Users,
  WifiOff,
} from "lucide-react";
import { flushOfflineQueue, getPendingReports } from "@/lib/offline-db";

export function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [openMenu, setOpenMenu] = useState<"comunidad" | "cra" | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

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

  const darkGlass = isHome && !scrolled;

  return (
    <>
      <header className="fixed inset-x-0 top-3.5 z-30 mx-auto max-w-6xl px-4">
        <div
          className={`mx-auto flex w-full items-center justify-between gap-3 rounded-full border px-4 py-2 transition-all duration-500 ease-coastal backdrop-blur-xl ${
            darkGlass
              ? "border-white/20 bg-[#08334C]/55 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)]"
              : "border-[#08334C]/10 bg-white/92 text-[#08334C] shadow-[0_14px_34px_-18px_rgba(8,51,76,0.3)]"
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDB512]"
          >
            <img
              src={darkGlass ? "/media/logo_cra_blanco.png" : "/images/pwa-icon-192.png"}
              alt="CRA Atlántico · Manglar Vivo"
              className={`h-9 w-auto rounded-full object-contain ${
                darkGlass ? "max-w-[46px]" : "w-9 ring-2 ring-[#005F96]/15"
              }`}
            />
            <div className="leading-tight">
              <span
                className={`block text-[10px] font-black uppercase tracking-[0.16em] ${
                  darkGlass ? "text-[#F8D86F]" : "text-[#005F96]"
                }`}
              >
                CRA Atlántico
              </span>
              <span className="font-display block text-sm font-bold">
                Manglar Vivo
              </span>
            </div>
          </Link>

          {/* Navegación limpia de 4 pilares */}
          <nav className="relative hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            <Link
              href="/"
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                pathname === "/"
                  ? darkGlass
                    ? "bg-white/20 text-white"
                    : "bg-[#005F96] text-white"
                  : darkGlass
                  ? "text-white/85 hover:bg-white/10"
                  : "text-[#08334C]/80 hover:bg-[#08334C]/5"
              }`}
            >
              Explorar
            </Link>

            <Link
              href="/reportar"
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                pathname === "/reportar"
                  ? "bg-[#005F96] text-white"
                  : darkGlass
                  ? "text-white/85 hover:bg-white/10"
                  : "text-[#08334C]/80 hover:bg-[#08334C]/5"
              }`}
            >
              Reportar
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === "comunidad" ? null : "comunidad"))}
                className={`inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  ["/escuelas", "/turista", "/participacion"].includes(pathname)
                    ? darkGlass
                      ? "bg-white/20 text-white"
                      : "bg-[#005F96] text-white"
                    : darkGlass
                    ? "text-white/85 hover:bg-white/10"
                    : "text-[#08334C]/80 hover:bg-[#08334C]/5"
                }`}
              >
                <span>Comunidad</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {openMenu === "comunidad" && (
                <div className="absolute left-0 top-12 w-64 rounded-2xl border border-[#08334C]/12 bg-white p-2 text-[#08334C] shadow-xl">
                  <Link
                    href="/escuelas"
                    className="flex items-center gap-3 rounded-xl p-2.5 text-xs hover:bg-[#F7F3EA]"
                  >
                    <GraduationCap className="h-4 w-4 text-[#1F7A4C]" />
                    <div>
                      <p className="font-black">Modo Escuelas</p>
                      <p className="text-[11px] text-[#08334C]/65">Reto 828 ha y cierre de ciclo</p>
                    </div>
                  </Link>
                  <Link
                    href="/turista"
                    className="flex items-center gap-3 rounded-xl p-2.5 text-xs hover:bg-[#F7F3EA]"
                  >
                    <Compass className="h-4 w-4 text-[#005F96]" />
                    <div>
                      <p className="font-black">Turistas QR</p>
                      <p className="text-[11px] text-[#08334C]/65">Pasaporte de senderos sin registro</p>
                    </div>
                  </Link>
                  <Link
                    href="/participacion"
                    className="flex items-center gap-3 rounded-xl p-2.5 text-xs hover:bg-[#F7F3EA]"
                  >
                    <Users className="h-4 w-4 text-[#EDB512]" />
                    <div>
                      <p className="font-black">Actores y Proyectos</p>
                      <p className="text-[11px] text-[#08334C]/65">Checklists CRA y MGA / CO₂e</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === "cra" ? null : "cra"))}
                className={`inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  ["/cra", "/validar"].includes(pathname)
                    ? darkGlass
                      ? "bg-white/20 text-white"
                      : "bg-[#005F96] text-white"
                    : darkGlass
                    ? "text-white/85 hover:bg-white/10"
                    : "text-[#08334C]/80 hover:bg-[#08334C]/5"
                }`}
              >
                <span>Sala CRA</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {openMenu === "cra" && (
                <div className="absolute left-0 top-12 w-64 rounded-2xl border border-[#08334C]/12 bg-white p-2 text-[#08334C] shadow-xl">
                  <Link
                    href="/cra"
                    className="flex items-center gap-3 rounded-xl p-2.5 text-xs hover:bg-[#F7F3EA]"
                  >
                    <MapPin className="h-4 w-4 text-[#005F96]" />
                    <div>
                      <p className="font-black">Panel Operativo CRA</p>
                      <p className="text-[11px] text-[#08334C]/65">Mapa satelital, Realtime y CSV</p>
                    </div>
                  </Link>
                  <Link
                    href="/validar"
                    className="flex items-center gap-3 rounded-xl p-2.5 text-xs hover:bg-[#F7F3EA]"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#1F7A4C]" />
                    <div>
                      <p className="font-black">Consola de Mentores</p>
                      <p className="text-[11px] text-[#08334C]/65">Doble validación y Semáforo</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            {!online ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D94E2A] px-3 py-1.5 text-xs font-black text-white">
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">Offline</span>
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
              <span
                className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${
                  darkGlass
                    ? "bg-white/15 text-white"
                    : "bg-[#1F7A4C]/10 text-[#1F7A4C]"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#33A02C]" />
                Modo campo listo
              </span>
            )}

            <Link
              href="/reportar"
              className="group inline-flex items-center gap-2 rounded-full bg-[#EDB512] py-1.5 pl-4 pr-1.5 text-xs font-black text-[#08334C] shadow-md transition-all duration-300 ease-coastal hover:bg-[#F8D86F] active:scale-[0.98]"
            >
              <span>Reportar</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#08334C] text-white transition-transform duration-300 group-hover:scale-105">
                <Camera className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Espaciador automático en rutas internas para no quedar bajo la isla fija */}
      {!isHome && <div className="h-20 md:h-24" aria-hidden="true" />}

      {/* Barra inferior táctil en móvil (>= 52px tap targets) */}
      <nav
        aria-label="Menú móvil"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#08334C]/10 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {[
            { href: "/", label: "Inicio", icon: Trees },
            { href: "/reportar", label: "Reportar", icon: Camera },
            { href: "/escuelas", label: "Escuelas", icon: GraduationCap },
            { href: "/turista", label: "Turista", icon: Compass },
            { href: "/cra", label: "CRA", icon: MapPin },
          ].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-2xl px-1 py-1 text-[11px] font-bold transition ${
                  active
                    ? "bg-[#005F96]/12 text-[#005F96]"
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
