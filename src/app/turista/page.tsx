"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Compass, QrCode, ShieldAlert } from "lucide-react";
import { QR_STATIONS } from "@/lib/cra-domain";

export default function TuristaPage() {
  const [selectedId, setSelectedId] = useState(QR_STATIONS[0].id);
  const station = QR_STATIONS.find((s) => s.id === selectedId) ?? QR_STATIONS[0];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:pt-8">
      <div className="bezel-outer">
        <div className="bezel-inner grid items-center gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <img
              src="/images/turista-qr-sendero.png"
              alt="Sendero de madera en manglar del Atlántico"
              className="h-64 w-full rounded-2xl object-cover shadow-md sm:h-72"
            />
          </div>
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDB512]/25 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#08334C]">
              <Compass className="h-4 w-4 text-[#005F96]" />
              Modo Turistas QR · Sin registro
            </span>
            <h1 className="font-display mt-3 text-3xl font-black text-[#08334C]">
              Escanea, aprende en 30 s y protege el sendero
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[#08334C]/80">
              Si estás recorriendo Mallorquín, Puerto Velero, Juan de Acosta o El Totumo y ves basura, tala o fauna en peligro, envía una foto geolocalizada en menos de un minuto sin crear cuenta.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                Estación QR del sendero
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm font-bold text-[#08334C]"
              >
                {QR_STATIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.municipio})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/reportar?perfil=turista&estacion=${station.id}`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#005F96] px-6 py-2.5 text-sm font-black text-white hover:bg-[#08334C]"
              >
                <Camera className="h-4 w-4 text-[#F8D86F]" />
                Reportar desde esta estación
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Ficha educativa + Simulación QR */}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="bezel-outer">
          <div className="bezel-inner p-6">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
              Ficha educativa de la estación
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-[#08334C]">
              {station.nombre}
            </h2>
            <p className="mt-2 text-sm text-[#08334C]/80">{station.datoClave}</p>
            <p className="mt-3 rounded-xl bg-[#F7F3EA] p-3 text-xs font-bold text-[#08334C]">
              Especies clave aquí: {station.especies}
            </p>
          </div>
        </div>

        <div className="bezel-outer">
          <div className="bezel-inner flex items-center gap-4 p-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#005F96] text-white">
              <QrCode className="h-11 w-11 text-[#F8D86F]" strokeWidth={1.5} />
            </div>
            <div className="text-xs">
              <p className="font-black uppercase tracking-wider text-[#005F96]">
                Enlace directo de señalización QR
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-[#08334C]/80">
                /reportar?perfil=turista&amp;estacion={station.id}
              </p>
              <p className="mt-2 inline-flex items-center gap-1 font-bold text-[#D94E2A]">
                <ShieldAlert className="h-3.5 w-3.5" />
                Coordenadas de estación: {station.lat}, {station.lon}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
