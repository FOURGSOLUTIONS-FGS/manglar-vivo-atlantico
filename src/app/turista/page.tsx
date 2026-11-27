"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, Camera, MapPin } from "lucide-react";
import { QR_STATIONS } from "@/lib/cra-domain";

export default function TuristaPage() {
  const [selectedId, setSelectedId] = useState(QR_STATIONS[0].id);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const station = QR_STATIONS.find((s) => s.id === selectedId) ?? QR_STATIONS[0];

  const stationUrl = `https://manglar-vivo-atlantico.vercel.app/reportar?perfil=turista&estacion=${station.id}`;

  useEffect(() => {
    QRCode.toDataURL(stationUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#041A29", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [stationUrl]);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#EDF2F6]">
      {/* Cabecera fotográfica costera */}
      <section className="border-b border-white/12 bg-[#041A29] text-white">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-10 lg:grid-cols-12 lg:px-10 lg:py-14">
          <div className="overflow-hidden rounded-xl border border-white/12 lg:col-span-6">
            <img
              src="/images/turista-qr-sendero.png"
              alt="Sendero elevado turístico en manglar del Atlántico"
              className="h-[300px] w-full object-cover sm:h-[360px]"
            />
          </div>

          <div className="space-y-5 lg:col-span-6">
            <h1 className="font-display text-3xl font-black leading-[1.03] text-white sm:text-5xl">
              Estaciones QR para visitantes del Caribe
            </h1>
            <p className="text-base leading-relaxed text-white/75">
              En muelles y senderos turísticos instalamos puntos QR sin fricción: cualquier visitante conoce en 30 segundos el ecosistema que está recorriendo y reporta residuos, tala o avistamientos sin crear cuentas.
            </p>

            <div>
              <label
                htmlFor="station-select"
                className="mb-1.5 block text-xs font-bold text-[#F8D86F]"
              >
                Estación eco-turística activa
              </label>
              <select
                id="station-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="min-h-[48px] w-full rounded-lg border border-white/20 bg-[#082438] px-3.5 text-sm font-bold text-white"
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
              className="inline-flex min-h-[50px] items-center gap-2.5 rounded-lg bg-[#EDB512] px-6 text-sm font-black text-[#041A29] transition hover:bg-[#F8D86F]"
            >
              <Camera className="h-4 w-4" />
              <span>Reportar desde esta estación ahora</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Ficha educativa + QR real imprimible */}
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-10 md:grid-cols-12 lg:px-10">
        <div className="flex flex-col justify-between space-y-6 rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8 md:col-span-7">
          <div>
            <h2 className="font-display text-2xl font-black text-[#041A29] sm:text-3xl">
              {station.nombre}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#041A29]/80">
              {station.datoClave}
            </p>
            <div className="mt-5 rounded-lg border border-[#041A29]/12 bg-[#EDF2F6] p-4 text-sm">
              <p className="font-black text-[#005F96]">Especies observables en este tramo</p>
              <p className="mt-1 text-[#041A29]/85">{station.especies}</p>
            </div>
          </div>

          <div className="border-t border-[#041A29]/10 pt-4 text-xs leading-relaxed text-[#041A29]/70">
            <strong className="text-[#041A29]">Buenas prácticas de visita:</strong> conserva tus residuos hasta el punto limpio, no alteres raíces ni madrigueras de cangrejo azul y fotografía la fauna sin perseguirla.
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-[#041A29]/12 bg-white p-6 text-center sm:p-8 md:col-span-5">
          <h3 className="font-display text-lg font-black text-[#041A29]">
            Código QR escaneable de la estación
          </h3>
          <div className="mt-4 rounded-xl border border-[#041A29]/15 bg-white p-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Código QR para ${station.nombre}`}
                className="h-44 w-44"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center text-xs font-bold text-[#041A29]/50">
                Generando QR...
              </div>
            )}
          </div>
          <p className="mt-4 max-w-xs text-xs leading-relaxed text-[#041A29]/75">
            Abre el formulario de reporte precargado con las coordenadas y el perfil visitante en{" "}
            <strong className="text-[#041A29]">{station.municipio}</strong>.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#005F96]">
            <MapPin className="h-3.5 w-3.5" />
            {station.lat}, {station.lon}
          </p>
        </div>
      </div>
    </div>
  );
}
