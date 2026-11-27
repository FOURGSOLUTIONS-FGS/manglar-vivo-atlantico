"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Droplets, MapPin, ShieldAlert, Trees } from "lucide-react";
import { CRA_SECTORS } from "@/lib/cra-domain";
import { MascotaCangrejo } from "./MascotaCangrejo";

const SECTOR_STORY: Record<number, { highlight: string; mission: string; crabTip: string }> = {
  1: {
    highlight: "Mayor reserva de carbono azul del Atlántico (70,659 tC) y mayor presión urbana.",
    mission: "Vigilar bordes de la Ciénaga de Mallorquín contra basuras y rellenos.",
    crabTip: "¡Aquí guardamos más carbono que nadie! Cada foto en el sendero ayuda a proteger este tesoro.",
  },
  2: {
    highlight: "Ecosistema estuarino de Puerto Velero y Balboa conectado con pescadores y turistas.",
    mission: "Reportar taponamientos de caños y revisar 105.8 hectáreas en terreno.",
    crabTip: "Si vienes de paseo a Puerto Velero, en 30 segundos puedes cuidar el agua donde crecen los peces.",
  },
  3: {
    highlight: "Foco crítico 2026: registró la mayor sequía de dosel (-0.151) y mayor riesgo (0.436).",
    mission: "Prioridad urgente junto a escuelas de Juan de Acosta y Tubará.",
    crabTip: "¡Alerta amarilla! Aquí los árboles tuvieron mucha sed con El Niño. Necesitamos ojos en campo ya.",
  },
  4: {
    highlight: "Concentra 451.8 ha por revisar: más de la mitad de las hectáreas sin verificar del departamento.",
    mission: "Sumar etiquetas ciudadanas entre El Totumo, Astilleros y Galerazamba.",
    crabTip: "Este es el reto gigante: ¡451 hectáreas esperando que estudiantes y vecinos confirmen su estado!",
  },
};

export function CoastalExplorer() {
  const [activeId, setActiveId] = useState<number>(3);
  const sector = CRA_SECTORS.find((s) => s.id === activeId) ?? CRA_SECTORS[0];
  const story = SECTOR_STORY[sector.id];
  const co2e = Math.round(sector.carbonoTc * 3.667);
  const equivAutos = Math.round(co2e / 4.6);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#005F96]">
            Explorador territorial interactivo · Datos reales CRA 2026
          </p>
          <h2 className="font-display mt-1 text-3xl font-black text-[#08334C] sm:text-4xl">
            Toca un manglar y descubre su misión hoy
          </h2>
        </div>
        <span className="rounded-full bg-[#08334C]/6 px-3.5 py-1.5 text-xs font-bold text-[#08334C]/75">
          4 sectores costeros · 524 puntos ground-truth
        </span>
      </div>

      {/* Selector táctil de los 4 sectores */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {CRA_SECTORS.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`group rounded-2xl border p-4 text-left transition-all duration-300 ease-coastal ${
                active
                  ? "border-[#005F96] bg-[#005F96] text-white shadow-lg shadow-[#005F96]/25"
                  : "border-[#08334C]/12 bg-white/90 text-[#08334C] hover:border-[#005F96]/50 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span className={active ? "text-[#F8D86F]" : "text-[#005F96]"}>
                  Sector {s.id}
                </span>
                <span className="tabular-nums opacity-80">{s.referenciaHa} ha</span>
              </div>
              <p className="font-display mt-1 text-base font-bold leading-tight">
                {s.nombre.split(" – ")[0]}
              </p>
              <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-[#08334C]/65"}`}>
                {s.municipioPrincipal}
              </p>
            </button>
          );
        })}
      </div>

      {/* Escenario detallado del sector elegido */}
      <div className="bezel-outer">
        <div className="bezel-inner grid gap-6 p-6 sm:p-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between space-y-5 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EDB512]/25 px-3 py-1 text-xs font-black text-[#08334C]">
                  {sector.nombre}
                </span>
                {sector.id === 3 && (
                  <span className="rounded-full bg-[#D94E2A] px-3 py-1 text-xs font-black text-white">
                    Alerta prioritaria 2026
                  </span>
                )}
              </div>

              <h3 className="font-display mt-3 text-2xl font-black text-[#08334C] sm:text-3xl">
                {story.highlight}
              </h3>
              <p className="mt-2 text-sm text-[#08334C]/75">
                <strong>Misión ciudadana:</strong> {story.mission}
              </p>
            </div>

            {/* Medidores animados en lenguaje humano */}
            <div className="space-y-3 rounded-2xl bg-[#F7F3EA] p-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#D94E2A]" />
                    Índice de riesgo ambiental
                  </span>
                  <span className="tabular-nums font-black text-[#D94E2A]">
                    {Math.round(sector.riesgoMedio * 100)}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#D94E2A] transition-all duration-700 ease-coastal"
                    style={{ width: `${Math.min(100, sector.riesgoMedio * 160)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-[#005F96]" />
                    Dosel seco en 2026
                  </span>
                  <span className="tabular-nums font-black text-[#005F96]">
                    {sector.doselSecoHa} ha (anomalía {sector.anomaliaDosel})
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#EDB512] transition-all duration-700 ease-coastal"
                    style={{
                      width: `${Math.min(100, Math.round((sector.doselSecoHa / sector.referenciaHa) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#1F7A4C]" />
                    Hectáreas por verificar en campo
                  </span>
                  <span className="tabular-nums font-black text-[#1F7A4C]">
                    {sector.porRevisarHa} ha
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#1F7A4C] transition-all duration-700 ease-coastal"
                    style={{ width: `${Math.min(100, Math.round((sector.porRevisarHa / 460) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reportar"
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#005F96] px-5 py-2 text-xs font-black text-white transition hover:bg-[#08334C]"
              >
                <Trees className="h-4 w-4 text-[#F8D86F]" />
                Reportar en este sector
              </Link>
              <Link
                href="/cra"
                className="inline-flex min-h-[46px] items-center gap-1.5 rounded-full border border-[#08334C]/15 bg-white px-5 py-2 text-xs font-black text-[#08334C] hover:border-[#005F96]"
              >
                Ver mapa satelital
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-br from-[#005F96]/8 via-[#F7F3EA] to-[#1F7A4C]/10 p-5 lg:col-span-5">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
                Carbono azul protegido aquí
              </p>
              <p className="tabular-nums font-display mt-1 text-3xl font-black text-[#08334C]">
                {co2e.toLocaleString("es-CO")} t CO₂e
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#08334C]/75">
                Equivale aproximadamente a sacar de circulación{" "}
                <strong>{equivAutos.toLocaleString("es-CO")} carros durante un año</strong>{" "}
                ({sector.carbonoTcHa} tC/ha).
              </p>
            </div>

            <MascotaCangrejo
              size="md"
              title="Mangle · Dato del sector"
              message={story.crabTip}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
