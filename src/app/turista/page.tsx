"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowRight,
  Award,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Lock,
  MapPin,
  Navigation,
  Smartphone,
} from "lucide-react";
import { QR_STATIONS } from "@/lib/cra-domain";
import {
  TRAIL_STATIONS,
  getExplorerRank,
  readPassport,
  type ExplorerPassportState,
} from "@/lib/explorer-passport";

const SHORT_NFC_CODE: Record<string, string> = {
  "mallorquin-sendero-1": "1",
  "puerto-velero-muelle": "2",
  "juan-acosta-estuario": "3",
  "totumo-astilleros": "4",
};

export default function TuristaPage() {
  const [selectedId, setSelectedId] = useState(QR_STATIONS[2].id);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [nfcMsg, setNfcMsg] = useState<string | null>(null);
  const [nfcWriting, setNfcWriting] = useState(false);
  const [passport, setPassport] = useState<ExplorerPassportState>({
    visited: {},
    checkedChallenges: [],
  });

  useEffect(() => {
    setPassport(readPassport());
  }, []);

  const visitedCount = Object.keys(passport.visited).length;
  const rank = getExplorerRank(visitedCount);

  const station = QR_STATIONS.find((s) => s.id === selectedId) ?? QR_STATIONS[0];
  const shortCode = SHORT_NFC_CODE[station.id] || "1";
  const shortNfcUrl = `https://manglar.arpadura.com/p/${shortCode}`;

  useEffect(() => {
    QRCode.toDataURL(shortNfcUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#041A29", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [shortNfcUrl]);

  const handleCopyNfc = () => {
    navigator.clipboard?.writeText(shortNfcUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  const handleWriteWebNfc = async () => {
    const w = window as unknown as {
      NDEFReader?: new () => {
        write: (msg: { records: Array<{ recordType: string; data: string }> }) => Promise<void>;
      };
    };

    if (!w.NDEFReader) {
      setNfcMsg(
        "Web NFC directo está disponible en Chrome para Android. En iPhone o PC copia el enlace corto y grábalo con la app gratuita NFC Tools (Escribir → Añadir registro → URL)."
      );
      return;
    }

    setNfcWriting(true);
    setNfcMsg("Acerca el sticker o tarjeta NFC a la parte trasera del celular...");
    try {
      const ndef = new w.NDEFReader();
      await ndef.write({
        records: [{ recordType: "url", data: shortNfcUrl }],
      });
      setNfcMsg(`¡Listo! Chip NFC grabado con ${shortNfcUrl}. Acércalo a cualquier celular para probar.`);
    } catch (err) {
      setNfcMsg(
        err instanceof Error
          ? `No se pudo grabar el NFC: ${err.message}`
          : "Operación cancelada o sin permiso NFC."
      );
    } finally {
      setNfcWriting(false);
    }
  };

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
              Estaciones NFC y QR en senderos del Atlántico
            </h1>
            <p className="text-base leading-relaxed text-white/75">
              Los tags NFC en PVC resisten sol, lluvia y salinidad sin baterías. Al acercar el celular (o escanear el QR de respaldo), el visitante entra directo a reportar con la ubicación exacta del muelle o sendero ya precargada.
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
              href={`/p/${shortCode}`}
              className="inline-flex min-h-[50px] items-center gap-2.5 rounded-lg bg-[#EDB512] px-6 text-sm font-black text-[#041A29] transition hover:bg-[#F8D86F]"
            >
              <Camera className="h-4 w-4" />
              <span>Simular toque NFC en esta estación</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Ficha educativa + Configurador NFC/QR */}
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

          {/* Bloque de programación de chip NFC físico */}
          <div className="rounded-xl border border-[#005F96]/25 bg-[#EDF2F6]/75 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-black text-[#041A29]">
                <Smartphone className="h-4 w-4 text-[#005F96]" />
                Enlace ultracorto para chip NFC (32 caracteres · NTAG213/215/216)
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 rounded-lg border border-[#041A29]/15 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-[#005F96]">
                {shortNfcUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyNfc}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#041A29] px-4 text-xs font-black text-white transition hover:bg-[#005F96]"
              >
                {copiedUrl ? <Check className="h-4 w-4 text-[#86EFAC]" /> : <Copy className="h-4 w-4 text-[#F8D86F]" />}
                {copiedUrl ? "Copiado" : "Copiar URL"}
              </button>
              <button
                type="button"
                disabled={nfcWriting}
                onClick={handleWriteWebNfc}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#005F96] px-4 text-xs font-black text-white transition hover:bg-[#041A29] disabled:opacity-60"
              >
                <Smartphone className="h-4 w-4 text-[#F8D86F]" />
                {nfcWriting ? "Acerca el chip..." : "Grabar NFC (Android)"}
              </button>
            </div>

            {nfcMsg && (
              <p className="mt-2.5 text-xs font-bold text-[#005F96]" role="status">
                {nfcMsg}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-[#041A29]/12 bg-white p-6 text-center sm:p-8 md:col-span-5">
          <h3 className="font-display text-lg font-black text-[#041A29]">
            Código QR de respaldo (misma URL corta)
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
            Funciona igual en iPhone y Android si el visitante prefiere cámara. Precarga coordenadas exactas en{" "}
            <strong className="text-[#041A29]">{station.municipio}</strong>.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#005F96]">
            <MapPin className="h-3.5 w-3.5" />
            {station.lat}, {station.lon}
          </p>
        </div>
      </div>

      {/* PASAPORTE COSTERO DEL ATLÁNTICO (GAMIFICACIÓN DE EXPLORACIÓN) */}
      <section className="mx-auto max-w-[1440px] px-5 pb-14 lg:px-10">
        <div className="overflow-hidden rounded-2xl border border-[#041A29]/12 bg-[#041A29] text-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/12 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EDB512] text-[#041A29]">
                <Award className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-black text-white">
                  Pasaporte Costero del Manglar ({visitedCount}/4 sellos)
                </h2>
                <p className="text-xs text-[#F8D86F]">
                  Rango actual: {rank.title} · {rank.nextGoal}
                </p>
              </div>
            </div>
            <span className="rounded-lg border border-white/15 bg-[#082438] px-3.5 py-2 font-mono text-xs font-black text-[#86EFAC]">
              {passport.checkedChallenges.length}/12 hallazgos de campo
            </span>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 sm:p-8">
            {TRAIL_STATIONS.map((stop) => {
              const unlocked = Boolean(passport.visited[stop.shortCode]);
              return (
                <div
                  key={stop.stationId}
                  className={`flex flex-col justify-between overflow-hidden rounded-xl border ${
                    unlocked
                      ? "border-[#22C55E]/50 bg-[#082438]"
                      : "border-white/12 bg-[#082438]/75"
                  }`}
                >
                  <div className="relative h-32 w-full overflow-hidden bg-[#041A29]">
                    <img
                      src={stop.heroPhoto}
                      alt={stop.shortName}
                      className={`h-full w-full object-cover ${
                        unlocked ? "" : "opacity-65 grayscale-[30%]"
                      }`}
                    />
                    <span
                      className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-black ${
                        unlocked
                          ? "bg-[#16794A] text-white"
                          : "bg-[#041A29]/85 text-white/80"
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          SELLO 0{stop.shortCode}
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          PUNTO 0{stop.shortCode}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="font-display text-base font-black text-white">
                        {stop.shortName}
                      </p>
                      <p className="text-xs font-bold text-[#F8D86F]">{stop.badgeTitle}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                        {stop.teaser}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/p/${stop.shortCode}`}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#EDB512] px-3 text-xs font-black text-[#041A29] transition hover:bg-[#F8D86F]"
                      >
                        Explorar punto
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-white/20 px-3 text-xs font-black text-[#F8D86F] transition hover:border-[#EDB512]"
                        aria-label={`Cómo llegar a ${stop.shortName}`}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
