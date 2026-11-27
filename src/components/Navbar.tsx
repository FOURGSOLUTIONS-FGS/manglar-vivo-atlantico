"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  Camera,
  ChevronDown,
  Compass,
  GraduationCap,
  Home,
  Map as MapIcon,
  ShieldCheck,
  Users,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { flushOfflineQueue, getPendingReports } from "@/lib/offline-db";

const COMMUNITY_LINKS = [
  {
    href: "/escuelas",
    label: "Modo Escuelas PRAES",
    desc: "Adopción de las 828 ha por revisar y cierre de ciclo",
    icon: GraduationCap,
  },
  {
    href: "/turista",
    label: "Estaciones QR Turistas",
    desc: "Pasaporte eco-turístico y reporte en 60 segundos",
    icon: Compass,
  },
  {
    href: "/participacion",
    label: "Actores, Checklists y MGA",
    desc: "Registro Ley 1581, Res. 1263/2018 y borrador CO₂e",
    icon: Users,
  },
];

const CRA_LINKS = [
  {
    href: "/admin",
    label: "Centro Admin y Alertas",
    desc: "Clasificación por nivel, seguimiento, sonidos y correos urgentes",
    icon: BellRing,
  },
  {
    href: "/cra",
    label: "Sala Operativa Satelital",
    desc: "Mapa en vivo del manglar y datos abiertos",
    icon: MapIcon,
  },
  {
    href: "/validar",
    label: "Consola de Mentores",
    desc: "Doble validación comunitaria + académica y semáforo",
    icon: ShieldCheck,
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<"comunidad" | "cra" | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  const isDarkHeroRoute = pathname === "/" || pathname.startsWith("/p/");

  useEffect(() => {
    const syncState = async () => {
      setOnline(navigator.onLine);
      const pending = await getPendingReports().catch(() => []);
      setPendingCount(pending.length);
    };

    const handleOnline = async () => {
      setOnline(true);
      await flushOfflineQueue().catch(() => {});
      await syncState();
    };

    const handleOffline = () => setOnline(false);

    const handleScroll = () => {
      setScrolled(window.scrollY > 36);
    };

    syncState();
    handleScroll();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("manglar-queue-changed", syncState);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("manglar-queue-changed", syncState);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const solidHeader = !isDarkHeroRoute || scrolled || openMenu !== null;

  return (
    <>
      <header
        ref={navRef}
        className={`fixed left-0 right-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300 ${
          solidHeader
            ? "border-b border-white/12 bg-[#041A29]/95 backdrop-blur-md"
            : "border-b border-white/10 bg-gradient-to-b from-[#041A29]/80 to-transparent"
        }`}
      >
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-5 lg:px-10">
          {/* Identidad institucional CRA */}
          <Link href="/" className="flex items-center gap-3 text-white">
            <img
              src="/media/logo_cra_blanco.png"
              alt="CRA Atlántico"
              className="h-9 w-auto object-contain"
            />
            <span className="h-6 w-px bg-white/20" aria-hidden="true" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-sm font-black tracking-tight text-white">
                MANGLAR VIVO
              </span>
              <span className="mt-1 text-[11px] font-bold text-[#F8D86F]">
                Atlántico · Ciencia Ciudadana
              </span>
            </span>
          </Link>

          {/* Navegación principal desktop */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            <Link
              href="/"
              className={`inline-flex min-h-[44px] items-center px-3.5 text-sm font-bold transition ${
                pathname === "/" ? "text-[#F8D86F]" : "text-white/85 hover:text-white"
              }`}
            >
              Territorio
            </Link>

            {/* Dropdown Comunidad */}
            <div className="relative">
              <button
                type="button"
                aria-expanded={openMenu === "comunidad"}
                onClick={() =>
                  setOpenMenu((prev) => (prev === "comunidad" ? null : "comunidad"))
                }
                className={`inline-flex min-h-[44px] items-center gap-2 px-3.5 text-sm font-bold transition ${
                  ["/escuelas", "/turista", "/participacion"].includes(pathname) ||
                  openMenu === "comunidad"
                    ? "text-[#F8D86F]"
                    : "text-white/85 hover:text-white"
                }`}
              >
                <span>Comunidad</span>
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 bg-[#EDB512] transition-transform duration-200 ${
                    openMenu === "comunidad" ? "rotate-45 scale-125" : "rotate-0"
                  }`}
                />
                <ChevronDown
                  className={`h-3.5 w-3.5 opacity-70 transition-transform ${
                    openMenu === "comunidad" ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openMenu === "comunidad" && (
                <div className="absolute left-0 top-[60px] w-80 border border-white/12 border-t-2 border-t-[#EDB512] bg-[#041A29] p-2 shadow-2xl">
                  {COMMUNITY_LINKS.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-start gap-3 rounded-lg p-3 transition ${
                          active ? "bg-[#005F96] text-white" : "text-white/90 hover:bg-white/8"
                        }`}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#F8D86F]" strokeWidth={1.9} />
                        <span>
                          <span className="block text-sm font-bold leading-snug">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-white/65">{item.desc}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dropdown Sala CRA */}
            <div className="relative">
              <button
                type="button"
                aria-expanded={openMenu === "cra"}
                onClick={() => setOpenMenu((prev) => (prev === "cra" ? null : "cra"))}
                className={`inline-flex min-h-[44px] items-center gap-2 px-3.5 text-sm font-bold transition ${
                  ["/admin", "/cra", "/validar"].includes(pathname) || openMenu === "cra"
                    ? "text-[#F8D86F]"
                    : "text-white/85 hover:text-white"
                }`}
              >
                <span>Gobernanza CRA</span>
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 bg-[#EDB512] transition-transform duration-200 ${
                    openMenu === "cra" ? "rotate-45 scale-125" : "rotate-0"
                  }`}
                />
                <ChevronDown
                  className={`h-3.5 w-3.5 opacity-70 transition-transform ${
                    openMenu === "cra" ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openMenu === "cra" && (
                <div className="absolute right-0 top-[60px] w-80 border border-white/12 border-t-2 border-t-[#EDB512] bg-[#041A29] p-2 shadow-2xl">
                  {CRA_LINKS.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-start gap-3 rounded-lg p-3 transition ${
                          active ? "bg-[#005F96] text-white" : "text-white/90 hover:bg-white/8"
                        }`}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#F8D86F]" strokeWidth={1.9} />
                        <span>
                          <span className="block text-sm font-bold leading-snug">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-white/65">{item.desc}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Estado offline + CTA primario */}
          <div className="flex items-center gap-2.5">
            {!online ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#C84023]/60 bg-[#C84023]/20 px-3 py-1 text-xs font-bold text-[#FCA5A5]"
              >
                <WifiOff className="h-3.5 w-3.5" />
                Offline{pendingCount > 0 ? ` (${pendingCount})` : ""}
              </span>
            ) : pendingCount > 0 ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#EDB512]/60 bg-[#EDB512]/20 px-3 py-1 text-xs font-bold text-[#F8D86F]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {pendingCount} por subir
              </span>
            ) : null}

            <Link
              href="/reportar"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
                pathname === "/reportar"
                  ? "bg-white text-[#041A29]"
                  : "bg-[#EDB512] text-[#041A29] hover:bg-[#F8D86F]"
              }`}
            >
              <Camera className="h-4 w-4" strokeWidth={2.2} />
              <span>Reportar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Espaciador para rutas con fondo claro */}
      {!isDarkHeroRoute && <div className="h-[72px]" aria-hidden="true" />}

      {/* Barra inferior táctil en campo (móvil) */}
      <nav
        aria-label="Navegación móvil de campo"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/12 bg-[#041A29] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid h-[64px] grid-cols-4">
          {[
            { href: "/", label: "Inicio", icon: Home },
            { href: "/reportar", label: "Reportar", icon: Camera },
            { href: "/escuelas", label: "Escuelas", icon: GraduationCap },
            { href: "/cra", label: "Sala CRA", icon: MapIcon },
          ].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                  active ? "bg-[#005F96] text-[#F8D86F]" : "text-white/75 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
