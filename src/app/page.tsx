"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Compass,
  GraduationCap,
  MapPin,
  Pause,
  Play,
  ShieldCheck,
  Trees,
} from "lucide-react";
import { CRA_GLOBAL_METRICS } from "@/lib/cra-domain";
import { CoastalExplorer } from "@/components/CoastalExplorer";
import { MascotaCangrejo } from "@/components/MascotaCangrejo";

const MARQUEE_ITEMS = [
  "MALLORQUÍN · BOCAS DE CENIZA",
  "PUERTO COLOMBIA · PUERTO VELERO",
  "TUBARÁ · JUAN DE ACOSTA",
  "EL TOTUMO · GALERAZAMBA",
  "828 HA POR REVISAR EN CAMPO",
  "524 PUNTOS GROUND-TRUTH CRA",
  "125,000 tC DE CARBONO AZUL",
];

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      videoRef.current?.pause();
      setPaused(true);
    }
  }, []);

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div>
      {/* HERO CINEMATOGRÁFICO FULL-BLEED (INSPIRADO EN MANGLARCRA.NETLIFY.APP) */}
      <section className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden bg-[#06273B] text-white">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster="/images/hero-manglar-atlantico.png"
          aria-hidden="true"
          className="ken-burns absolute inset-0 h-full w-full object-cover"
        >
          <source src="/media/portada_960.mp4" type="video/mp4" />
        </video>

        {/* Gradiente estuarino cinematográfico */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#052336]/65 via-[#005F96]/25 to-[#052336]/95"
        />

        {/* Botón discreto de pausa del video (accesibilidad CRA) */}
        <button
          type="button"
          onClick={toggleVideo}
          aria-pressed={paused}
          className="absolute right-5 top-24 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#052336]/55 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur-md transition hover:bg-[#052336]/80"
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          <span>{paused ? "Reproducir" : "Pausar vista"}</span>
        </button>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-28 sm:pb-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#F8D86F] backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#33A02C]" />
            Departamento del Atlántico · Monitoreo 2015–2026 + Ciencia Ciudadana
          </p>

          <h1 className="font-display mt-4 max-w-4xl text-[clamp(2.4rem,6vw,5.4rem)] font-black leading-[0.96] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
            El manglar del Atlántico, protegido por su gente.
          </h1>

          <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-white/88 sm:text-lg">
            Una herramienta viva para niños, turistas, pescadores y la CRA: reporta en 3 pasos incluso en modo avión, valida con mentores e IA y convierte cada foto en acción oficial.
          </p>

          {/* Dos puertas monumentales estilo manglarcra.netlify.app */}
          <div className="mt-8 grid gap-4 border-t-2 border-white/80 pt-5 md:grid-cols-2">
            <Link
              href="/reportar"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md transition-all duration-300 ease-coastal hover:border-[#F8D86F] hover:bg-white/18"
            >
              <div>
                <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#F8D86F]">
                  Entrada 1 · Modo Campo Offline
                </span>
                <span className="font-display mt-1 block text-2xl font-black sm:text-3xl">
                  Reportar en 60 segundos
                </span>
                <span className="mt-1 block text-xs text-white/80">
                  Foto con EXIF + GPS real + cruce inmediato con las {CRA_GLOBAL_METRICS.porRevisarHa} ha por revisar.
                </span>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EDB512] text-[#08334C] transition-transform duration-300 group-hover:scale-110">
                <Camera className="h-5 w-5" />
              </span>
            </Link>

            <Link
              href="/cra"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-[#052336]/55 p-5 backdrop-blur-md transition-all duration-300 ease-coastal hover:border-white hover:bg-[#052336]/80"
            >
              <div>
                <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
                  Entrada 2 · Tiempo Real CRA
                </span>
                <span className="font-display mt-1 block text-2xl font-black sm:text-3xl">
                  Sala Operativa y Datos
                </span>
                <span className="mt-1 block text-xs text-white/80">
                  Mapa satelital multicapa, doble validación y exportación abierta CSV / GeoJSON.
                </span>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#005F96] transition-transform duration-300 group-hover:translate-x-1">
                <MapPin className="h-5 w-5" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* MARQUEE CINÉTICO CARIBEÑO */}
      <div className="overflow-hidden border-y border-[#08334C]/10 bg-[#005F96] py-3.5 text-white">
        <div className="marquee-track items-center gap-8 text-xs font-black uppercase tracking-[0.18em]">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
            <span key={`${item}-${idx}`} className="inline-flex items-center gap-6">
              <span>{item}</span>
              <span className="text-[#F8D86F]">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* EXPLORADOR INTERACTIVO DE LOS 4 SECTORES */}
      <CoastalExplorer />

      {/* 3 PORTALES INMERSIVOS PARA CADA ACTOR */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#005F96]">
              Participación sostenible para todos
            </p>
            <h2 className="font-display mt-1 text-3xl font-black text-[#08334C]">
              Elige tu rol en la red viva del manglar
            </h2>
          </div>
          <MascotaCangrejo
            size="sm"
            title="Mangle te invita"
            message="Toca mi tenaza o explora el portal según seas estudiante, turista o mentor."
            className="max-w-md"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Escuelas */}
          <Link
            href="/escuelas"
            className="group relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-[1.85rem] bg-[#08334C] p-6 text-white shadow-xl"
          >
            <img
              src="/images/escuelas-guardianes.png"
              alt="Estudiantes guardianes del manglar"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-coastal group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#052336] via-[#052336]/50 to-transparent" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F7A4C] px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                <GraduationCap className="h-3.5 w-3.5" /> Modo Escuelas
              </span>
              <h3 className="font-display mt-2 text-2xl font-black">
                Guardianes Escolares y Cierre de Ciclo
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/85">
                Retos por colegio sobre las 828 ha por revisar y consulta pública del estado de cada alerta.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#F8D86F]">
                Entrar al reto escolar <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </span>
            </div>
          </Link>

          {/* Turistas QR */}
          <Link
            href="/turista"
            className="group relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-[1.85rem] bg-[#08334C] p-6 text-white shadow-xl"
          >
            <img
              src="/images/turista-qr-sendero.png"
              alt="Sendero turístico en manglar"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-coastal group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#052336] via-[#052336]/50 to-transparent" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDB512] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#08334C]">
                <Compass className="h-3.5 w-3.5" /> Pasaporte Turistas QR
              </span>
              <h3 className="font-display mt-2 text-2xl font-black">
                Escanea en el sendero sin crear cuenta
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/85">
                Ficha educativa de 30 segundos, QR real escaneable y reporte instantáneo geolocalizado.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#F8D86F]">
                Probar estaciones QR <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </span>
            </div>
          </Link>

          {/* Validación + Participación */}
          <div className="flex flex-col justify-between gap-4 rounded-[1.85rem] border border-[#08334C]/10 bg-white p-6 shadow-xl">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#005F96]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#005F96]">
                <ShieldCheck className="h-3.5 w-3.5" /> Gobernanza &amp; Fase 2 CRA
              </span>
              <h3 className="font-display mt-3 text-2xl font-black text-[#08334C]">
                Doble Validación y Proyectos MGA
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#08334C]/75">
                Los mentores comunitarios y académicos validan cada reporte antes de emitir alerta CRA, mientras organizaciones formulan proyectos con checklists Res. 1263/2018.
              </p>
            </div>

            <div className="space-y-2.5">
              <Link
                href="/validar"
                className="flex items-center justify-between rounded-2xl bg-[#F7F3EA] p-3.5 text-xs font-black text-[#08334C] transition hover:bg-[#005F96] hover:text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#1F7A4C]" />
                  Consola de Mentores (Semáforo 0–100)
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/participacion"
                className="flex items-center justify-between rounded-2xl bg-[#F7F3EA] p-3.5 text-xs font-black text-[#08334C] transition hover:bg-[#005F96] hover:text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Trees className="h-4 w-4 text-[#005F96]" />
                  Actores y Formulador MGA / CO₂e
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
