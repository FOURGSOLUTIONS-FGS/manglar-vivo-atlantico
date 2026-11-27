"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import exifr from "exifr";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Axe,
  Bird,
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  Droplets,
  LocateFixed,
  MapPin,
  Sparkles,
  Trash2,
  Trees,
  WifiOff,
} from "lucide-react";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";
import { MascotaCangrejo } from "@/components/MascotaCangrejo";
import { ReliabilityRing } from "@/components/ReliabilityRing";
import {
  DEMO_FIELD_POINTS,
  EVENT_CATEGORIES,
  QR_STATIONS,
  type EventTypeId,
  type ReporterProfileId,
} from "@/lib/cra-domain";
import {
  analyzeLocationOffline,
  type OfflineSpatialContext,
} from "@/lib/spatial-offline";
import { computeReliabilityScore } from "@/lib/reliability";
import {
  enqueueOfflineReport,
  uploadReportToServer,
  type PendingReportRecord,
} from "@/lib/offline-db";

const CraMap = dynamic(() => import("@/components/CraMap"), { ssr: false });

const VISUAL_CARDS: Array<{
  id: EventTypeId;
  friendlyTitle: string;
  friendlyHint: string;
  color: string;
  icon: typeof Axe;
}> = [
  {
    id: "tala_relleno",
    friendlyTitle: "Cortaron o rellenaron mangle",
    friendlyHint: "Árboles talados, quemas o maquinaria.",
    color: "bg-[#D94E2A]/12 text-[#D94E2A] border-[#D94E2A]/30",
    icon: Axe,
  },
  {
    id: "cambio_hidrico",
    friendlyTitle: "Caño tapado o árboles secos",
    friendlyHint: "Agua estancada o mangle amarillento.",
    color: "bg-[#EDB512]/20 text-[#946200] border-[#EDB512]/50",
    icon: Droplets,
  },
  {
    id: "contaminacion_residuos",
    friendlyTitle: "Basura o aguas sucias",
    friendlyHint: "Plásticos, escombros o vertimientos.",
    color: "bg-[#005F96]/12 text-[#005F96] border-[#005F96]/30",
    icon: Trash2,
  },
  {
    id: "dano_fauna_especies",
    friendlyTitle: "Animalito o fauna en peligro",
    friendlyHint: "Aves, cangrejos o peces afectados.",
    color: "bg-[#7C3AED]/12 text-[#6D28D9] border-[#7C3AED]/30",
    icon: Bird,
  },
  {
    id: "otro",
    friendlyTitle: "¡Manglar sano! Quiero verificar",
    friendlyHint: "Ayuda a revisar las 828 ha en duda.",
    color: "bg-[#1F7A4C]/12 text-[#1F7A4C] border-[#1F7A4C]/35",
    icon: Trees,
  },
];

const QUICK_CHIPS = [
  "Caño tapado",
  "Hojas amarillas",
  "Basura en la orilla",
  "Cangrejo azul",
  "Manglar sano",
  "Relleno o cercado",
];

const FRIENDLY_PROFILES: Array<{ id: ReporterProfileId; label: string }> = [
  { id: "habitante_local", label: "Soy vecino" },
  { id: "estudiante_escuela", label: "Soy estudiante" },
  { id: "turista", label: "Soy turista" },
  { id: "actor_registrado", label: "Organización / Entidad" },
];

function compressForPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function ReportarContent() {
  const searchParams = useSearchParams();
  const initialProfile = (searchParams.get("perfil") as ReporterProfileId) || "habitante_local";
  const initialSchool = searchParams.get("colegio") || "";
  const initialStation = searchParams.get("estacion") || "";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tipoEvento, setTipoEvento] = useState<EventTypeId>("cambio_hidrico");
  const [perfil, setPerfil] = useState<ReporterProfileId>(initialProfile);
  const [schoolName, setSchoolName] = useState(initialSchool);
  const [qrStationId, setQrStationId] = useState(initialStation);
  const [descripcion, setDescripcion] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [exifInfo, setExifInfo] = useState<Record<string, unknown> | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [precisionM, setPrecisionM] = useState<number | null>(null);
  const [isSimulatedGps, setIsSimulatedGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("Buscando tu ubicación...");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [spatialCtx, setSpatialCtx] = useState<OfflineSpatialContext | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<{
    trackingCode: string;
    offline: boolean;
    score: number;
    zona: string;
  } | null>(null);

  useEffect(() => {
    if (!initialStation) return;
    const st = QR_STATIONS.find((s) => s.id === initialStation);
    if (st) {
      setPerfil("turista");
      setQrStationId(st.id);
      setLat(st.lat);
      setLon(st.lon);
      setPrecisionM(15);
      setIsSimulatedGps(false);
      setGpsStatus(`Estación QR: ${st.nombre}`);
      analyzeLocationOffline(st.lat, st.lon).then(setSpatialCtx);
    }
  }, [initialStation]);

  const requestRealGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError("Tu navegador no tiene GPS disponible. Elige un manglar abajo si estás probando en salón.");
      return;
    }
    setGpsError(null);
    setGpsStatus("Buscando satélites GPS reales...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(6));
        const nextLon = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);
        setLat(nextLat);
        setLon(nextLon);
        setPrecisionM(acc);
        setIsSimulatedGps(false);
        setGpsStatus(acc <= 25 ? `¡Ubicación exacta! (±${acc} m)` : `Ubicación aproximada (±${acc} m)`);
        const ctx = await analyzeLocationOffline(nextLat, nextLon);
        setSpatialCtx(ctx);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? "No diste permiso de ubicación. Actívalo o toca un manglar abajo si estás en un salón."
            : "En interiores el GPS no llega bien. Sal al aire libre o toca un manglar de prueba abajo."
        );
        setGpsStatus("Sin señal GPS aún");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    if (step === 3 && lat == null && !initialStation) {
      requestRealGps();
    }
  }, [step, lat, initialStation]);

  const handleDemoPoint = async (pointId: string) => {
    const pt = DEMO_FIELD_POINTS.find((p) => p.id === pointId);
    if (!pt) return;
    setLat(pt.lat);
    setLon(pt.lon);
    setPrecisionM(12);
    setIsSimulatedGps(true);
    setGpsError(null);
    setGpsStatus(`SIMULADO (DEMO): ${pt.municipio}`);
    const ctx = await analyzeLocationOffline(pt.lat, pt.lon);
    setSpatialCtx(ctx);
  };

  const handlePickMap = async (nextLat: number, nextLon: number) => {
    setLat(nextLat);
    setLon(nextLon);
    setPrecisionM(15);
    setIsSimulatedGps(true);
    setGpsError(null);
    setGpsStatus("SIMULADO (DEMO): Punto elegido en el mapa");
    const ctx = await analyzeLocationOffline(nextLat, nextLon);
    setSpatialCtx(ctx);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);

    try {
      const parsed = await exifr.parse(file, ["Make", "Model", "DateTimeOriginal", "latitude", "longitude"]);
      setExifInfo(
        parsed
          ? {
              make: parsed.Make || null,
              model: parsed.Model || null,
              takenAt: parsed.DateTimeOriginal ? String(parsed.DateTimeOriginal) : null,
              hasGpsExif: Boolean(parsed.latitude && parsed.longitude),
              originalBytes: file.size,
            }
          : { originalBytes: file.size, hasGpsExif: false }
      );
    } catch {
      setExifInfo({ originalBytes: file.size, hasGpsExif: false });
    }

    const preview = await compressForPreview(file);
    setPhotoPreview(preview);

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: preview,
          tipoEvento,
          descripcion,
          zonaManglar: spatialCtx?.sector.nombre,
          enZonaPorRevisar: spatialCtx?.inPorRevisar828Ha,
        }),
      });
      if (res.ok) setAiResult(await res.json());
    } catch {
      setAiResult({
        mode: "offline_queued",
        clasificacion_tecnica: "Guardado sin conexión — la IA lo clasificará al sincronizar.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const toggleChip = (chip: string) => {
    setDescripcion((prev) =>
      prev.includes(chip)
        ? prev
            .split("·")
            .map((s) => s.trim())
            .filter((s) => s && s !== chip)
            .join(" · ")
        : prev
        ? `${prev} · ${chip}`
        : chip
    );
  };

  const reliabilityPreview = computeReliabilityScore({
    hasPhoto: Boolean(photoFile),
    precisionGpsM: precisionM,
    inCoastalZone: Boolean(spatialCtx?.inCoastalBbox),
    isSimulatedGps,
    timestampCaptura: new Date().toISOString(),
    nearGroundTruthM: spatialCtx?.nearestGroundTruth?.distMeters ?? null,
    estadoValidacion: "nuevo",
  });

  const handleSubmit = async () => {
    if (lat == null || lon == null) {
      setGpsError("Primero marca tu ubicación con GPS o toca uno de los manglares de prueba.");
      return;
    }

    setSubmitting(true);
    try {
      const clientUuid = crypto.randomUUID();
      const trackingCode = `MGL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const cat = EVENT_CATEGORIES.find((c) => c.id === tipoEvento);
      const priority: "alta" | "media" | "baja" =
        spatialCtx?.inDoselSeco2026 || spatialCtx?.kmzPrioridad === "Alto"
          ? "alta"
          : cat?.defaultPriority ?? "media";

      const record: PendingReportRecord = {
        client_uuid: clientUuid,
        photo_original: photoFile,
        photo_name: photoFile?.name || "evidencia.jpg",
        photo_preview: photoPreview,
        created_at: Date.now(),
        retries: 0,
        payload: {
          client_uuid: clientUuid,
          tracking_code: trackingCode,
          timestamp_captura: new Date().toISOString(),
          latitud: lat,
          longitud: lon,
          precision_gps_m: precisionM,
          is_simulated_gps: isSimulatedGps,
          zona_manglar: spatialCtx?.sector.nombre || "Atlántico Costero",
          municipio:
            DEMO_FIELD_POINTS.find((d) => d.sectorId === spatialCtx?.sector.id)?.municipio ||
            spatialCtx?.sector.municipioPrincipal ||
            "Atlántico",
          sector_id: spatialCtx?.sector.id || 1,
          accion_plan:
            spatialCtx?.kmzAccionPlan ||
            (spatialCtx?.fueraDeZonificacion ? "Fuera de zonificación (221 ha)" : null),
          en_zona_por_revisar: Boolean(spatialCtx?.inPorRevisar828Ha),
          tipo_evento: tipoEvento,
          descripcion_ciudadana: descripcion,
          perfil_reportante: perfil,
          school_name:
            perfil === "estudiante_escuela" ? schoolName || "Escuela del Atlántico" : undefined,
          qr_station_id: perfil === "turista" ? qrStationId || "sendero-qr" : undefined,
          nivel_prioridad: priority,
          puntaje_confiabilidad: reliabilityPreview.score,
          evidencia_exif: exifInfo,
          ai_classification: aiResult,
          ground_truth_match: spatialCtx?.nearestGroundTruth
            ? {
                nearest_point_id: spatialCtx.nearestGroundTruth.pointId,
                dist_m: spatialCtx.nearestGroundTruth.distMeters,
                es_manglar_consenso: spatialCtx.nearestGroundTruth.esManglar,
              }
            : null,
        },
      };

      if (!navigator.onLine) {
        await enqueueOfflineReport(record);
        setReceipt({
          trackingCode,
          offline: true,
          score: reliabilityPreview.score,
          zona: record.payload.zona_manglar,
        });
      } else {
        try {
          await uploadReportToServer(record);
          setReceipt({
            trackingCode,
            offline: false,
            score: reliabilityPreview.score,
            zona: record.payload.zona_manglar,
          });
        } catch {
          await enqueueOfflineReport(record);
          setReceipt({
            trackingCode,
            offline: true,
            score: reliabilityPreview.score,
            zona: record.payload.zona_manglar,
          });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <div className="bezel-outer">
          <div className="bezel-inner space-y-6 p-7 text-center sm:p-10">
            <div className="flex justify-center">
              <MascotaCangrejo
                size="lg"
                title="¡Misión cumplida!"
                message={
                  receipt.offline
                    ? "¡Genial! Guardé tu foto y GPS en tu celular. Subirán solos apenas vuelva internet."
                    : "¡Increíble! Tu reporte ya está en la Sala Operativa de la CRA ayudando al manglar."
                }
              />
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-[#005F96] to-[#08334C] p-6 text-white shadow-lg">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F8D86F]">
                Tarjeta de Guardián · {receipt.offline ? "En cola offline" : "Sincronizado en vivo"}
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <h1 className="font-display text-3xl font-black tracking-wide">
                  {receipt.trackingCode}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(receipt.trackingCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/85">
                Sector: <strong>{receipt.zona}</strong> · Confiabilidad:{" "}
                <strong className="tabular-nums">{receipt.score}/100</strong>
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setReceipt(null);
                  setStep(1);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setAiResult(null);
                  setDescripcion("");
                }}
                className="min-h-[48px] rounded-full bg-[#005F96] px-6 py-2.5 text-sm font-black text-white"
              >
                Hacer otro reporte
              </button>
              <Link
                href="/cra"
                className="inline-flex min-h-[48px] items-center rounded-full bg-[#EDB512] px-6 py-2.5 text-sm font-black text-[#08334C]"
              >
                Ver en el Mapa CRA →
              </Link>
              <Link
                href="/escuelas"
                className="inline-flex min-h-[48px] items-center rounded-full border border-[#08334C]/15 bg-[#F7F3EA] px-5 py-2.5 text-sm font-bold text-[#08334C]"
              >
                Seguir mi código
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const crabPrompt =
    step === 1
      ? "¡Hola! Soy Mangle. Toca la tarjeta que mejor describe lo que ves hoy."
      : step === 2
      ? "Una foto clara vale oro: la guardo original para la CRA y la analizo con IA."
      : "¡Último paso! Confirma dónde estás para cruzarlo con el mapa oficial del Atlántico.";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4">
      <OfflineSyncBanner />

      {/* Barra de progreso amigable 1-2-3 */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="inline-flex min-h-[42px] items-center gap-1 rounded-full bg-white px-3.5 text-xs font-black text-[#08334C] shadow-sm ring-1 ring-[#08334C]/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Atrás
            </button>
          )}
          <span className="rounded-full bg-[#005F96]/10 px-3.5 py-1.5 text-xs font-black text-[#005F96]">
            Paso {step} de 3
          </span>
        </div>

        <div className="flex flex-1 max-w-[200px] items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${
                n <= step ? "bg-[#005F96]" : "bg-[#08334C]/12"
              }`}
            />
          ))}
        </div>
      </div>

      <MascotaCangrejo size="sm" message={crabPrompt} className="mb-5" />

      {/* PASO 1 */}
      {step === 1 && (
        <section className="bezel-outer">
          <div className="bezel-inner space-y-5 p-5 sm:p-8">
            <div>
              <h1 className="font-display text-2xl font-black text-[#08334C] sm:text-3xl">
                ¿Qué viste hoy en el manglar?
              </h1>
              <p className="mt-1 text-sm text-[#08334C]/70">
                No necesitas saber términos técnicos. Elige una opción:
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {VISUAL_CARDS.map((card) => {
                const Icon = card.icon;
                const active = tipoEvento === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setTipoEvento(card.id);
                    }}
                    className={`flex min-h-[82px] items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-all duration-300 ease-coastal active:scale-[0.98] ${
                      active
                        ? "border-[#005F96] bg-[#005F96]/8 shadow-md ring-2 ring-[#005F96]/20"
                        : "border-[#08334C]/10 bg-[#F7F3EA]/65 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${card.color}`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <div>
                      <span className="block text-sm font-black text-[#08334C]">
                        {card.friendlyTitle}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#08334C]/70">
                        {card.friendlyHint}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-[#08334C]/10 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                ¿Quién está reportando?
              </p>
              <div className="flex flex-wrap gap-2">
                {FRIENDLY_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPerfil(p.id)}
                    className={`min-h-[42px] rounded-full px-4 py-2 text-xs font-black transition ${
                      perfil === p.id
                        ? "bg-[#005F96] text-white"
                        : "bg-[#F7F3EA] text-[#08334C] hover:bg-[#08334C]/10"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {perfil === "estudiante_escuela" && (
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Escribe el nombre de tu colegio (ej. I.E. Juan de Acosta)"
                  className="mt-3 min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-4 text-sm font-bold text-[#08334C]"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="group flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#005F96] text-sm font-black text-white shadow-lg shadow-[#005F96]/20 transition hover:bg-[#08334C]"
            >
              <span>Continuar: tomar foto</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
          </div>
        </section>
      )}

      {/* PASO 2 */}
      {step === 2 && (
        <section className="bezel-outer">
          <div className="bezel-inner space-y-5 p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="font-display text-2xl font-black text-[#08334C] sm:text-3xl">
                Muéstranos una foto
              </h1>
              <span className="rounded-full bg-[#1F7A4C]/12 px-3 py-1 text-xs font-black text-[#1F7A4C]">
                +25 pts por evidencia real
              </span>
            </div>

            {!photoPreview ? (
              <label className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#005F96]/40 bg-[#F7F3EA] p-6 text-center transition hover:border-[#005F96] hover:bg-white">
                <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#005F96] text-white shadow-md">
                  <Camera className="h-8 w-8" strokeWidth={1.6} />
                </span>
                <span className="text-base font-black text-[#08334C]">
                  Toca aquí para abrir cámara o galería
                </span>
                <span className="mt-1 max-w-sm text-xs text-[#08334C]/70">
                  Guardamos tu foto original sin borrar el EXIF (fecha y cámara) para darle validez ante la CRA.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative overflow-hidden rounded-3xl border border-[#08334C]/12 bg-[#08334C]">
                <img
                  src={photoPreview}
                  alt="Vista previa capturada"
                  className="h-64 w-full object-cover"
                />
                {aiLoading && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#005F96]/25">
                    <div className="animate-scan h-14 w-full bg-gradient-to-b from-transparent via-[#F8D86F]/70 to-transparent" />
                  </div>
                )}
                <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-white/95 px-4 py-2 text-xs font-black text-[#08334C] shadow-md">
                  Cambiar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {(aiLoading || aiResult) && (
              <div className="rounded-2xl border border-[#005F96]/20 bg-[#005F96]/6 p-4 text-xs">
                <div className="flex items-center gap-2 font-black text-[#005F96]">
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {aiLoading
                      ? "Analizando fotografía con IA Gemini..."
                      : aiResult?.mode === "openrouter_live"
                      ? `IA en vivo (${String(aiResult.model)})`
                      : "Asistente local (modo sin red)"}
                  </span>
                </div>
                {aiResult && !aiLoading && (
                  <p className="mt-1.5 text-sm font-bold text-[#08334C]">
                    {String(aiResult.clasificacion_tecnica || "")}
                  </p>
                )}
              </div>
            )}

            {/* Chips rápidos en 1 toque */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                Detalles rápidos (toca para agregar sin escribir):
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => {
                  const selected = descripcion.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleChip(chip)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        selected
                          ? "bg-[#1F7A4C] text-white"
                          : "bg-[#F7F3EA] text-[#08334C] hover:bg-[#08334C]/10"
                      }`}
                    >
                      {selected ? "✓ " : "+ "}
                      {chip}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="¿Quieres contar algo más? (opcional)"
                className="mt-3 min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-4 text-sm text-[#08334C]"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="group flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-[#005F96] px-6 text-sm font-black text-white shadow-lg shadow-[#005F96]/20 hover:bg-[#08334C]"
              >
                <span>{photoPreview ? "Siguiente: ubicar en mapa" : "Continuar sin foto"}</span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* PASO 3 */}
      {step === 3 && (
        <section className="bezel-outer">
          <div className="bezel-inner space-y-5 p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="font-display text-2xl font-black text-[#08334C] sm:text-3xl">
                ¿En qué manglar estás?
              </h1>
              <button
                type="button"
                onClick={requestRealGps}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#005F96]/10 px-4 py-1.5 text-xs font-black text-[#005F96] hover:bg-[#005F96]/20"
              >
                <LocateFixed className="h-4 w-4" />
                Detectar mi GPS real
              </button>
            </div>

            {gpsError && (
              <div className="flex items-start gap-2 rounded-2xl border border-[#D94E2A]/30 bg-[#D94E2A]/10 p-3.5 text-xs font-bold text-[#08334C]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D94E2A]" />
                <span>{gpsError}</span>
              </div>
            )}

            {/* Mini mapa satelital vivo */}
            <CraMap
              reports={[]}
              layersVisible={{
                priorities: false,
                manglarProbable: true,
                porRevisar: true,
                doselSeco: false,
                groundTruth: false,
                reports: false,
              }}
              onPickPoint={handlePickMap}
              pickedPoint={lat != null && lon != null ? { lat, lon } : null}
              flyToTarget={lat != null && lon != null ? { lat, lon, zoom: 13 } : null}
              heightClass="h-[240px]"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F3EA] px-4 py-3 text-xs">
              <span className="font-black text-[#08334C]">{gpsStatus}</span>
              {isSimulatedGps && (
                <span className="rounded-full bg-[#EDB512] px-3 py-1 text-[11px] font-black text-[#08334C]">
                  SIMULADO (DEMO)
                </span>
              )}
            </div>

            {/* Modo demo claro para salón */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                ¿Probando desde un salón? Toca un manglar o haz clic en el mapa:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DEMO_FIELD_POINTS.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => handleDemoPoint(pt.id)}
                    className="rounded-2xl border border-[#08334C]/12 bg-white p-3 text-left text-xs font-bold text-[#08334C] transition hover:border-[#005F96] hover:bg-[#005F96]/5"
                  >
                    <MapPin className="mb-1 h-4 w-4 text-[#EDB512]" />
                    <span className="block font-black">{pt.municipio}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Radar del Manglar + Semáforo circular */}
            {spatialCtx && (
              <div className="rounded-3xl border border-[#1F7A4C]/25 bg-gradient-to-br from-[#1F7A4C]/8 to-[#005F96]/6 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
                      Radar del Manglar (funciona sin internet)
                    </p>
                    <h2 className="font-display mt-1 text-xl font-bold text-[#08334C]">
                      {spatialCtx.sector.nombre}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {spatialCtx.inPorRevisar828Ha && (
                        <span className="rounded-full bg-[#EDB512] px-3 py-0.5 font-black text-[#08334C]">
                          ★ Zona de 828 ha por revisar
                        </span>
                      )}
                      {spatialCtx.inDoselSeco2026 && (
                        <span className="rounded-full bg-[#D94E2A] px-3 py-0.5 font-black text-white">
                          Dosel seco 2026
                        </span>
                      )}
                      <span className="rounded-full bg-white px-3 py-0.5 font-bold text-[#005F96]">
                        Plan: {spatialCtx.kmzAccionPlan || "Zona costera CRA"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <ReliabilityRing score={reliabilityPreview.score} size={82} />
                    <span className="mt-1 text-[10px] font-black uppercase text-[#08334C]/65">
                      Confiabilidad
                    </span>
                  </div>
                </div>

                {/* Acordeón técnico para el jurado */}
                <button
                  type="button"
                  onClick={() => setShowTechDetails((v) => !v)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#005F96]"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showTechDetails ? "rotate-180" : ""}`}
                  />
                  {showTechDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos (EXIF y Ground-Truth)"}
                </button>

                {showTechDetails && (
                  <div className="mt-2 rounded-2xl bg-white/90 p-3 text-xs text-[#08334C]/80">
                    <p>
                      Coordenadas: <strong className="tabular-nums">{lat}, {lon}</strong> · Precisión:{" "}
                      {precisionM ?? "—"} m
                    </p>
                    {spatialCtx.kmzMicrocuenca && (
                      <p>Microcuenca KMZ: {spatialCtx.kmzMicrocuenca}</p>
                    )}
                    {spatialCtx.nearestGroundTruth && (
                      <p>
                        Ground-Truth CRA #{spatialCtx.nearestGroundTruth.pointId}: a{" "}
                        {spatialCtx.nearestGroundTruth.distMeters} m (
                        {spatialCtx.nearestGroundTruth.esManglar ? "Consenso manglar" : "Contraste"})
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#1F7A4C] text-base font-black text-white shadow-lg shadow-[#1F7A4C]/25 transition hover:bg-[#165e3a] disabled:opacity-60"
            >
              {submitting ? (
                <span>Enviando reporte...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Enviar reporte ahora</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function ReportarPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-8 text-sm font-bold text-[#005F96]">
          Preparando estación de reporte...
        </div>
      }
    >
      <ReportarContent />
    </Suspense>
  );
}
