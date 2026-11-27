"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import exifr from "exifr";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  LocateFixed,
  MapPin,
  Mic,
  MicOff,
  ShieldAlert,
  Sparkles,
  WifiOff,
  XCircle,
} from "lucide-react";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";
import { ReliabilityMeter } from "@/components/ReliabilityMeter";
import {
  ALL_SUBTYPES,
  DEMO_FIELD_POINTS,
  FACTOR_DOMAINS,
  QR_STATIONS,
  REPORTER_PROFILES,
  type FactorDomainId,
  type ReporterProfileId,
  type SubtypeId,
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
import { classifyAlert } from "@/core/alerts/classifier";
import type { AlertClassification } from "@/core/alerts/types";
import { playAlertSound } from "@/lib/alert-audio";

const CraMap = dynamic(() => import("@/components/CraMap"), { ssr: false });

interface DatasetSample {
  id: string;
  domain: string;
  label: string;
  src: string;
  sourceTitle?: string;
  license?: string;
}

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
  const paramDomain = searchParams.get("dominio") as FactorDomainId | null;
  const paramSubtype = searchParams.get("subtipo") as SubtypeId | null;

  const initialSubtypeObj = useMemo(() => {
    if (paramSubtype) {
      const found = ALL_SUBTYPES.find((s) => s.id === paramSubtype);
      if (found) return found;
    }
    if (paramDomain) {
      const dom = FACTOR_DOMAINS.find((d) => d.id === paramDomain);
      if (dom) return dom.subtypes[0];
    }
    return FACTOR_DOMAINS[1].subtypes[0];
  }, [paramDomain, paramSubtype]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [domainId, setDomainId] = useState<FactorDomainId>(initialSubtypeObj.domainId);
  const [subtypeId, setSubtypeId] = useState<SubtypeId>(initialSubtypeObj.id);
  const [perfil, setPerfil] = useState<ReporterProfileId>(initialProfile);
  const [schoolName, setSchoolName] = useState(initialSchool);
  const [qrStationId, setQrStationId] = useState(initialStation);
  const [descripcion, setDescripcion] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFromDataset, setPhotoFromDataset] = useState<string | null>(null);
  const [exifInfo, setExifInfo] = useState<Record<string, unknown> | null>(null);

  const [datasetSamples, setDatasetSamples] = useState<DatasetSample[]>([]);
  const [showDatasetBank, setShowDatasetBank] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);

  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      };
      setVoiceSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoiceDictation = () => {
    if (voiceListening) {
      recognitionRef.current?.stop();
      setVoiceListening(false);
      setVoiceStatus("Dictado detenido.");
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceStatus("Tu navegador no soporta dictado por voz. Puedes escribir o usar los botones rápidos.");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = "es-CO";
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i += 1) {
          const t = ev.results[i]?.[0]?.transcript?.trim();
          if (t) parts.push(t);
        }
        const spoken = parts.join(" ").trim();
        if (spoken) {
          setDescripcion((prev) => (prev ? `${prev} · ${spoken}` : spoken));
          setVoiceStatus(`Texto dictado agregado: "${spoken}"`);
        }
      };
      rec.onerror = (ev) => {
        setVoiceListening(false);
        setVoiceStatus(
          ev.error === "not-allowed"
            ? "Permiso de micrófono denegado. Actívalo para dictar tu reporte."
            : "No se escuchó voz clara. Intenta de nuevo."
        );
      };
      rec.onend = () => {
        setVoiceListening(false);
      };
      recognitionRef.current = rec;
      setVoiceListening(true);
      setVoiceStatus("Escuchando en español (Colombia)... cuéntanos qué ves en el manglar.");
      rec.start();
    } catch {
      setVoiceListening(false);
      setVoiceStatus("No se pudo iniciar el micrófono en este dispositivo.");
    }
  };

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [precisionM, setPrecisionM] = useState<number | null>(null);
  const [isSimulatedGps, setIsSimulatedGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("Esperando señal GPS...");
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
    factorLabel: string;
    classification: AlertClassification;
  } | null>(null);

  const activeDomain =
    FACTOR_DOMAINS.find((d) => d.id === domainId) ?? FACTOR_DOMAINS[0];
  const activeSubtype =
    ALL_SUBTYPES.find((s) => s.id === subtypeId) ?? activeDomain.subtypes[0];

  useEffect(() => {
    fetch("/dataset/manifest.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setDatasetSamples(list);
      })
      .catch(() => {});
  }, []);

  const handleDomainSelect = (nextDomainId: FactorDomainId) => {
    setDomainId(nextDomainId);
    const dom = FACTOR_DOMAINS.find((d) => d.id === nextDomainId);
    if (dom && !dom.subtypes.some((s) => s.id === subtypeId)) {
      setSubtypeId(dom.subtypes[0].id);
    }
  };

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
      setGpsStatus(`Estación QR verificada: ${st.nombre}`);
      analyzeLocationOffline(st.lat, st.lon).then(setSpatialCtx);
    }
  }, [initialStation]);

  const requestRealGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError(
        "Este dispositivo no reporta GPS por navegador. Si estás en demostración en salón, elige uno de los 4 puntos satelitales de prueba."
      );
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
        setGpsStatus(
          acc <= 25 ? `GPS real preciso (±${acc} m)` : `GPS real aproximado (±${acc} m)`
        );
        const ctx = await analyzeLocationOffline(nextLat, nextLon);
        setSpatialCtx(ctx);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? "Permiso de ubicación denegado. Actívalo en el navegador o selecciona un punto de demostración abajo."
            : "Sin señal satelital directa (interiores). Sal a cielo abierto o marca un punto de prueba."
        );
        setGpsStatus("Sin coordenadas GPS aún");
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
    setGpsStatus("SIMULADO (DEMO): Punto seleccionado manualmente en mapa");
    const ctx = await analyzeLocationOffline(nextLat, nextLon);
    setSpatialCtx(ctx);
  };

  const runVisionAudit = async (preview: string, subtypeOverride?: typeof activeSubtype) => {
    const sub = subtypeOverride ?? activeSubtype;
    const dom = FACTOR_DOMAINS.find((d) => d.id === sub.domainId) ?? activeDomain;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: preview,
          tipoEvento: sub.eventType,
          subtipoEvento: sub.id,
          factorDominio: dom.title,
          descripcion,
          zonaManglar: spatialCtx?.sector.nombre,
          enZonaPorRevisar: spatialCtx?.inPorRevisar828Ha,
        }),
      });
      if (res.ok) setAiResult(await res.json());
    } catch {
      setAiResult({
        mode: "offline_queued",
        es_evidencia_valida: true,
        clasificacion_tecnica: `${sub.technicalHint} (clasificación local offline)`,
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoFromDataset(null);

    try {
      const parsed = await exifr.parse(file, [
        "Make",
        "Model",
        "DateTimeOriginal",
        "latitude",
        "longitude",
      ]);
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
    await runVisionAudit(preview);
  };

  const handleSelectDatasetSample = async (sample: DatasetSample) => {
    try {
      const res = await fetch(sample.src);
      const blob = await res.blob();
      const file = new File([blob], `${sample.id}.jpg`, { type: "image/jpeg" });
      setPhotoFile(file);
      setPhotoFromDataset(sample.label);
      setExifInfo({
        source: "dataset_prueba_wikimedia",
        sampleId: sample.id,
        originalBytes: blob.size,
        hasGpsExif: false,
      });
      const preview = await compressForPreview(file);
      setPhotoPreview(preview);
      setShowDatasetBank(false);
      await runVisionAudit(preview);
    } catch {
      // ignore
    }
  };

  const applyAiSuggestedSubtype = () => {
    const suggestedId = aiResult?.subtipo_sugerido as SubtypeId | undefined;
    if (!suggestedId) return;
    const found = ALL_SUBTYPES.find((s) => s.id === suggestedId);
    if (!found) return;
    setDomainId(found.domainId);
    setSubtypeId(found.id);
    setAiResult((prev) =>
      prev ? { ...prev, coincide_con_categoria: true } : prev
    );
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

  const aiPhotoValid =
    aiResult && typeof aiResult.es_evidencia_valida === "boolean"
      ? aiResult.es_evidencia_valida
      : null;

  const aiCategoryMismatch =
    aiPhotoValid === true &&
    aiResult?.coincide_con_categoria === false &&
    typeof aiResult?.subtipo_sugerido === "string" &&
    aiResult.subtipo_sugerido !== subtypeId;

  const reliabilityPreview = computeReliabilityScore({
    hasPhoto: Boolean(photoFile),
    aiPhotoValid,
    precisionGpsM: precisionM,
    inCoastalZone: Boolean(spatialCtx?.inCoastalBbox),
    isSimulatedGps,
    timestampCaptura: new Date().toISOString(),
    nearGroundTruthM: spatialCtx?.nearestGroundTruth?.distMeters ?? null,
    estadoValidacion: "nuevo",
  });

  const handleSubmit = async () => {
    if (lat == null || lon == null) {
      setGpsError(
        "Primero confirma una ubicación con GPS real o toca un punto satelital de demostración."
      );
      return;
    }

    setSubmitting(true);
    try {
      const clientUuid = crypto.randomUUID();
      const trackingCode = `MGL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const priority: "alta" | "media" | "baja" =
        spatialCtx?.inDoselSeco2026 || spatialCtx?.kmzPrioridad === "Alto"
          ? "alta"
          : activeSubtype.defaultPriority;

      const fullDescription = descripcion.trim()
        ? `[${activeDomain.shortTitle} · ${activeSubtype.label}] ${descripcion.trim()}`
        : `[${activeDomain.shortTitle} · ${activeSubtype.label}] ${activeSubtype.description}`;

      const enrichedExif: Record<string, unknown> = {
        ...(exifInfo ?? {}),
        factor_dominio: activeDomain.id,
        factor_dominio_titulo: activeDomain.title,
        subtipo_evento: activeSubtype.id,
        subtipo_label: activeSubtype.label,
        photo_from_dataset: photoFromDataset,
      };

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
          tipo_evento: activeSubtype.eventType,
          descripcion_ciudadana: fullDescription,
          perfil_reportante: perfil,
          school_name:
            perfil === "estudiante_escuela" ? schoolName || "Escuela del Atlántico" : undefined,
          qr_station_id: perfil === "turista" ? qrStationId || "sendero-qr" : undefined,
          nivel_prioridad: priority,
          puntaje_confiabilidad: reliabilityPreview.score,
          evidencia_exif: enrichedExif,
          ai_classification: aiResult ?? {
            mode: "user_structured_taxonomy",
            es_evidencia_valida: true,
            clasificacion_tecnica: activeSubtype.technicalHint,
            subtipo_evento: activeSubtype.id,
          },
          ground_truth_match: spatialCtx?.nearestGroundTruth
            ? {
                nearest_point_id: spatialCtx.nearestGroundTruth.pointId,
                dist_m: spatialCtx.nearestGroundTruth.distMeters,
                es_manglar_consenso: spatialCtx.nearestGroundTruth.esManglar,
              }
            : null,
        },
      };

      const alertClassification = classifyAlert({
        trackingCode,
        tipoEvento: activeSubtype.eventType,
        subtipoEvento: activeSubtype.id,
        zonaManglar: record.payload.zona_manglar,
        municipio: record.payload.municipio,
        enZonaPorRevisar: record.payload.en_zona_por_revisar,
        enDoselSeco2026: Boolean(spatialCtx?.inDoselSeco2026),
        nivelPrioridad: priority,
        puntajeConfiabilidad: reliabilityPreview.score,
        estadoValidacion: "nuevo",
        latitud: lat,
        longitud: lon,
        isSimulatedGps,
        aiPhotoValid,
      });

      if (!navigator.onLine) {
        await enqueueOfflineReport(record);
        playAlertSound(alertClassification.soundProfile);
        setReceipt({
          trackingCode,
          offline: true,
          score: reliabilityPreview.score,
          zona: record.payload.zona_manglar,
          factorLabel: `${activeDomain.shortTitle} · ${activeSubtype.label}`,
          classification: alertClassification,
        });
      } else {
        try {
          await uploadReportToServer(record);
          playAlertSound(alertClassification.soundProfile);
          setReceipt({
            trackingCode,
            offline: false,
            score: reliabilityPreview.score,
            zona: record.payload.zona_manglar,
            factorLabel: `${activeDomain.shortTitle} · ${activeSubtype.label}`,
            classification: alertClassification,
          });
        } catch {
          await enqueueOfflineReport(record);
          playAlertSound(alertClassification.soundProfile);
          setReceipt({
            trackingCode,
            offline: true,
            score: reliabilityPreview.score,
            zona: record.payload.zona_manglar,
            factorLabel: `${activeDomain.shortTitle} · ${activeSubtype.label}`,
            classification: alertClassification,
          });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-[#EDF2F6] py-10">
        <div className="mx-auto max-w-2xl px-4">
          <div className="overflow-hidden rounded-xl border border-[#041A29]/12 bg-white">
            <div className="bg-[#041A29] p-7 text-white sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 text-[#86EFAC]">
                  <CheckCircle2 className="h-4 w-4" />
                  {receipt.offline
                    ? "Guardado en cola local offline"
                    : "Sincronizado en vivo con la CRA"}
                </span>
                <span className="font-mono text-[#F8D86F]">{receipt.factorLabel}</span>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {receipt.trackingCode}
                  </h1>
                  <p className="mt-1 text-sm text-white/75">
                    Sector asignado: <strong className="text-white">{receipt.zona}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(receipt.trackingCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  <Copy className="h-4 w-4 text-[#F8D86F]" />
                  {copied ? "Código copiado" : "Copiar código"}
                </button>
              </div>
            </div>

            <div className="space-y-6 p-7 sm:p-9">
              {/* Explicación ultra clara de quién recibe la alerta (fácil de entender para niños y comunidad) */}
              <div
                className="rounded-xl border border-[#041A29]/12 bg-[#EDF2F6]/70 p-5"
                style={{
                  borderTopWidth: "4px",
                  borderTopColor: receipt.classification.colorHex,
                }}
              >
                <span
                  className="inline-block rounded px-2.5 py-0.5 text-[11px] font-black text-white"
                  style={{ backgroundColor: receipt.classification.colorHex }}
                >
                  {receipt.classification.badgeLabel} · Meta {receipt.classification.slaHours} h
                </span>
                <h2 className="mt-2.5 font-display text-xl font-black text-[#041A29]">
                  {receipt.classification.kidFriendlyHeadline}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#041A29]/80">
                  {receipt.classification.kidFriendlyExplanation}
                </p>

                <div className="mt-4 border-t border-[#041A29]/10 pt-3">
                  <p className="text-xs font-black text-[#005F96]">
                    ¿Quién acaba de recibir tu aviso?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {receipt.classification.recipients.map((rec) => (
                      <span
                        key={rec.id}
                        className="rounded-md border border-[#041A29]/12 bg-white px-3 py-1.5 text-xs font-bold text-[#041A29]"
                      >
                        {rec.kidRoleLabel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <ReliabilityMeter score={receipt.score} />

              <p className="text-sm leading-relaxed text-[#041A29]/75">
                {receipt.offline
                  ? "Tu fotografía original (EXIF intacto), coordenadas y clasificación quedaron guardadas en IndexedDB. Subirán automáticamente apenas regrese la señal."
                  : receipt.classification.nextStepSimple}
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/admin"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#005F96] px-5 text-sm font-black text-white transition hover:bg-[#041A29]"
                >
                  Ver en Centro Admin CRA
                  <ArrowRight className="h-4 w-4 text-[#F8D86F]" />
                </Link>
                <Link
                  href="/escuelas"
                  className="inline-flex min-h-[48px] items-center rounded-lg border border-[#041A29]/20 bg-white px-5 text-sm font-bold text-[#041A29] transition hover:border-[#005F96]"
                >
                  Seguir cierre de ciclo
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setStep(1);
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setPhotoFromDataset(null);
                    setAiResult(null);
                    setDescripcion("");
                  }}
                  className="inline-flex min-h-[48px] items-center rounded-lg px-4 text-sm font-bold text-[#005F96] hover:underline"
                >
                  Nuevo reporte
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#EDF2F6]">
      {/* Franja superior oscura de progreso 3 pasos */}
      <div className="border-b border-white/12 bg-[#041A29] text-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs font-bold text-white transition hover:border-[#EDB512]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Atrás
                </button>
              )}
              <span className="font-mono text-xs font-bold text-[#F8D86F]">
                PASO 0{step} / 03
              </span>
            </div>

            <ol className="hidden items-center gap-6 text-xs font-bold sm:flex">
              {[
                { n: 1, label: "1. Factor ambiental" },
                { n: 2, label: "2. Evidencia fotográfica" },
                { n: 3, label: "3. Ubicación y envío" },
              ].map((s) => (
                <li
                  key={s.n}
                  className={
                    step === s.n
                      ? "text-[#F8D86F]"
                      : step > s.n
                      ? "text-white"
                      : "text-white/40"
                  }
                >
                  {s.label}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-3 h-1 w-full overflow-hidden bg-white/15">
            <div
              className="h-full bg-[#EDB512] transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <OfflineSyncBanner />

        {/* PASO 1: 4 DOMINIOS SEPARADOS × 12 FACTORES ESPECÍFICOS */}
        {step === 1 && (
          <section className="overflow-hidden rounded-xl border border-[#041A29]/12 bg-white">
            <div className="border-b border-[#041A29]/10 p-6 sm:p-8">
              <h1 className="font-display text-2xl font-black text-[#041A29] sm:text-3xl">
                ¿Qué factor estás observando en el manglar?
              </h1>
              <p className="mt-1.5 text-sm text-[#041A29]/70">
                Elige primero el ámbito ambiental y luego el caso exacto para dirigir el reporte sin ambigüedades.
              </p>

              <div
                role="tablist"
                aria-label="Dominios ambientales"
                className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
              >
                {FACTOR_DOMAINS.map((dom) => {
                  const active = dom.id === domainId;
                  return (
                    <button
                      key={dom.id}
                      role="tab"
                      aria-selected={active}
                      type="button"
                      onClick={() => handleDomainSelect(dom.id)}
                      className={`flex min-h-[76px] flex-col justify-between rounded-lg border p-3.5 text-left transition ${
                        active
                          ? "border-[#041A29] bg-[#041A29] text-white"
                          : "border-[#041A29]/15 bg-[#EDF2F6]/65 text-[#041A29] hover:border-[#005F96] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: dom.accentHex }}
                        />
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            active ? "text-[#F8D86F]" : "text-[#041A29]/45"
                          }`}
                        >
                          3 casos
                        </span>
                      </div>
                      <span className="mt-2 block text-sm font-black leading-tight">
                        {dom.shortTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-black text-[#041A29]">
                  {activeDomain.title}
                </h2>
                <span className="text-xs text-[#041A29]/65">{activeDomain.summary}</span>
              </div>

              <div
                role="radiogroup"
                aria-label={`Factores de ${activeDomain.title}`}
                className="divide-y divide-[#041A29]/10 overflow-hidden rounded-lg border border-[#041A29]/15"
              >
                {activeDomain.subtypes.map((sub) => {
                  const selected = sub.id === subtypeId;
                  return (
                    <button
                      key={sub.id}
                      role="radio"
                      aria-checked={selected}
                      type="button"
                      onClick={() => setSubtypeId(sub.id)}
                      className={`flex min-h-[76px] w-full items-start justify-between gap-4 p-4 text-left transition ${
                        selected ? "bg-[#005F96]/[0.07]" : "bg-white hover:bg-[#EDF2F6]/55"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                            selected
                              ? "border-[#005F96] bg-[#005F96] text-white"
                              : "border-[#041A29]/30 bg-white"
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.8} />}
                        </span>
                        <div>
                          <span className="block text-sm font-black text-[#041A29] sm:text-base">
                            {sub.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[#041A29]/70">
                            {sub.description}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${
                          sub.defaultPriority === "alta"
                            ? "bg-[#C84023]/12 text-[#9F2D15]"
                            : sub.defaultPriority === "media"
                            ? "bg-[#C98206]/15 text-[#7C4F00]"
                            : "bg-[#16794A]/12 text-[#115E39]"
                        }`}
                      >
                        {sub.defaultPriority === "alta"
                          ? "Prioridad alta"
                          : sub.defaultPriority === "media"
                          ? "Prioridad media"
                          : "Verificación"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 border-t border-[#041A29]/10 pt-6">
                <p className="mb-3 text-sm font-bold text-[#041A29]">¿Quién realiza este reporte?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {REPORTER_PROFILES.map((p) => {
                    const active = perfil === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPerfil(p.id)}
                        className={`min-h-[46px] rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                          active
                            ? "border-[#005F96] bg-[#005F96] text-white"
                            : "border-[#041A29]/15 bg-white text-[#041A29] hover:border-[#005F96]"
                        }`}
                      >
                        <span className="block font-black">{p.label}</span>
                        <span
                          className={`block text-[11px] ${
                            active ? "text-white/80" : "text-[#041A29]/55"
                          }`}
                        >
                          {p.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {perfil === "estudiante_escuela" && (
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Institución educativa (ej. I.E. Técnica Agropecuaria de Juan de Acosta)"
                    className="mt-3 min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/60 px-4 text-sm font-bold text-[#041A29]"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="group mt-7 flex min-h-[54px] w-full items-center justify-between rounded-lg bg-[#005F96] px-6 text-sm font-black text-white transition hover:bg-[#041A29]"
              >
                <span>Continuar a fotografía · {activeSubtype.label}</span>
                <ArrowRight className="h-4 w-4 text-[#F8D86F] transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </section>
        )}

        {/* PASO 2: VISOR FOTOGRÁFICO EXIF + FILTRO IA ANTI-ALUCINACIÓN + BANCO DE PRUEBA DATASET */}
        {step === 2 && (
          <section className="overflow-hidden rounded-xl border border-[#041A29]/12 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#041A29]/10 bg-[#EDF2F6]/65 px-6 py-3.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-[#041A29]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeDomain.accentHex }}
                />
                <span>{activeDomain.title}</span>
                <span className="text-[#041A29]/40">/</span>
                <span className="font-black text-[#005F96]">{activeSubtype.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-bold text-[#005F96] underline"
              >
                Cambiar factor
              </button>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-black text-[#041A29] sm:text-3xl">
                    Evidencia fotográfica con filtro visual IA
                  </h1>
                  <p className="mt-1 text-sm text-[#041A29]/70">
                    Conservamos el EXIF original (+25 pts) y verificamos automáticamente que la foto corresponda a un manglar real y no a un falso positivo.
                  </p>
                </div>

                {datasetSamples.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDatasetBank((v) => !v)}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#041A29]/20 bg-[#EDF2F6] px-3.5 text-xs font-black text-[#041A29] transition hover:border-[#005F96]"
                  >
                    <Database className="h-4 w-4 text-[#005F96]" />
                    <span>
                      {showDatasetBank
                        ? "Cerrar dataset de prueba"
                        : `Probar con dataset (${datasetSamples.length} fotos)`}
                    </span>
                  </button>
                )}
              </div>

              {/* Banco interactivo de dataset real para pruebas en salón */}
              {showDatasetBank && datasetSamples.length > 0 && (
                <div className="rounded-xl border border-[#041A29]/15 bg-[#EDF2F6]/70 p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-black text-[#041A29]">
                      Banco de fotografías reales de campo (incluye prueba negativa de interior para demostrar el filtro anti-falsos)
                    </p>
                    <span className="font-mono text-[11px] text-[#041A29]/60">
                      Wikimedia Commons · Licencia abierta
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                    {datasetSamples.map((sample) => {
                      const isNegative = sample.domain === "invalida";
                      return (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => handleSelectDatasetSample(sample)}
                          className={`group overflow-hidden rounded-lg border bg-white text-left transition hover:border-[#005F96] ${
                            isNegative ? "border-[#C84023]/45" : "border-[#041A29]/15"
                          }`}
                        >
                          <div className="relative h-24 w-full overflow-hidden bg-[#041A29]">
                            <img
                              src={sample.src}
                              alt={sample.label}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            {isNegative && (
                              <span className="absolute left-1.5 top-1.5 rounded bg-[#C84023] px-1.5 py-0.5 font-mono text-[9px] font-black text-white">
                                NO VÁLIDA
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-2 p-2 text-[11px] font-bold leading-tight text-[#041A29]">
                            {sample.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!photoPreview ? (
                <label className="relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#EDB512]/65 bg-[#041A29] p-8 text-center text-white transition hover:bg-[#082438]">
                  <span className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-[#EDB512]/80" />
                  <span className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-[#EDB512]/80" />
                  <span className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-[#EDB512]/80" />
                  <span className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-[#EDB512]/80" />

                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-[#EDB512] text-[#041A29]">
                    <Camera className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <span className="font-display text-lg font-black text-white">
                    Abrir cámara o elegir fotografía
                  </span>
                  <span className="mt-1.5 max-w-md text-xs text-white/70">
                    Si subes una foto ajena al manglar (interior, selfie o pantalla), el filtro visual IA la detecta y protege el Semáforo CRA.
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
                <div className="relative overflow-hidden rounded-xl border border-[#041A29]/15 bg-[#041A29]">
                  <img
                    src={photoPreview}
                    alt="Evidencia capturada en campo"
                    className="h-72 w-full object-cover"
                  />
                  {photoFromDataset && (
                    <span className="absolute left-3 top-3 rounded bg-[#041A29]/85 px-2.5 py-1 font-mono text-[11px] font-bold text-[#F8D86F] backdrop-blur-sm">
                      DATASET PRUEBA · {photoFromDataset}
                    </span>
                  )}
                  {aiLoading && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#005F96]/25">
                      <div className="animate-scan h-14 w-full bg-gradient-to-b from-transparent via-[#F8D86F]/75 to-transparent" />
                    </div>
                  )}
                  <label className="absolute bottom-3 right-3 inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg bg-[#041A29]/90 px-4 text-xs font-black text-white backdrop-blur-sm hover:bg-[#005F96]">
                    <Camera className="h-3.5 w-3.5 text-[#F8D86F]" />
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

              {/* Resultado del filtro visual IA (rechazo honesto, alerta de desajuste o confirmación) */}
              {(aiLoading || aiResult) && (
                <div
                  className={`rounded-xl border p-4 text-xs ${
                    aiLoading
                      ? "border-[#005F96]/25 bg-[#EDF2F6]"
                      : aiPhotoValid === false
                      ? "border-[#C84023]/45 bg-[#C84023]/10"
                      : aiCategoryMismatch
                      ? "border-[#C98206]/45 bg-[#EDB512]/15"
                      : "border-[#16794A]/35 bg-[#16794A]/10"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-black">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        aiLoading
                          ? "text-[#005F96]"
                          : aiPhotoValid === false
                          ? "text-[#9F2D15]"
                          : aiCategoryMismatch
                          ? "text-[#7C4F00]"
                          : "text-[#115E39]"
                      }`}
                    >
                      {aiLoading ? (
                        <Sparkles className="h-4 w-4" />
                      ) : aiPhotoValid === false ? (
                        <XCircle className="h-4 w-4" />
                      ) : aiCategoryMismatch ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}

                      {aiLoading
                        ? "Auditando píxeles con IA multimodal..."
                        : aiPhotoValid === false
                        ? `Evidencia rechazada por filtro IA (0/25 pts) · ${String(aiResult?.model || "")}`
                        : aiCategoryMismatch
                        ? `Factor diferente detectado en la imagen · ${String(aiResult?.model || "")}`
                        : aiResult?.mode === "openrouter_live"
                        ? `Evidencia ambiental confirmada (+25 pts) · ${String(aiResult.model)}`
                        : "Preclasificación local offline"}
                    </span>
                  </div>

                  {aiResult && !aiLoading && (
                    <div className="mt-2 space-y-1.5 text-[#041A29]">
                      {Boolean(aiResult.que_muestra_la_foto) && (
                        <p className="text-xs text-[#041A29]/80">
                          <strong>Qué ve la IA:</strong> {String(aiResult.que_muestra_la_foto)}
                        </p>
                      )}
                      <p className="text-sm font-black">
                        {aiPhotoValid === false
                          ? String(
                              aiResult.motivo_rechazo ||
                                aiResult.clasificacion_tecnica ||
                                "La imagen no corresponde a un manglar ni a una presión ambiental."
                            )
                          : String(aiResult.clasificacion_tecnica || "")}
                      </p>
                      {Boolean(aiResult.resumen_tecnico) && aiPhotoValid !== false && (
                        <p className="text-xs text-[#041A29]/75">
                          {String(aiResult.resumen_tecnico)}
                        </p>
                      )}

                      {Boolean(aiResult.alerta_privacidad_rostros) && (
                        <p className="mt-1 rounded bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-[#9F2D15]">
                          Privacidad Ley 1581: se detectó un rostro humano en primer plano. Evita fotografiar personas y enfoca el ecosistema.
                        </p>
                      )}

                      {aiCategoryMismatch && Boolean(aiResult.subtipo_sugerido_label) && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/85 p-2.5">
                          <span>
                            La imagen coincide mejor con{" "}
                            <strong>{String(aiResult.subtipo_sugerido_label)}</strong>.
                          </span>
                          <button
                            type="button"
                            onClick={applyAiSuggestedSubtype}
                            className="min-h-[36px] rounded-md bg-[#041A29] px-3 text-xs font-black text-white hover:bg-[#005F96]"
                          >
                            Ajustar categoría
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="mb-2.5 text-sm font-bold text-[#041A29]">
                  Señales observadas en este factor (opcional, 1 toque):
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSubtype.quickTags.map((chip) => {
                    const selected = descripcion.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleChip(chip)}
                        className={`min-h-[40px] rounded-lg border px-3.5 text-xs font-bold transition ${
                          selected
                            ? "border-[#16794A] bg-[#16794A] text-white"
                            : "border-[#041A29]/15 bg-white text-[#041A29] hover:border-[#005F96]"
                        }`}
                      >
                        {selected ? "✓ " : "+ "}
                        {chip}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#041A29]/70">
                    Relato corto o dictado por voz (ideal con manos mojadas o para niños):
                  </span>
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 text-xs font-black transition ${
                      voiceListening
                        ? "bg-[#C84023] text-white"
                        : voiceSupported
                        ? "bg-[#041A29] text-white hover:bg-[#005F96]"
                        : "border border-[#041A29]/15 bg-[#EDF2F6] text-[#041A29]/60"
                    }`}
                  >
                    {voiceListening ? (
                      <>
                        <MicOff className="h-4 w-4" />
                        <span>Detener dictado...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 text-[#F8D86F]" />
                        <span>Dictar con tu voz</span>
                      </>
                    )}
                  </button>
                </div>

                {voiceStatus && (
                  <p className="mt-1.5 text-xs font-bold text-[#005F96]" role="status">
                    {voiceStatus}
                  </p>
                )}

                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Habla con el micrófono o escribe una referencia (ej. frente al muelle, junto al caño principal)..."
                  className="mt-2 w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-4 py-3 text-sm text-[#041A29]"
                />
              </div>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="group flex min-h-[54px] w-full items-center justify-between rounded-lg bg-[#005F96] px-6 text-sm font-black text-white transition hover:bg-[#041A29]"
              >
                <span>
                  {aiPhotoValid === false
                    ? "Continuar de todos modos (quedará marcado con 0/25 en foto)"
                    : photoPreview
                    ? "Continuar a ubicación en mapa"
                    : "Continuar sin fotografía"}
                </span>
                <ArrowRight className="h-4 w-4 text-[#F8D86F] transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </section>
        )}

        {/* PASO 3: GPS HONESTO + DEMO SATELITAL + CRUCE ESPACIAL + SEMÁFORO */}
        {step === 3 && (
          <section className="overflow-hidden rounded-xl border border-[#041A29]/12 bg-white">
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-black text-[#041A29] sm:text-3xl">
                    Confirma la ubicación en la costa
                  </h1>
                  <p className="mt-1 text-sm text-[#041A29]/70">
                    Cruzamos tus coordenadas contra las capas del Plan de Manejo y las 828 ha por revisar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={requestRealGps}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#041A29] px-4 text-xs font-black text-white transition hover:bg-[#005F96]"
                >
                  <LocateFixed className="h-4 w-4 text-[#F8D86F]" />
                  Detectar GPS real
                </button>
              </div>

              {gpsError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#C84023]/35 bg-[#C84023]/10 p-3.5 text-xs font-bold text-[#041A29]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C84023]" />
                  <span>{gpsError}</span>
                </div>
              )}

              <CraMap
                reports={[]}
                layersVisible={{
                  priorities: false,
                  manglarProbable: true,
                  porRevisar: true,
                  doselSeco: true,
                  groundTruth: false,
                  reports: false,
                }}
                onPickPoint={handlePickMap}
                pickedPoint={lat != null && lon != null ? { lat, lon } : null}
                flyToTarget={lat != null && lon != null ? { lat, lon, zoom: 13 } : null}
                heightClass="h-[260px]"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#041A29]/12 bg-[#EDF2F6] px-4 py-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#041A29]">
                  <MapPin className="h-4 w-4 text-[#005F96]" />
                  <span>{gpsStatus}</span>
                  {lat != null && lon != null && (
                    <span className="font-mono text-[#041A29]/65">
                      ({lat.toFixed(5)}, {lon.toFixed(5)})
                    </span>
                  )}
                </div>
                {isSimulatedGps && (
                  <span className="rounded bg-[#EDB512] px-2.5 py-1 font-mono text-[11px] font-black text-[#041A29]">
                    SIMULADO (DEMO)
                  </span>
                )}
              </div>

              <div>
                <p className="mb-2.5 text-xs font-bold text-[#041A29]/75">
                  ¿En presentación en salón sin GPS exterior? Simula uno de los 4 sectores oficiales CRA (quedará marcado como{" "}
                  <strong>SIMULADO (DEMO)</strong>):
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {DEMO_FIELD_POINTS.map((pt) => {
                    const selected =
                      isSimulatedGps && lat === pt.lat && lon === pt.lon;
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => handleDemoPoint(pt.id)}
                        className={`flex items-center gap-3 overflow-hidden rounded-lg border p-2 text-left transition ${
                          selected
                            ? "border-[#005F96] bg-[#005F96]/10"
                            : "border-[#041A29]/15 bg-white hover:border-[#005F96]"
                        }`}
                      >
                        <img
                          src={pt.satImage}
                          alt={pt.municipio}
                          className="h-14 w-16 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-black text-[#041A29]">
                            {pt.municipio}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#041A29]/70">
                            {pt.contextNote}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {spatialCtx && (
                <div className="space-y-4 rounded-xl border border-[#041A29]/12 bg-[#EDF2F6]/65 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#041A29]/10 pb-3">
                    <div>
                      <p className="text-xs font-bold text-[#005F96]">
                        Cruce espacial instantáneo (Offline + PostGIS)
                      </p>
                      <p className="font-display text-lg font-black text-[#041A29]">
                        {spatialCtx.sector.nombre}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                      {spatialCtx.kmzAccionPlan && (
                        <span className="rounded bg-[#005F96] px-2.5 py-1 text-white">
                          Plan: {spatialCtx.kmzAccionPlan}
                        </span>
                      )}
                      {spatialCtx.inPorRevisar828Ha && (
                        <span className="rounded bg-[#EDB512] px-2.5 py-1 text-[#041A29]">
                          En 828 ha por revisar
                        </span>
                      )}
                      {spatialCtx.inDoselSeco2026 && (
                        <span className="rounded bg-[#C84023] px-2.5 py-1 text-white">
                          Dosel seco 2026
                        </span>
                      )}
                    </div>
                  </div>

                  <ReliabilityMeter
                    score={reliabilityPreview.score}
                    breakdown={reliabilityPreview}
                  />

                  <button
                    type="button"
                    onClick={() => setShowTechDetails((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#005F96] hover:underline"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showTechDetails ? "rotate-180" : ""
                      }`}
                    />
                    {showTechDetails
                      ? "Ocultar trazabilidad EXIF y Ground-Truth"
                      : "Ver trazabilidad EXIF y Ground-Truth CRA"}
                  </button>

                  {showTechDetails && (
                    <div className="grid gap-3 rounded-lg border border-[#041A29]/10 bg-white p-3.5 text-xs sm:grid-cols-2">
                      <div>
                        <p className="font-black text-[#041A29]">Metadatos EXIF preservados</p>
                        <p className="mt-1 text-[#041A29]/75">
                          {exifInfo
                            ? `Archivo original ${Math.round(Number(exifInfo.originalBytes || 0) / 1024)} KB · Cámara: ${String(
                                exifInfo.make || "Estándar"
                              )} ${String(exifInfo.model || "")}`
                            : "Sin fotografía adjunta"}
                        </p>
                      </div>
                      <div>
                        <p className="font-black text-[#041A29]">Punto Ground-Truth CRA más cercano</p>
                        <p className="mt-1 text-[#041A29]/75">
                          {spatialCtx.nearestGroundTruth
                            ? `#${spatialCtx.nearestGroundTruth.pointId} a ${spatialCtx.nearestGroundTruth.distMeters} m (${
                                spatialCtx.nearestGroundTruth.esManglar
                                  ? "Consenso manglar"
                                  : spatialCtx.nearestGroundTruth.clase
                              })`
                            : "Sin punto cercano en caché"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-[#EDB512] px-6 text-base font-black text-[#041A29] transition hover:bg-[#F8D86F] disabled:opacity-60"
              >
                {submitting ? (
                  <span>Enviando reporte a la CRA...</span>
                ) : typeof navigator !== "undefined" && !navigator.onLine ? (
                  <>
                    <WifiOff className="h-5 w-5" />
                    <span>Guardar en modo offline</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Enviar reporte verificado a la CRA</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function ReportarPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12 text-center text-sm font-bold text-[#005F96]">
          Preparando formulario de campo...
        </div>
      }
    >
      <ReportarContent />
    </Suspense>
  );
}
