"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import exifr from "exifr";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Sparkles,
  Trees,
  WifiOff,
} from "lucide-react";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";
import {
  DEMO_FIELD_POINTS,
  EVENT_CATEGORIES,
  QR_STATIONS,
  REPORTER_PROFILES,
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

  const [tipoEvento, setTipoEvento] = useState<EventTypeId>("cambio_hidrico");
  const [perfil, setPerfil] = useState<ReporterProfileId>(initialProfile);
  const [schoolName, setSchoolName] = useState(initialSchool);
  const [qrStationId, setQrStationId] = useState(initialStation);
  const [descripcion, setDescripcion] = useState("");

  // Evidencia foto original (EXIF intacto) + preview comprimida
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [exifInfo, setExifInfo] = useState<Record<string, unknown> | null>(null);

  // IA preclasificación
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);

  // GPS honesto o modo demo salón
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [precisionM, setPrecisionM] = useState<number | null>(null);
  const [isSimulatedGps, setIsSimulatedGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("Esperando lectura GPS real del dispositivo...");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [spatialCtx, setSpatialCtx] = useState<OfflineSpatialContext | null>(null);

  // Envío y comprobante
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    trackingCode: string;
    offline: boolean;
    score: number;
    zona: string;
  } | null>(null);

  // Precargar estación QR si viene por parámetro
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
      setGpsError("Tu navegador no soporta geolocalización. Usa el selector de Demo si estás en salón.");
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
          acc <= 25
            ? `GPS real preciso (±${acc} m)`
            : `GPS real aproximado (±${acc} m)`
        );
        const ctx = await analyzeLocationOffline(nextLat, nextLon);
        setSpatialCtx(ctx);
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Permiso de ubicación denegado — actívalo o usa el Modo Demo Salón si estás presentando."
            : err.code === 2
            ? "Sin señal GPS en interior — sal a cielo abierto o activa Modo Demo Salón."
            : "Tiempo agotado buscando GPS — reintenta o usa Modo Demo Salón.";
        setGpsError(msg);
        setGpsStatus("Sin coordenada GPS real");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    if (!initialStation) {
      requestRealGps();
    }
  }, [initialStation]);

  const handleDemoPoint = async (pointId: string) => {
    const pt = DEMO_FIELD_POINTS.find((p) => p.id === pointId);
    if (!pt) return;
    setLat(pt.lat);
    setLon(pt.lon);
    setPrecisionM(12);
    setIsSimulatedGps(true);
    setGpsError(null);
    setGpsStatus(`SIMULADO (DEMO): ${pt.label}`);
    const ctx = await analyzeLocationOffline(pt.lat, pt.lon);
    setSpatialCtx(ctx);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);

    // Extraer EXIF del archivo original sin destruir metadatos
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
              exifLat: parsed.latitude ?? null,
              exifLon: parsed.longitude ?? null,
              originalBytes: file.size,
            }
          : { originalBytes: file.size, hasGpsExif: false }
      );
    } catch {
      setExifInfo({ originalBytes: file.size, hasGpsExif: false });
    }

    const preview = await compressForPreview(file);
    setPhotoPreview(preview);

    // Llamar asistente IA si hay red (o fallback local)
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
      if (res.ok) {
        const aiJson = await res.json();
        setAiResult(aiJson);
      }
    } catch {
      setAiResult({
        mode: "offline_queued",
        clasificacion_tecnica:
          EVENT_CATEGORIES.find((c) => c.id === tipoEvento)?.technicalHint ||
          "Clasificación diferida al sincronizar",
        severidad: "media",
        resumen_tecnico: "Sin conexión en terreno: la foto original se analizará automáticamente al recuperar señal.",
      });
    } finally {
      setAiLoading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lat == null || lon == null) {
      setGpsError("Necesitas una coordenada GPS real (o elegir un punto en Modo Demo Salón) antes de enviar.");
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
          accion_plan: spatialCtx?.kmzAccionPlan || (spatialCtx?.fueraDeZonificacion ? "Fuera de zonificación (221 ha)" : null),
          en_zona_por_revisar: Boolean(spatialCtx?.inPorRevisar828Ha),
          tipo_evento: tipoEvento,
          descripcion_ciudadana: descripcion,
          perfil_reportante: perfil,
          school_name: perfil === "estudiante_escuela" ? schoolName || "Escuela del Atlántico" : undefined,
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
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <div className="bezel-outer">
          <div className="bezel-inner p-7 text-center sm:p-10">
            <div
              className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                receipt.offline ? "bg-[#F8D86F]/40 text-[#08334C]" : "bg-[#1F7A4C]/15 text-[#1F7A4C]"
              }`}
            >
              {receipt.offline ? <WifiOff className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
            </div>

            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005F96]">
              {receipt.offline
                ? "Guardado en cola offline (IndexedDB)"
                : "Sincronizado en vivo con la CRA"}
            </p>
            <h1 className="font-display mt-2 text-3xl font-black text-[#08334C]">
              Código {receipt.trackingCode}
            </h1>
            <p className="mt-3 text-sm text-[#08334C]/80">
              Sector detectado: <strong>{receipt.zona}</strong> · Semáforo inicial:{" "}
              <strong className="tabular-nums">{receipt.score}/100 pts</strong>.
            </p>
            {receipt.offline && (
              <p className="mt-2 rounded-2xl bg-[#F8D86F]/30 p-3 text-xs font-bold text-[#08334C]">
                Apenas recuperes internet, tu foto original (con EXIF) y coordenadas subirán automáticamente sin perder nada.
              </p>
            )}

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setReceipt(null);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setAiResult(null);
                  setDescripcion("");
                }}
                className="min-h-[48px] rounded-full bg-[#005F96] px-6 py-2.5 text-sm font-black text-white"
              >
                Enviar otro reporte
              </button>
              <Link
                href="/cra"
                className="inline-flex min-h-[48px] items-center rounded-full border border-[#08334C]/15 bg-[#F7F3EA] px-6 py-2.5 text-sm font-bold text-[#08334C]"
              >
                Ver en Panel CRA →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 md:pt-8">
      <OfflineSyncBanner />

      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005F96]">
          Captura ciudadana offline-first · menos de 1 minuto
        </p>
        <h1 className="font-display mt-1 text-3xl font-black text-[#08334C] sm:text-4xl">
          Reportar amenaza o verificar manglar
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PASO 1 */}
        <section className="bezel-outer">
          <div className="bezel-inner p-5 sm:p-7">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#005F96] text-xs font-black text-white">
                1
              </span>
              <h2 className="font-display text-xl font-bold text-[#08334C]">
                ¿Qué está pasando en el manglar?
              </h2>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {EVENT_CATEGORIES.map((cat) => {
                const active = tipoEvento === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTipoEvento(cat.id)}
                    className={`min-h-[60px] rounded-2xl border p-3.5 text-left transition-all ${
                      active
                        ? "border-[#005F96] bg-[#005F96]/8 ring-2 ring-[#005F96]/25"
                        : "border-[#08334C]/12 bg-[#F7F3EA]/60 hover:bg-[#F7F3EA]"
                    }`}
                  >
                    <span className="block text-sm font-black text-[#08334C]">{cat.label}</span>
                    <span className="mt-0.5 block text-xs text-[#08334C]/70">{cat.shortDesc}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#08334C]/70">
                  ¿Quién reporta?
                </label>
                <select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value as ReporterProfileId)}
                  className="min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm font-bold text-[#08334C]"
                >
                  {REPORTER_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.hint}
                    </option>
                  ))}
                </select>
              </div>

              {perfil === "estudiante_escuela" && (
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#08334C]/70">
                    Institución educativa
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ej. I.E. Técnica de Juan de Acosta"
                    className="min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm text-[#08334C]"
                  />
                </div>
              )}

              <div className={perfil === "estudiante_escuela" ? "sm:col-span-2" : ""}>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#08334C]/70">
                  Descripción breve (opcional)
                </label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Caño tapado con sedimentos y hojas secas..."
                  className="min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm text-[#08334C]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* PASO 2 */}
        <section className="bezel-outer">
          <div className="bezel-inner p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#005F96] text-xs font-black text-white">
                  2
                </span>
                <h2 className="font-display text-xl font-bold text-[#08334C]">
                  Evidencia fotográfica (EXIF intacto) + IA
                </h2>
              </div>
              <span className="rounded-full bg-[#1F7A4C]/10 px-3 py-1 text-[11px] font-black text-[#1F7A4C]">
                +25 pts Confiabilidad
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#005F96]/35 bg-[#F7F3EA] p-5 text-center transition hover:border-[#005F96]">
                <Camera className="mb-2 h-8 w-8 text-[#005F96]" strokeWidth={1.6} />
                <span className="text-sm font-black text-[#08334C]">
                  {photoFile ? `Foto lista: ${photoFile.name}` : "Tomar foto o subir imagen"}
                </span>
                <span className="mt-1 text-xs text-[#08334C]/70">
                  Se preserva el archivo original con metadatos EXIF probatorios
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>

              {photoPreview ? (
                <div className="overflow-hidden rounded-2xl border border-[#08334C]/12 bg-white">
                  <img src={photoPreview} alt="Vista previa" className="h-44 w-full object-cover" />
                  <div className="p-3 text-xs">
                    <p className="font-bold text-[#1F7A4C]">
                      Archivo original preservado ({Math.round((photoFile?.size || 0) / 1024)} KB)
                    </p>
                    {exifInfo?.model ? (
                      <p className="text-[#08334C]/70">
                        EXIF: {String(exifInfo.make || "")} {String(exifInfo.model)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-center rounded-2xl bg-[#F7F3EA]/70 p-4 text-xs text-[#08334C]/75">
                  <p className="font-black text-[#08334C]">¿Cómo ayuda la IA aquí?</p>
                  <p className="mt-1">
                    Al cargar tu fotografía, nuestro asistente con OpenRouter (o motor local si estás en modo avión) sugiere la clasificación técnica académica para acelerar el trabajo de los mentores y de la CRA.
                  </p>
                </div>
              )}
            </div>

            {(aiLoading || aiResult) && (
              <div className="mt-4 rounded-2xl border border-[#005F96]/20 bg-[#005F96]/6 p-4 text-xs">
                <div className="flex items-center gap-2 font-black text-[#005F96]">
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {aiLoading
                      ? "Analizando fotografía con asistente IA..."
                      : `Sugerencia IA (${String(aiResult?.mode || "local")})`}
                  </span>
                </div>
                {aiResult && !aiLoading && (
                  <div className="mt-1.5 space-y-1 text-[#08334C]">
                    <p>
                      <strong>Clasificación técnica:</strong>{" "}
                      {String(aiResult.clasificacion_tecnica || "")}
                    </p>
                    <p className="text-[#08334C]/80">{String(aiResult.resumen_tecnico || "")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* PASO 3 */}
        <section className="bezel-outer">
          <div className="bezel-inner p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#005F96] text-xs font-black text-white">
                  3
                </span>
                <h2 className="font-display text-xl font-bold text-[#08334C]">
                  Ubicación honesta y cruce inmediato CRA
                </h2>
              </div>

              <button
                type="button"
                onClick={requestRealGps}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#005F96]/30 bg-white px-3.5 py-1.5 text-xs font-black text-[#005F96] hover:bg-[#005F96]/5"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Capturar GPS real
              </button>
            </div>

            {gpsError && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[#D94E2A]/30 bg-[#D94E2A]/10 p-3.5 text-xs font-bold text-[#08334C]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D94E2A]" />
                <span>{gpsError}</span>
              </div>
            )}

            <div className="rounded-2xl bg-[#F7F3EA] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#08334C]/60">
                    Estado GPS
                  </p>
                  <p className="text-sm font-black text-[#08334C]">{gpsStatus}</p>
                </div>
                {lat != null && lon != null && (
                  <div className="flex items-center gap-2">
                    {isSimulatedGps && (
                      <span className="rounded-full bg-[#EDB512] px-3 py-1 text-[11px] font-black text-[#08334C]">
                        SIMULADO (DEMO)
                      </span>
                    )}
                    <span className="tabular-nums rounded-full bg-white px-3 py-1 text-xs font-bold text-[#005F96]">
                      {lat}, {lon}
                    </span>
                  </div>
                )}
              </div>

              {/* Selector explícito Modo Demo para presentación ante jurado en salón */}
              <div className="mt-3 border-t border-[#08334C]/10 pt-3">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#08334C]/65">
                  Modo Demo Salón (para demostraciones en recinto cerrado — se etiqueta SIMULADO):
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_FIELD_POINTS.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => handleDemoPoint(pt.id)}
                      className="rounded-full border border-[#08334C]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#08334C] transition hover:border-[#005F96] hover:text-[#005F96]"
                    >
                      <MapPin className="mr-1 inline h-3 w-3 text-[#EDB512]" />
                      {pt.municipio}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado instantáneo del cruce espacial offline */}
            {spatialCtx && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[#1F7A4C]/25 bg-[#1F7A4C]/8 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
                    Cruce espacial automático (funciona offline)
                  </p>
                  <p className="mt-1 text-sm font-black text-[#08334C]">
                    Sector: {spatialCtx.sector.nombre}
                  </p>
                  <p className="mt-1 text-xs text-[#08334C]/80">
                    Plan de Manejo CRA:{" "}
                    <strong>
                      {spatialCtx.kmzAccionPlan ||
                        (spatialCtx.fueraDeZonificacion
                          ? "Fuera de zonificación (221 ha)"
                          : "Zona costera Atlántico")}
                    </strong>{" "}
                    {spatialCtx.kmzPrioridad ? `· Prioridad ${spatialCtx.kmzPrioridad}` : ""}
                  </p>
                  {spatialCtx.kmzMicrocuenca && (
                    <p className="text-xs text-[#08334C]/75">
                      Microcuenca KMZ: {spatialCtx.kmzMicrocuenca}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {spatialCtx.inPorRevisar828Ha && (
                      <span className="rounded-full bg-[#EDB512] px-2.5 py-0.5 font-black text-[#08334C]">
                        Dentro de 828 ha por revisar
                      </span>
                    )}
                    {spatialCtx.inDoselSeco2026 && (
                      <span className="rounded-full bg-[#D94E2A] px-2.5 py-0.5 font-black text-white">
                        Dosel seco 2026
                      </span>
                    )}
                    {spatialCtx.inManglarProbable && (
                      <span className="rounded-full bg-[#1F7A4C] px-2.5 py-0.5 font-black text-white">
                        Manglar probable
                      </span>
                    )}
                  </div>
                  {spatialCtx.nearestGroundTruth && (
                    <p className="text-[#08334C]/80">
                      Ground-Truth CRA más cercano: punto #{spatialCtx.nearestGroundTruth.pointId} a{" "}
                      <strong className="tabular-nums">
                        {spatialCtx.nearestGroundTruth.distMeters} m
                      </strong>{" "}
                      ({spatialCtx.nearestGroundTruth.esManglar ? "Consenso manglar" : "Contraste"})
                    </p>
                  )}
                  <p className="font-black text-[#005F96]">
                    Semáforo preliminar: {reliabilityPreview.score}/100 pts ({reliabilityPreview.tier})
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-[#08334C]/70">
            Al enviar se asignará un código público de seguimiento sin exponer datos personales sensibles (Ley 1581 de 2012).
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="group inline-flex min-h-[54px] items-center gap-3 rounded-full bg-[#005F96] py-2 pl-7 pr-2 text-sm font-black text-white shadow-lg shadow-[#005F96]/25 transition hover:bg-[#08334C] disabled:opacity-60"
          >
            <span>{submitting ? "Guardando reporte..." : "Enviar reporte ciudadano"}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDB512] text-[#08334C]">
              <Trees className="h-4 w-4" />
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ReportarPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-8 text-sm font-bold">Cargando estación de captura...</div>}>
      <ReportarContent />
    </Suspense>
  );
}
