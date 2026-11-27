"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Headphones,
  Lock,
  MapPin,
  Navigation,
  Radio,
  Satellite,
  Sparkles,
  Square,
  Trees,
  Volume2,
} from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import {
  CRA_GLOBAL_METRICS,
  FACTOR_DOMAINS,
  type CraSectorInfo,
} from "@/lib/cra-domain";
import {
  TRAIL_STATIONS,
  distanceKm,
  getExplorerRank,
  stampStationInPassport,
  togglePassportChallenge,
  type ExplorerPassportState,
} from "@/lib/explorer-passport";

export interface StationMeta {
  id: string;
  shortCode: string;
  nombre: string;
  municipio: string;
  sectorId: number;
  lat: number;
  lon: number;
  datoClave: string;
  especies: string;
  heroPhoto: string;
  audioSrc: string;
  fieldPhotos: Array<{ src: string; caption: string }>;
  urgencyNote: string;
  audioScript: string;
}

export interface SectorRecentReport {
  id: string;
  tracking_code: string;
  descripcion_ciudadana: string;
  evidencia_foto_url: string | null;
  puntaje_confiabilidad: number;
  estado_validacion: string;
  timestamp_captura: string;
}

interface Props {
  station: StationMeta;
  sector: CraSectorInfo;
  recentReports: SectorRecentReport[];
  totalSectorReports: number;
}

const ATLANTICO_FOUR_SPECIES = [
  {
    common: "Mangle rojo",
    scientific: "Rhizophora mangle",
    clue: "Raíces zancudas en arco sobre el agua salobre y propágulos alargados.",
    habitat: "Bordes inundados y canales de intercambio hídrico.",
  },
  {
    common: "Mangle negro / salado",
    scientific: "Avicennia germinans",
    clue: "Neumatóforos (pequeñas raíces verticales saliendo del lodo) y hojas con envés claro.",
    habitat: "Alta tolerancia a salinidad y zonas intermareales.",
  },
  {
    common: "Mangle blanco / amarillo",
    scientific: "Laguncularia racemosa",
    clue: "Hojas opuestas ovaladas con dos pequeñas glándulas cerca del pecíolo.",
    habitat: "Zonas de transición y regeneración natural.",
  },
  {
    common: "Mangle botón / zaragoza",
    scientific: "Conocarpus erectus",
    clue: "Frutos agrupados en forma de botón y hojas alternas.",
    habitat: "Franjas más terrestres del borde del manglar.",
  },
];

const IOT_VARIABLES_SPEC = [
  { key: "conductividad_us_cm", label: "Conductividad", unit: "µS/cm", desc: "Concentración iónica" },
  { key: "salinidad_psu", label: "Salinidad", unit: "PSU", desc: "Condición estuarina" },
  { key: "temperatura_c", label: "Temperatura", unit: "°C", desc: "Régimen térmico" },
  { key: "ph", label: "pH", unit: "pH", desc: "Balance ácido-base" },
  { key: "nivel_agua_m", label: "Nivel de agua", unit: "m", desc: "Inundación / marea" },
] as const;

