"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Camera, Compass, ShieldAlert, Sparkles } from "lucide-react";
import { QR_STATIONS } from "@/lib/cra-domain";
import { MascotaCangrejo } from "@/components/MascotaCangrejo";

export default function TuristaPage() {
  const [selectedId, setSelectedId] = useState(QR_STATIONS[0].id);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const station = QR_STATIONS.find((s) => s.id === selectedId) ?? QR_STATIONS[0];

  const stationUrl = `https://manglar-vivo-atlantico.vercel.app/reportar?perfil=turista&estacion=${station.id}`;

  useEffect(() => {
    QRCode.toDataURL(stationUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#08334C", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [stationUrl]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4">
      <div className="bezel-outer">
        <div className="bezel-inner grid items-center gap-6 overflow-hidden p-6 sm:p-9 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <img
              src="/images/turista-qr-sendero.png"
              alt="Sendero turístico sobre el manglar del Atlántico"
              className="h-72 w-full rounded-3xl object-cover shadow-lg sm:h-80"
            />
          </div>

          <div className="space-y-4 lg:col-span-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDB512]/25 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#08334C]">
              <Compass className="h-4 w-4 text-[#005F96]" />
              Pasaporte Eco-Turístico QR · Sin registro
            </span>

            <h1 className="font-display text-3xl font-black text-[#08334C] sm:text-4xl">
              Escanea en el sendero y protege el Caribe
            </h1>

            <p className="text-sm leading-relaxed text-[#08334C]/80">
              En cada muelle o sendero turístico hay un código QR como este. Sin crear cuenta, cualquier visitante aprende qué hace único ese manglar y puede reportar basura, tala o fauna en menos de 60 segundos.
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                Selecciona una estación eco-turística
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm font-bold text-[#08334C]"
              >
                {QR_STATIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.municipio})
                  </option>
                ))}
              </select>
            </div>

            <Link
              href={`/reportar?perfil=turista&estacion=${station.id}`}
              className="inline-flex min-h-[50px] items-center gap-2.5 rounded-full bg-[#005F96] px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-[#005F96]/20 hover:bg-[#08334C]"
            >
              <Camera className="h-4 w-4 text-[#F8D86F]" />
              Reportar desde esta estación ahora
            </Link>
          </div>
        </div>
      </div>

      {/* Ficha educativa + QR real escaneable */}
      <div className="mt-6 grid gap-5 md:grid-cols-12">
        <div className="bezel-outer md:col-span-7">
          <div className="bezel-inner flex h-full flex-col justify-between gap-4 p-6">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
                <Sparkles className="h-3.5 w-3.5" /> Descubre este lugar en 30 segundos
              </p>
              <h2 className="font-display mt-1 text-2xl font-bold text-[#08334C]">
                {station.nombre}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#08334C]/80">
                {station.datoClave}
              </p>
              <p className="mt-3 rounded-2xl bg-[#F7F3EA] p-3.5 text-xs font-bold text-[#08334C]">
                Especies que puedes observar aquí: {station.especies}
              </p>
            </div>

            <MascotaCangrejo
              size="sm"
              title="Tip de Mangle para visitantes"
              message="¡Nunca dejes plásticos en la raíz del mangle y toma fotos sin molestar a las aves!"
            />
          </div>
        </div>

        <div className="bezel-outer md:col-span-5">
          <div className="bezel-inner flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#005F96]">
              Código QR real de la estación
            </p>
            <div className="mt-3 rounded-3xl border border-[#08334C]/12 bg-white p-3 shadow-sm">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR para ${station.nombre}`}
                  className="h-40 w-40"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center text-xs font-bold text-[#08334C]/50">
                  Generando QR...
                </div>
              )}
            </div>
            <p className="mt-3 text-xs font-bold text-[#08334C]">
              Escanea con tu celular para abrir el reporte directo en {station.municipio}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#D94E2A]">
              <ShieldAlert className="h-3.5 w-3.5" />
              {station.lat}, {station.lon}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
