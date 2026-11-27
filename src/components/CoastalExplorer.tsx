"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, MapPin } from "lucide-react";
import { CRA_GLOBAL_METRICS, CRA_SECTORS } from "@/lib/cra-domain";

const SECTOR_CONTEXT: Record<number, { highlight: string; focusTag: string }> = {
  1: {
    highlight:
      "Mayor reserva de carbono azul del Atlántico y borde urbano de mayor presión junto a Barranquilla.",
    focusTag: "70,659 tC · Presión urbana",
  },
  2: {
    highlight:
      "Corredor estuarino clave para pesca artesanal, amortiguación de oleaje y reconexión de caños.",
    focusTag: "Restauración hidrológica",
  },
  3: {
    highlight:
      "Sector con mayor estrés hídrico en 2026: anomalía de dosel -0.151 e índice de riesgo 0.436.",
    focusTag: "Prioridad crítica 2026",
  },
  4: {
    highlight:
      "Concentra más de la mitad de las áreas pendientes de verificación en terreno del departamento.",
    focusTag: "451.8 ha por revisar",
  },
};

export function CoastalExplorer() {
  const [activeId, setActiveId] = useState<number>(3);
  const sector = CRA_SECTORS.find((s) => s.id === activeId) ?? CRA_SECTORS[0];
  const meta = SECTOR_CONTEXT[sector.id];

  const co2eTon = Math.round(sector.carbonoTc * CRA_GLOBAL_METRICS.co2eFactor);
  const carEquiv = Math.round(co2eTon / 4.6);
  const dryRatio = Math.min(100, Math.round((sector.doselSecoHa / sector.referenciaHa) * 100));
  const riskPct = Math.min(100, Math.round(sector.riesgoMedio * 100));

  return (
    <section
      id="sectores"
      className="border-t border-white/12 bg-[#041A29] py-20 text-white lg:py-28"
    >
      <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-white/12 pb-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-black leading-[1.02] text-white sm:text-5xl">
              Cuatro sectores costeros bajo observación satelital
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/70">
              Imágenes Sentinel-2 reales de la línea base CRA Atlántico. Selecciona un tramo de costa para consultar su anomalía de dosel 2026, carbono retenido y hectáreas que necesitan verificación ciudadana.
            </p>
          </div>
          <Link
            href="/cra"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-lg border border-white/25 px-5 text-sm font-bold text-white transition hover:border-[#EDB512] hover:text-[#F8D86F]"
          >
            <span>Abrir visor geográfico completo</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Selector vertical de 4 sectores */}
          <div className="flex flex-col divide-y divide-white/10 border-y border-white/10 lg:col-span-5">
            {CRA_SECTORS.map((s) => {
              const active = s.id === sector.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`group flex w-full items-start justify-between gap-4 px-4 py-5 text-left transition ${
                    active ? "bg-[#005F96]/35" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums ${
                          active ? "text-[#F8D86F]" : "text-white/45"
                        }`}
                      >
                        0{s.id}
                      </span>
                      <span className="truncate font-display text-lg font-extrabold text-white">
                        {s.nombre}
                      </span>
                    </div>
                    <p className="mt-1 pl-7 text-xs text-white/65">
                      {s.municipioPrincipal} · {SECTOR_CONTEXT[s.id].focusTag}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-bold tabular-nums text-white">
                      {s.referenciaHa} ha
                    </span>
                    <span
                      className={`mt-0.5 block font-mono text-[11px] tabular-nums ${
                        s.anomaliaDosel <= -0.1 ? "text-[#FCA5A5]" : "text-[#F8D86F]"
                      }`}
                    >
                      {s.porRevisarHa} ha rev.
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Escenario satelital Sentinel-2 real */}
          <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-white/15 bg-[#082438] lg:col-span-7">
            <div className="relative h-[300px] w-full overflow-hidden bg-[#041A29] sm:h-[360px]">
              <img
                key={sector.satImage}
                src={sector.satImage}
                alt={`Imagen satelital Sentinel-2 del sector ${sector.nombre}`}
                className="h-full w-full object-cover transition-opacity duration-500"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#082438] via-[#041A29]/25 to-[#041A29]/35" />

              {/* Esquinas ópticas de telemetría */}
              <span className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-[#EDB512]/80" />
              <span className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-[#EDB512]/80" />
              <span className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-white/40" />
              <span className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-white/40" />

              {/* Coordenadas reales y fuente */}
              <div className="absolute left-5 right-5 top-5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold text-white/90">
                <span className="inline-flex items-center gap-1.5 rounded bg-[#041A29]/80 px-2.5 py-1 backdrop-blur-sm">
                  <MapPin className="h-3.5 w-3.5 text-[#F8D86F]" />
                  {sector.centroidLat.toFixed(4)}° N, {Math.abs(sector.centroidLon).toFixed(4)}° O
                </span>
                <span className="rounded bg-[#041A29]/80 px-2.5 py-1 text-[#F8D86F] backdrop-blur-sm">
                  Sentinel-2 · CRA Atlántico
                </span>
              </div>

              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="font-display text-2xl font-black text-white sm:text-3xl">
                  {sector.nombre}
                </h3>
                <p className="mt-1 max-w-xl text-sm text-white/85">{meta.highlight}</p>
              </div>
            </div>

            {/* Datos duros + barras de riesgo y dosel seco */}
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-2 gap-4 border-b border-white/12 pb-5 sm:grid-cols-4">
                <div>
                  <span className="block text-xs text-white/60">Manglar probable</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-white">
                    {sector.referenciaHa} <span className="text-xs font-bold text-white/60">ha</span>
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-white/60">Por revisar en campo</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-[#F8D86F]">
                    {sector.porRevisarHa} <span className="text-xs font-bold text-[#F8D86F]/70">ha</span>
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-white/60">Dosel seco 2026</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-[#FCA5A5]">
                    {sector.doselSecoHa} <span className="text-xs font-bold text-[#FCA5A5]/70">ha</span>
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-white/60">Anomalía hídrica</span>
                  <span className="mt-1 block font-mono text-2xl font-bold tabular-nums text-white">
                    {sector.anomaliaDosel}
                  </span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white/75">Proporción de dosel afectado</span>
                    <span className="font-mono tabular-nums text-[#FCA5A5]">{dryRatio}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-white/12">
                    <div
                      className="h-full bg-[#C84023] transition-all duration-500"
                      style={{ width: `${dryRatio}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white/75">Índice compuesto de riesgo CRA</span>
                    <span className="font-mono tabular-nums text-[#F8D86F]">
                      {sector.riesgoMedio} / 1.0
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-white/12">
                    <div
                      className="h-full bg-[#EDB512] transition-all duration-500"
                      style={{ width: `${riskPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/12 pt-5">
                <p className="text-xs leading-relaxed text-white/75">
                  Reserva estimada:{" "}
                  <strong className="text-white tabular-nums">
                    {sector.carbonoTc.toLocaleString("es-CO")} t C
                  </strong>{" "}
                  ({co2eTon.toLocaleString("es-CO")} t CO₂e · equivale a retirar{" "}
                  <strong className="text-[#F8D86F] tabular-nums">
                    {carEquiv.toLocaleString("es-CO")} vehículos
                  </strong>{" "}
                  durante un año).
                </p>

                <Link
                  href="/reportar"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#EDB512] px-4 text-xs font-black text-[#041A29] transition hover:bg-[#F8D86F]"
                >
                  <Camera className="h-4 w-4" />
                  Reportar en este sector
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