export function NfcStationExperience({
  station,
  sector,
  recentReports,
  totalSectorReports,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [viewMode, setViewMode] = useState<"terreno" | "satelite" | "mapa">("terreno");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioCurrentSec, setAudioCurrentSec] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(24);
  const [showTranscript, setShowTranscript] = useState(false);
  const [passport, setPassport] = useState<ExplorerPassportState>({
    visited: {},
    checkedChallenges: [],
  });
  const [justUnlockedStamp, setJustUnlockedStamp] = useState(false);
  const [iotStation, setIotStation] = useState<{
    nombre: string;
    operador: string;
    estado: "en_vivo" | "ultima_disponible" | "inactiva_lista_api";
    ultimaLecturaAt: string | null;
    notaRigurosa: string;
    variables: Record<string, number | null>;
  } | null>(null);

  const normalizedCode = station.shortCode.replace(/^0+/, "");
  const currentTrail =
    TRAIL_STATIONS.find((t) => t.shortCode === normalizedCode) ?? TRAIL_STATIONS[2];

  useEffect(() => {
    const { state, justUnlocked } = stampStationInPassport(station.shortCode);
    setPassport(state);
    setJustUnlockedStamp(justUnlocked);
    fetch(`/api/telemetry?station_id=${encodeURIComponent(station.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.station) setIotStation(d.station);
      })
      .catch(() => {});
  }, [station.shortCode, station.id]);

  const handleToggleChallenge = (challengeId: string) => {
    setPassport(togglePassportChallenge(challengeId));
  };

  const visitedCount = Object.keys(passport.visited).length;
  const rank = getExplorerRank(visitedCount);
  const completedHereCount = currentTrail.challenges.filter((c) =>
    passport.checkedChallenges.includes(c.id)
  ).length;

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const formatAudioTime = (sec: number) => {
    const safe = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const playBrowserFallback = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setShowTranscript(true);
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(station.audioScript);
    utterance.lang = "es-CO";
    utterance.rate = 0.96;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toggleAudioGuide = async () => {
    const el = audioRef.current;
    if (isSpeaking) {
      if (el) {
        el.pause();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    if (el) {
      try {
        if (el.ended || (el.duration && el.currentTime >= el.duration - 0.3)) {
          el.currentTime = 0;
        }
        await el.play();
        setIsSpeaking(true);
        return;
      } catch {
        // fallback graceful si el audio falla o el navegador bloquea el MP3
      }
    }
    playBrowserFallback();
  };

  const audioProgressPct =
    audioDurationSec > 0
      ? Math.min(100, Math.round((audioCurrentSec / audioDurationSec) * 100))
      : 0;

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      gsap.from("[data-nfc-in]", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
      });
    },
    { scope: rootRef }
  );

  const co2e = Math.round(sector.carbonoTc * CRA_GLOBAL_METRICS.co2eFactor);
  const minimapSrc = `/api/minimap?lat=${station.lat}&lon=${station.lon}&label=${encodeURIComponent(
    `${station.municipio} · ${sector.nombre.split(" – ")[0]}`
  )}&color=EDB512&zoom=15`;

  const reportBaseHref = `/reportar?perfil=turista&estacion=${encodeURIComponent(
    station.id
  )}&origen=nfc`;

  const stageImageSrc =
    viewMode === "terreno"
      ? station.heroPhoto
      : viewMode === "satelite"
      ? sector.satImage
      : minimapSrc;

  return (
    <div ref={rootRef} className="min-h-screen bg-[#041A29] pb-28 text-white">
      {/* ESCENARIO INMERSIVO DE ESTACIÓN NFC */}
      <section className="relative overflow-hidden border-b border-white/12">
        <div className="relative h-[68svh] min-h-[470px] w-full overflow-hidden bg-[#041A29] sm:h-[74svh]">
          <img
            key={stageImageSrc}
            src={stageImageSrc}
            alt={station.nombre}
            className="h-full w-full object-cover transition-opacity duration-500"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041A29] via-[#041A29]/45 to-[#041A29]/60" />

          {/* Esquinas ópticas de estación costera */}
          <span className="pointer-events-none absolute left-4 top-[84px] h-5 w-5 border-l-2 border-t-2 border-[#EDB512]/80" />
          <span className="pointer-events-none absolute right-4 top-[84px] h-5 w-5 border-r-2 border-t-2 border-[#EDB512]/80" />

          {/* Barra superior de telemetría NFC + selector visual (Terreno / Satélite / Punto exacto) */}
          <div className="absolute left-4 right-4 top-[84px] z-10 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-[#16794A]/70 bg-[#041A29]/85 px-3 py-1.5 text-xs font-black text-[#86EFAC] backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="live-pulse absolute inline-flex h-full w-full rounded-full bg-[#22C55E]" />
                <Radio className="relative h-2.5 w-2.5 text-[#22C55E]" />
              </span>
              PUNTO NFC #{station.shortCode} · VERIFICADO
            </span>

            <div className="flex overflow-hidden rounded-lg border border-white/20 bg-[#041A29]/85 p-1 text-[11px] font-bold backdrop-blur-md">
              {[
                { id: "terreno", label: "Foto lugar", icon: Trees },
                { id: "satelite", label: "Satélite CRA", icon: Satellite },
                { id: "mapa", label: "Tu punto", icon: MapPin },
              ].map((m) => {
                const Icon = m.icon;
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id as typeof viewMode)}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 transition ${
                      active ? "bg-[#EDB512] text-[#041A29]" : "text-white/80 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenido anclado abajo sobre la fotografía del punto */}
          <div className="absolute bottom-0 left-0 right-0 z-10 mx-auto max-w-5xl px-5 pb-7 lg:px-8">
            <div data-nfc-in className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded bg-[#005F96] px-2.5 py-1 text-white">
                <MapPin className="h-3.5 w-3.5 text-[#F8D86F]" />
                {station.municipio} · Sector 0{sector.id}
              </span>
              <span className="rounded bg-[#041A29]/80 px-2.5 py-1 font-mono text-[#F8D86F]">
                {station.lat.toFixed(4)}° N, {Math.abs(station.lon).toFixed(4)}° O
              </span>
            </div>

            <h1
              data-nfc-in
              className="mt-3 max-w-3xl font-display text-3xl font-black leading-[0.98] text-white sm:text-5xl"
            >
              {station.nombre}
            </h1>

            <p data-nfc-in className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              {station.datoClave}
            </p>

            {/* CTA principal inmediato + Audio-Guía en voz alta */}
            <div data-nfc-in className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href={reportBaseHref}
                className="group inline-flex min-h-[54px] flex-1 items-center justify-between gap-3 rounded-xl bg-[#EDB512] px-5 text-sm font-black text-[#041A29] transition hover:bg-[#F8D86F] sm:flex-none sm:px-6 sm:text-base"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Camera className="h-5 w-5" strokeWidth={2.2} />
                  <span>Reportar lo que ves aquí</span>
                </span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <button
                type="button"
                onClick={toggleAudioGuide}
                className={`inline-flex min-h-[54px] items-center gap-2 rounded-xl border px-4 text-xs font-black backdrop-blur-md transition sm:text-sm ${
                  isSpeaking
                    ? "border-[#EDB512] bg-[#005F96] text-white"
                    : "border-white/30 bg-[#041A29]/80 text-white hover:border-[#EDB512]"
                }`}
              >
                {isSpeaking ? (
                  <>
                    <Square className="h-4 w-4 fill-[#F8D86F] text-[#F8D86F]" />
                    <span>Detener audioguía</span>
                  </>
                ) : (
                  <>
                    <Headphones className="h-4 w-4 text-[#F8D86F]" />
                    <span>Escuchar lugar (20 s)</span>
                  </>
                )}
              </button>

              <Link
                href="/cra"
                className="hidden min-h-[54px] items-center gap-2 rounded-xl border border-white/25 bg-[#041A29]/75 px-4 text-xs font-bold text-white backdrop-blur-sm transition hover:border-[#EDB512] sm:inline-flex"
              >
                <Compass className="h-4 w-4 text-[#F8D86F]" />
                Mapa completo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-10 px-5 pt-8 lg:px-8">
        {/* REPRODUCTOR INCLUSIVO DE AUDIO-GUÍA (VOZ NEURAL COLOMBIANA MP3 + OFFLINE + TRANSCRIPCIÓN) */}
        <section
          data-nfc-in
          className="rounded-xl border border-white/14 bg-[#082438] p-5"
        >
          <audio
            ref={audioRef}
            src={station.audioSrc}
            preload="none"
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (Number.isFinite(dur) && dur > 0) setAudioDurationSec(dur);
            }}
            onTimeUpdate={(e) => setAudioCurrentSec(e.currentTarget.currentTime)}
            onEnded={() => {
              setIsSpeaking(false);
              setAudioCurrentSec(0);
            }}
            onPause={() => setIsSpeaking(false)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAudioGuide}
                aria-label={isSpeaking ? "Pausar narración" : "Reproducir audioguía"}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                  isSpeaking
                    ? "bg-[#EDB512] text-[#041A29]"
                    : "bg-[#005F96] text-white hover:bg-[#EDB512] hover:text-[#041A29]"
                }`}
              >
                {isSpeaking ? (
                  <Square className="h-5 w-5 fill-current" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <div>
                <p className="font-display text-base font-black text-white">
                  {isSpeaking
                    ? `Narrando historia de ${station.municipio}...`
                    : `Audioguía del sendero · ${station.municipio}`}
                </p>
                <p className="text-xs text-white/70">
                  Voz natural colombiana · Disponible sin conexión ·{" "}
                  <span className="font-mono text-[#F8D86F]">
                    {formatAudioTime(audioCurrentSec)} / {formatAudioTime(audioDurationSec)}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="min-h-[38px] rounded-lg border border-white/20 px-3 text-xs font-bold text-[#F8D86F] transition hover:bg-white/10"
            >
              {showTranscript ? "Ocultar texto" : "Leer transcripción"}
            </button>
          </div>

          {/* Barra de progreso interactiva */}
          <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-[#EDB512] transition-all duration-150"
              style={{ width: `${audioProgressPct}%` }}
            />
          </div>

          {(showTranscript || isSpeaking) && (
            <p className="mt-4 border-t border-white/12 pt-3.5 text-sm leading-relaxed text-white/85">
              “{station.audioScript}”
            </p>
          )}
        </section>

        {/* MISIÓN DE EXPLORACIÓN EN EL LUGAR + SELLO DEL PASAPORTE */}
        <section
          data-nfc-in
          className="overflow-hidden rounded-xl border border-[#EDB512]/35 bg-[#082438]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 bg-[#041A29]/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDB512] text-[#041A29]">
                <Award className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-base font-black text-white sm:text-lg">
                  {justUnlockedStamp
                    ? `¡Sello #${station.shortCode} desbloqueado! ${currentTrail.badgeTitle}`
                    : `Sello #${station.shortCode} activo · ${currentTrail.badgeTitle}`}
                </p>
                <p className="text-xs text-[#F8D86F]">
                  Pasaporte Costero: {visitedCount}/4 estaciones · Rango: {rank.title}
                </p>
              </div>
            </div>

            <span className="rounded-lg border border-white/15 bg-[#082438] px-3 py-1.5 font-mono text-xs font-black text-[#86EFAC]">
              {completedHereCount}/{currentTrail.challenges.length} hallazgos aquí
            </span>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-black text-white">
                Reto de exploración en {station.municipio}: ¿qué puedes descubrir hoy?
              </h2>
              <span className="text-xs text-white/60">Toca cada pista cuando la encuentres</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {currentTrail.challenges.map((ch) => {
                const done = passport.checkedChallenges.includes(ch.id);
                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                      done
                        ? "border-[#22C55E]/60 bg-[#16794A]/20"
                        : "border-white/12 bg-[#041A29]/65"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChallenge(ch.id)}
                      className="flex w-full items-start gap-2.5 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                          done
                            ? "border-[#22C55E] bg-[#22C55E] text-[#041A29]"
                            : "border-white/35 bg-transparent text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span>
                        <span className="block text-sm font-black leading-snug text-white">
                          {ch.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-white/65">
                          {ch.hint}
                        </span>
                      </span>
                    </button>

                    <Link
                      href={`${reportBaseHref}&dominio=${ch.suggestedDomain}`}
                      className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-[#F8D86F] hover:underline"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Fotografiar esto
                    </Link>
                  </div>
                );
              })}
            </div>

            <p className="flex items-start gap-2 rounded-lg bg-[#041A29]/60 px-3.5 py-2.5 text-xs text-white/80">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#EDB512]" />
              <span>
                <strong className="text-[#F8D86F]">Dato secreto de este tramo:</strong>{" "}
                {currentTrail.secretFact}
              </span>
            </p>
          </div>
        </section>

        {/* ATAJOS DIRECTOS POR FACTOR (1 TOQUE DESDE EL SENDERO) */}
        <section data-nfc-in>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-black text-white sm:text-2xl">
              ¿Qué estás viendo justo ahora? Toca y reporta en 30 segundos
            </h2>
            <span className="text-xs text-white/60">Ubicación precargada · Sin crear cuenta</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FACTOR_DOMAINS.map((dom) => (
              <Link
                key={dom.id}
                href={`${reportBaseHref}&dominio=${dom.id}`}
                className="group flex min-h-[96px] flex-col justify-between rounded-xl border border-white/14 bg-[#082438] p-4 transition hover:border-[#EDB512] hover:bg-[#005F96]/40"
                style={{ borderTopWidth: "3px", borderTopColor: dom.accentHex }}
              >
                <span className="font-display text-base font-black text-white">
                  {dom.shortTitle}
                </span>
                <span className="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-white/70">
                  <span className="line-clamp-2">{dom.subtypes[0].label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#F8D86F] transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* UBICACIÓN SATELITAL EXACTA + ESTADO DEL ECOSISTEMA */}
        <section data-nfc-in className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <h2 className="font-display text-xl font-black text-white">
              Tu ubicación exacta en la franja costera
            </h2>
            <a
              href={`https://www.google.com/maps?q=${station.lat},${station.lon}`}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border border-white/15 transition hover:border-[#EDB512]"
            >
              <img
                src={minimapSrc}
                alt={`Mapa satelital de ${station.nombre}`}
                loading="lazy"
                decoding="async"
                className="h-auto w-full"
              />
            </a>

            {/* Mini galería visual del entorno */}
            <div className="grid grid-cols-2 gap-3">
              {station.fieldPhotos.map((ph) => (
                <figure
                  key={ph.src}
                  className="overflow-hidden rounded-xl border border-white/12 bg-[#082438]"
                >
                  <img
                    src={ph.src}
                    alt={ph.caption}
                    loading="lazy"
                    decoding="async"
                    className="h-32 w-full object-cover"
                  />
                  <figcaption className="px-3 py-2 text-[11px] font-bold text-white/80">
                    {ph.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between space-y-6 rounded-xl border border-white/14 bg-[#082438] p-6 lg:col-span-5">
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-xl font-black text-white">
                  Pulso real de este sector
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#F8D86F]">
                  {station.urgencyNote}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-white/12 py-4">
                <div>
                  <span className="block text-[11px] text-white/60">Manglar probable</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-white">
                    {sector.referenciaHa} ha
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-white/60">Por verificar aquí</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-[#F8D86F]">
                    {sector.porRevisarHa} ha
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-white/60">Carbono guardado</span>
                  <span className="mt-1 block font-display text-xl font-black tabular-nums text-[#86EFAC]">
                    {co2e.toLocaleString("es-CO")} t CO₂e
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-white/60">Reportes ciudadanos</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-white">
                    {totalSectorReports}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-black text-[#F8D86F]">Fauna y flora que habitan este tramo</p>
                <p className="leading-relaxed text-white/80">{station.especies}</p>
              </div>
            </div>

            <Link
              href={reportBaseHref}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#005F96] px-4 text-sm font-black text-white transition hover:bg-[#EDB512] hover:text-[#041A29]"
            >
              <Camera className="h-4 w-4" />
              Tomar foto y enviar evidencia
            </Link>
          </div>
        </section>

        {/* APARTADO CIENTÍFICO FISICOQUÍMICO (ESTACIONES IOT CRA / UNINORTE) */}
        <section
          data-nfc-in
          className="overflow-hidden rounded-xl border border-white/14 bg-[#082438]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-black text-white sm:text-xl">
                Salud del agua en este punto (estación científica)
              </h2>
              <p className="mt-0.5 text-xs text-white/70">
                {iotStation?.operador || "Red CRA · Monitoreo Costero"} — No necesitas saber de ciencia: solo toma tu foto y la plataforma la une con los datos del agua cuando el medidor esté conectado.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] font-black ${
                iotStation?.estado === "en_vivo"
                  ? "bg-[#16794A]/30 text-[#86EFAC]"
                  : "border border-[#EDB512]/45 bg-[#EDB512]/15 text-[#F8D86F]"
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              {iotStation?.estado === "en_vivo"
                ? "MEDIDOR EN VIVO"
                : "MEDIDOR LISTO PARA CONECTAR"}
            </span>
          </div>

          <div className="grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            {IOT_VARIABLES_SPEC.map((v) => {
              const val = iotStation?.variables?.[v.key] ?? null;
              return (
                <div key={v.key} className="p-4">
                  <span className="block text-[11px] font-bold text-white/60">{v.label}</span>
                  <span className="mt-1 block font-display text-2xl font-black tabular-nums text-white">
                    {val != null ? val : "—"}
                    <span className="ml-1 font-mono text-xs font-bold text-[#F8D86F]">
                      {v.unit}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/55">{v.desc}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 bg-[#041A29]/60 px-5 py-3 text-[11px] text-white/70">
            {iotStation?.notaRigurosa ||
              "Sin lectura instrumental conectada en este instante. Los parámetros químicos nunca se inventan ni se estiman desde fotografías."}
          </div>
        </section>

        {/* GUÍA DE BOLSILLO: LAS 4 ESPECIES DE MANGLE DEL ATLÁNTICO */}
        <section data-nfc-in className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-black text-white sm:text-2xl">
              Guía rápida: las 4 especies de mangle del Atlántico
            </h2>
            <span className="text-xs text-white/60">
              Rasgos orientativos · No es obligatorio identificarlas para reportar
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ATLANTICO_FOUR_SPECIES.map((sp) => (
              <div
                key={sp.scientific}
                className="flex flex-col justify-between rounded-xl border border-white/12 bg-[#082438] p-4"
              >
                <div>
                  <p className="font-display text-base font-black text-white">{sp.common}</p>
                  <p className="font-mono text-[11px] italic text-[#F8D86F]">{sp.scientific}</p>
                  <p className="mt-2.5 text-xs leading-relaxed text-white/80">{sp.clue}</p>
                </div>
                <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] text-white/60">
                  {sp.habitat}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* RUTA DE EXPLORACIÓN COSTERO-TURÍSTICA: LOS 4 PUNTOS NFC DEL ATLÁNTICO */}
        <section data-nfc-in className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-black text-white sm:text-2xl">
                Pasaporte del Manglar: explora los 4 puntos del Atlántico
              </h2>
              <p className="mt-1 text-xs text-white/70">
                {rank.nextGoal} Sin crear cuenta — tus sellos se guardan en este celular.
              </p>
            </div>
            <Link href="/turista" className="text-xs font-bold text-[#F8D86F] hover:underline">
              Ver mapa QR/NFC →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRAIL_STATIONS.map((stop) => {
              const isCurrent = stop.shortCode === normalizedCode;
              const isUnlocked = Boolean(passport.visited[stop.shortCode]);
              const km = distanceKm(station.lat, station.lon, stop.lat, stop.lon);
              return (
                <div
                  key={stop.stationId}
                  className={`flex flex-col justify-between overflow-hidden rounded-xl border transition ${
                    isCurrent
                      ? "border-[#EDB512] bg-[#005F96]/35"
                      : isUnlocked
                      ? "border-[#22C55E]/45 bg-[#082438]"
                      : "border-white/12 bg-[#082438]/75"
                  }`}
                >
                  <div className="relative h-28 w-full overflow-hidden bg-[#041A29]">
                    <img
                      src={stop.heroPhoto}
                      alt={stop.shortName}
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-full object-cover ${
                        isUnlocked || isCurrent ? "" : "opacity-65 grayscale-[35%]"
                      }`}
                    />
                    <span
                      className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-black ${
                        isCurrent
                          ? "bg-[#EDB512] text-[#041A29]"
                          : isUnlocked
                          ? "bg-[#16794A] text-white"
                          : "bg-[#041A29]/85 text-white/80"
                      }`}
                    >
                      {isCurrent ? (
                        "ESTÁS AQUÍ"
                      ) : isUnlocked ? (
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
                    {!isCurrent && (
                      <span className="absolute bottom-2 right-2 rounded bg-[#041A29]/85 px-2 py-0.5 font-mono text-[10px] font-bold text-[#F8D86F]">
                        a {km} km
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <div>
                      <p className="font-display text-sm font-black text-white">
                        {stop.shortName}
                      </p>
                      <p className="text-[11px] font-bold text-[#F8D86F]">{stop.badgeTitle}</p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/70">
                        {stop.teaser}
                      </p>
                    </div>

                    {!isCurrent && (
                      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2.5 text-[11px] font-black">
                        <Link
                          href={`/p/${stop.shortCode}`}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-white transition hover:bg-[#EDB512] hover:text-[#041A29]"
                        >
                          Explorar
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-2 text-[#F8D86F] transition hover:border-[#EDB512]"
                          aria-label={`Cómo llegar a ${stop.shortName}`}
                        >
                          <Navigation className="h-3 w-3" />
                          Ir
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ÚLTIMOS REPORTES REALES EN ESTE SECTOR */}
        {recentReports.length > 0 && (
          <section data-nfc-in className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-black text-white">
                Registros recientes de guardianes en {station.municipio}
              </h2>
              <Link href="/escuelas" className="text-xs font-bold text-[#F8D86F] hover:underline">
                Seguir un código de reporte →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {recentReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3.5 rounded-xl border border-white/12 bg-[#082438] p-4"
                >
                  {r.evidencia_foto_url && (
                    <img
                      src={r.evidencia_foto_url}
                      alt={r.tracking_code}
                      className="h-20 w-24 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#F8D86F]">
                        {r.tracking_code}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-[#86EFAC]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {r.puntaje_confiabilidad}/100
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 leading-relaxed text-white/85">
                      {r.descripcion_ciudadana}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* BARRA FLOTANTE INFERIOR EN MÓVIL PARA ACCIÓN RÁPIDA EN SENDERO */}
      <div className="fixed bottom-[64px] left-0 right-0 z-40 border-t border-white/15 bg-[#041A29]/95 px-4 py-3 backdrop-blur-md md:hidden">
        <Link
          href={reportBaseHref}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#EDB512] text-sm font-black text-[#041A29]"
        >
          <Camera className="h-4 w-4" />
          Reportar desde {station.municipio} ahora
        </Link>
      </div>
    </div>
  );
}
