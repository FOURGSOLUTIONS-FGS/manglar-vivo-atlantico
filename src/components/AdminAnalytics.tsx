"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Flame,
  Layers,
  Mail,
  Radio,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { classifyAlert } from "@/core/alerts/classifier";
import type { AlertLevel } from "@/core/alerts/types";
import { CRA_GLOBAL_METRICS, CRA_SECTORS, FACTOR_DOMAINS, REPORTER_PROFILES } from "@/lib/cra-domain";
import type { MapReportItem } from "@/components/CraMap";

const CraMap = dynamic(() => import("@/components/CraMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] items-center justify-center rounded-xl border border-white/15 bg-[#082438] text-sm font-bold text-[#F8D86F]">
      Cargando mapa histórico...
    </div>
  ),
});

export interface AnalyticsReport {
  id: string;
  tracking_code: string;
  timestamp_captura: string;
  latitud: number;
  longitud: number;
  zona_manglar: string;
  municipio: string;
  sector_id: number;
  tipo_evento: string;
  descripcion_ciudadana: string;
  evidencia_exif: Record<string, unknown> | null;
  perfil_reportante: string;
  qr_station_id?: string | null;
  estado_validacion: string;
  attention_status: string;
  nivel_prioridad: string;
  puntaje_confiabilidad: number;
  en_zona_por_revisar: boolean;
  is_simulated_gps: boolean;
  ai_classification: Record<string, unknown> | null;
  validations?: Array<{
    created_at: string;
    validator_role: string;
    validator_name: string;
    decision: string;
  }>;
}

export interface AnalyticsDispatch {
  id: string;
  tracking_code: string;
  alert_level: AlertLevel;
  channel: string;
  status: string;
  created_at: string;
}

const LEVEL_META: Record<AlertLevel, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "#C84023" },
  alta: { label: "Prioritaria", color: "#C98206" },
  media: { label: "Revisión", color: "#2B8CC4" },
  verificacion: { label: "828 ha sanas", color: "#16794A" },
};
const LEVEL_ORDER: AlertLevel[] = ["urgente", "alta", "media", "verificacion"];

const TIPO_TO_DOMAIN: Record<string, string> = {
  tala_relleno: "cobertura_suelo",
  cambio_hidrico: "agua_dosel",
  contaminacion_residuos: "contaminacion",
  dano_fauna_especies: "fauna_verificacion",
  otro: "fauna_verificacion",
};

const HOUR = 3600e3;
const DAY = 24 * HOUR;

function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < HOUR) return `hace ${Math.max(1, Math.round(diff / 60000))} min`;
  if (diff < DAY) return `hace ${Math.round(diff / HOUR)} h`;
  return `hace ${Math.round(diff / DAY)} d`;
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function AdminAnalytics({
  reports,
  dispatches,
  liveConnected,
  onJumpToBandeja,
  onFocusSector,
}: {
  reports: AnalyticsReport[];
  dispatches: AnalyticsDispatch[];
  liveConnected: boolean;
  onJumpToBandeja?: (opts: { query?: string; level?: "all" | AlertLevel }) => void;
  onFocusSector?: (sectorId: number) => void;
}) {
  const [range, setRange] = useState<7 | 30 | 90>(90);
  const [sectorFilter, setSectorFilter] = useState<number | "all">("all");
  const [deployedSectors, setDeployedSectors] = useState<number[]>([3, 1]);
  const [nasaFires, setNasaFires] = useState<{
    source: string;
    fetchedAt: string;
    totalSouthAmericaScanned: number;
    atlanticoCount: number;
    caribeCount: number;
    atlantico: Array<{
      id: string;
      latitude: number;
      longitude: number;
      brightnessK: number;
      frpMw: number;
      confidence: string;
      satellite: string;
      acqDate: string;
      acqTimeUtc: string;
      nearestSectorName: string;
      distanceToMangroveKm: number;
      riskTier: string;
    }>;
    caribe: Array<{
      id: string;
      latitude: number;
      longitude: number;
      brightnessK: number;
      frpMw: number;
      confidence: string;
      satellite: string;
      acqDate: string;
      acqTimeUtc: string;
      nearestSectorName: string;
      distanceToMangroveKm: number;
      riskTier: string;
    }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/nasa-fires")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setNasaFires(d);
      })
      .catch(() => {});
  }, []);

  const now = useMemo(() => Date.now(), [reports, dispatches, range]);

  const enriched = useMemo(() => {
    return reports.map((r) => {
      const exif = r.evidencia_exif ?? null;
      const ai = r.ai_classification ?? null;
      const subtype = typeof exif?.subtipo_evento === "string" ? exif.subtipo_evento : null;
      const subtypeLabel =
        typeof exif?.subtipo_label === "string" ? exif.subtipo_label : r.tipo_evento;
      const domain =
        typeof exif?.factor_dominio === "string"
          ? exif.factor_dominio
          : TIPO_TO_DOMAIN[r.tipo_evento] || "fauna_verificacion";
      const cls = classifyAlert({
        trackingCode: r.tracking_code,
        tipoEvento: r.tipo_evento,
        subtipoEvento: subtype,
        zonaManglar: r.zona_manglar,
        municipio: r.municipio,
        enZonaPorRevisar: r.en_zona_por_revisar,
        nivelPrioridad: r.nivel_prioridad,
        puntajeConfiabilidad: r.puntaje_confiabilidad,
        estadoValidacion: r.estado_validacion,
        latitud: Number(r.latitud),
        longitud: Number(r.longitud),
        aiPhotoValid:
          ai && typeof ai.es_evidencia_valida === "boolean" ? ai.es_evidencia_valida : null,
      });
      const ts = new Date(r.timestamp_captura).getTime();
      const valTimes = (r.validations || [])
        .map((v) => new Date(v.created_at).getTime())
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
      const firstValHours = valTimes.length > 0 ? (valTimes[0] - ts) / HOUR : null;
      return { r, ts, cls, domain, subtypeLabel, firstValHours };
    });
  }, [reports]);

  const scoped = useMemo(
    () => enriched.filter((x) => sectorFilter === "all" || x.r.sector_id === sectorFilter),
    [enriched, sectorFilter]
  );

  const current = useMemo(
    () => scoped.filter((x) => now - x.ts <= range * DAY),
    [scoped, now, range]
  );
  const previous = useMemo(
    () => scoped.filter((x) => now - x.ts > range * DAY && now - x.ts <= 2 * range * DAY),
    [scoped, now, range]
  );

  // KPIs
  const total = current.length;
  const trendPct =
    previous.length > 0 ? Math.round(((total - previous.length) / previous.length) * 100) : null;
  const validatedCount = current.filter(
    (x) =>
      ["validado_comunitario", "validado_academico", "alerta_oficial_cra"].includes(
        x.r.estado_validacion
      ) || x.r.attention_status === "atendido"
  ).length;
  const avgScore =
    total > 0 ? Math.round(current.reduce((s, x) => s + x.r.puntaje_confiabilidad, 0) / total) : 0;
  const withVal = current.filter((x) => x.firstValHours != null && x.firstValHours >= 0);
  const avgFirstVal =
    withVal.length > 0
      ? withVal.reduce((s, x) => s + (x.firstValHours as number), 0) / withVal.length
      : NaN;
  const slaOk = withVal.filter((x) => (x.firstValHours as number) <= x.cls.slaHours).length;
  const slaPct = withVal.length > 0 ? Math.round((slaOk / withVal.length) * 100) : 0;
  const attended = current.filter((x) => x.r.attention_status === "atendido").length;

  // Serie temporal apilada por nivel
  const bucketCount = range === 90 ? 13 : range;
  const bucketMs = range === 90 ? 7 * DAY : DAY;
  const start = now - bucketCount * bucketMs;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: start + i * bucketMs,
    counts: { urgente: 0, alta: 0, media: 0, verificacion: 0 } as Record<AlertLevel, number>,
  }));
  current.forEach((x) => {
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((x.ts - start) / bucketMs)));
    buckets[idx].counts[x.cls.level] += 1;
  });
  const maxBucket = Math.max(
    1,
    ...buckets.map((b) => LEVEL_ORDER.reduce((s, l) => s + b.counts[l], 0))
  );

  // Dominios y subtipos
  const domainStats = FACTOR_DOMAINS.map((d) => ({
    ...d,
    count: current.filter((x) => x.domain === d.id).length,
  }));
  const maxDomain = Math.max(1, ...domainStats.map((d) => d.count));
  const subtypeMap = new Map<string, number>();
  current.forEach((x) => subtypeMap.set(x.subtypeLabel, (subtypeMap.get(x.subtypeLabel) || 0) + 1));
  const topSubtypes = Array.from(subtypeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Sectores
  const sectorStats = CRA_SECTORS.map((s) => {
    const list = current.filter((x) => x.r.sector_id === s.id);
    return {
      s,
      count: list.length,
      urgent: list.filter((x) => x.cls.level === "urgente").length,
      avg: list.length > 0 ? Math.round(list.reduce((a, x) => a + x.r.puntaje_confiabilidad, 0) / list.length) : 0,
      last: list.length > 0 ? Math.max(...list.map((x) => x.ts)) : null,
    };
  });
  const maxSector = Math.max(1, ...sectorStats.map((x) => x.count));

  // MOTOR DE DECISIONES INTELIGENTES (Índice de Presión Operativa 0-100 por sector)
  const sectorDecisions = useMemo(() => {
    return CRA_SECTORS.map((s) => {
      const list = current.filter((x) => x.r.sector_id === s.id);
      const openUrgent = list.filter(
        (x) => x.cls.level === "urgente" && x.r.attention_status !== "atendido"
      ).length;
      const openHigh = list.filter(
        (x) => x.cls.level === "alta" && x.r.attention_status !== "atendido"
      ).length;
      const openCritical = openUrgent + openHigh;
      const co2e = Math.round(s.carbonoTc * CRA_GLOBAL_METRICS.co2eFactor);
      const pressureScore = Math.min(
        100,
        Math.round(
          openUrgent * 18 +
            openHigh * 9 +
            s.riesgoMedio * 65 +
            Math.min(18, (s.porRevisarHa / 460) * 18)
        )
      );
      let actionTitle = `Reforzar monitoreo ciudadano en ${s.municipioPrincipal}`;
      let actionWhy = `${list.length} reportes en ${range}d · ${s.porRevisarHa} ha por verificar en campo.`;
      let targetLevel: "all" | AlertLevel = "all";

      if (openUrgent > 0) {
        actionTitle = `Despachar cuadrilla urgente a ${s.municipioPrincipal}`;
        actionWhy = `${openUrgent} alertas Nivel 1 abiertas + riesgo satelital ${s.riesgoMedio.toFixed(
          3
        )} (${co2e.toLocaleString("es-CO")} t CO₂e en juego).`;
        targetLevel = "urgente";
      } else if (s.porRevisarHa > 200) {
        actionTitle = `Activar jornada escolar 828 ha en ${s.municipioPrincipal}`;
        actionWhy = `Concentra ${s.porRevisarHa} ha sin confirmar en terreno (mayor rezago del Atlántico).`;
        targetLevel = "verificacion";
      } else if (openHigh > 0) {
        actionTitle = `Validar alertas prioritarias en ${s.municipioPrincipal}`;
        actionWhy = `${openHigh} alertas Nivel 2 pendientes de aval técnico y verificación en sitio.`;
        targetLevel = "alta";
      }

      return {
        sector: s,
        total: list.length,
        openUrgent,
        openHigh,
        openCritical,
        co2e,
        pressureScore,
        actionTitle,
        actionWhy,
        targetLevel,
      };
    }).sort((a, b) => b.pressureScore - a.pressureScore);
  }, [current, range]);

  // DETECCIÓN DE FOCOS ACTIVOS CORROBORADOS (Agrupación espacial <= 1.8 km)
  const corroboratedClusters = useMemo(() => {
    const used = new Set<string>();
    const clusters: Array<{
      id: string;
      municipio: string;
      sectorId: number;
      count: number;
      urgentCount: number;
      avgScore: number;
      topEvent: string;
      sampleCode: string;
      latestTs: number;
    }> = [];

    for (const item of current) {
      if (used.has(item.r.id)) continue;
      const group = current.filter((other) => {
        if (used.has(other.r.id)) return false;
        return (
          haversineKm(
            Number(item.r.latitud),
            Number(item.r.longitud),
            Number(other.r.latitud),
            Number(other.r.longitud)
          ) <= 1.8
        );
      });
      if (group.length >= 2) {
        group.forEach((g) => used.add(g.r.id));
        const eventCounts = new Map<string, number>();
        group.forEach((g) =>
          eventCounts.set(g.subtypeLabel, (eventCounts.get(g.subtypeLabel) || 0) + 1)
        );
        const topEvent =
          Array.from(eventCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          item.subtypeLabel;
        clusters.push({
          id: `cluster-${item.r.id}`,
          municipio: item.r.municipio,
          sectorId: item.r.sector_id,
          count: group.length,
          urgentCount: group.filter((g) => g.cls.level === "urgente" || g.cls.level === "alta")
            .length,
          avgScore: Math.round(
            group.reduce((s, g) => s + g.r.puntaje_confiabilidad, 0) / group.length
          ),
          topEvent,
          sampleCode: group[0].r.tracking_code,
          latestTs: Math.max(...group.map((g) => g.ts)),
        });
      }
    }
    return clusters.sort((a, b) => b.urgentCount - a.urgentCount || b.count - a.count).slice(0, 4);
  }, [current]);

  // SIMULADOR TÁCTICO DE DESPLIEGUE DE CUADRILLAS
  const toggleDeploySector = (id: number) => {
    setDeployedSectors((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const totalOpenCriticalAll = sectorDecisions.reduce((s, d) => s + d.openCritical, 0);
  const simCoveredCritical = sectorDecisions
    .filter((d) => deployedSectors.includes(d.sector.id))
    .reduce((s, d) => s + d.openCritical, 0);
  const simCoveredPct =
    totalOpenCriticalAll > 0 ? Math.round((simCoveredCritical / totalOpenCriticalAll) * 100) : 100;
  const simProtectedHa = CRA_SECTORS.filter((s) => deployedSectors.includes(s.id)).reduce(
    (sum, s) => sum + s.referenciaHa,
    0
  );
  const simPorRevisarHa = CRA_SECTORS.filter((s) => deployedSectors.includes(s.id)).reduce(
    (sum, s) => sum + s.porRevisarHa,
    0
  );
  const simCo2e = Math.round(
    CRA_SECTORS.filter((s) => deployedSectors.includes(s.id)).reduce(
      (sum, s) => sum + s.carbonoTc,
      0
    ) * CRA_GLOBAL_METRICS.co2eFactor
  );

  // Embudo de ciclo de vida
  const funnel = [
    { label: "Recibidos", value: total },
    {
      label: "Mentor local",
      value: current.filter((x) =>
        ["validado_comunitario", "validado_academico", "alerta_oficial_cra"].includes(x.r.estado_validacion)
      ).length,
    },
    {
      label: "Mentor académico",
      value: current.filter((x) =>
        ["validado_academico", "alerta_oficial_cra"].includes(x.r.estado_validacion)
      ).length,
    },
    {
      label: "Alerta oficial CRA",
      value: current.filter((x) => x.r.estado_validacion === "alerta_oficial_cra").length,
    },
    { label: "Atendido y cerrado", value: attended },
  ];

  // Participación
  const profileStats = REPORTER_PROFILES.map((p) => ({
    ...p,
    count: current.filter((x) => x.r.perfil_reportante === p.id).length,
  }));
  const channelStats = [
    {
      label: "Estación NFC",
      count: current.filter((x) => (x.r.qr_station_id || "").startsWith("nfc:")).length,
      color: "#EDB512",
    },
    {
      label: "WhatsApp / Zernio",
      count: current.filter((x) => (x.r.qr_station_id || "").startsWith("zernio:")).length,
      color: "#22C55E",
    },
    {
      label: "Código QR",
      count: current.filter(
        (x) =>
          x.r.qr_station_id &&
          !x.r.qr_station_id.startsWith("nfc:") &&
          !x.r.qr_station_id.startsWith("zernio:")
      ).length,
      color: "#2B8CC4",
    },
    { label: "App web / PWA", count: current.filter((x) => !x.r.qr_station_id).length, color: "#16794A" },
  ];

  // Despachos de correo
  const dispInRange = dispatches.filter(
    (d) => now - new Date(d.created_at).getTime() <= range * DAY
  );
  const dispStats = {
    sent: dispInRange.filter((d) => d.status === "enviado").length,
    sandbox: dispInRange.filter((d) => d.status === "preview_sandbox").length,
    dedup: dispInRange.filter((d) => d.status === "omitido").length,
    error: dispInRange.filter((d) => d.status === "error").length,
  };

  // Línea de tiempo de actividad
  type Ev = { ts: number; color: string; title: string; detail: string };
  const events: Ev[] = [];
  scoped.forEach((x) => {
    const chLabel = (x.r.qr_station_id || "").startsWith("zernio:")
      ? (x.r.qr_station_id || "").replace("zernio:", "").toUpperCase()
      : (x.r.qr_station_id || "").startsWith("nfc:")
      ? "NFC"
      : x.r.qr_station_id
      ? "QR"
      : "PWA";
    events.push({
      ts: x.ts,
      color: LEVEL_META[x.cls.level].color,
      title: `${x.r.tracking_code} · Nuevo reporte (${chLabel})`,
      detail: `${x.subtypeLabel} · ${x.r.municipio}`,
    });
    (x.r.validations || []).forEach((v) => {
      events.push({
        ts: new Date(v.created_at).getTime(),
        color: v.decision === "alerta_oficial" ? "#C84023" : v.decision === "seguimiento_operativo" ? "#16794A" : "#2B8CC4",
        title: `${x.r.tracking_code} · ${
          v.decision === "alerta_oficial"
            ? "Alerta oficial emitida"
            : v.decision === "seguimiento_operativo"
            ? "Caso atendido"
            : "Aval de mentor"
        }`,
        detail: v.validator_name,
      });
    });
  });
  dispatches.forEach((d) => {
    events.push({
      ts: new Date(d.created_at).getTime(),
      color: "#EDB512",
      title: `${d.tracking_code} · Correo ${d.status === "enviado" ? "enviado" : d.status}`,
      detail: d.channel,
    });
  });
  const timeline = events
    .filter((e) => Number.isFinite(e.ts) && e.ts <= now)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 14);

  const mapItems: MapReportItem[] = current.map((x) => ({
    id: x.r.id,
    tracking_code: x.r.tracking_code,
    latitud: Number(x.r.latitud),
    longitud: Number(x.r.longitud),
    zona_manglar: x.r.zona_manglar,
    tipo_evento: x.subtypeLabel,
    estado_validacion: x.r.estado_validacion,
    attention_status: x.r.attention_status,
    nivel_prioridad: x.r.nivel_prioridad,
    puntaje_confiabilidad: x.r.puntaje_confiabilidad,
    is_simulated_gps: x.r.is_simulated_gps,
    descripcion_ciudadana: x.r.descripcion_ciudadana,
  }));

  const CHART_W = 720;
  const CHART_H = 210;
  const PAD_L = 30;
  const PAD_B = 26;
  const plotW = CHART_W - PAD_L - 8;
  const plotH = CHART_H - PAD_B - 10;
  const slot = plotW / bucketCount;
  const barW = Math.max(4, slot * 0.66);

  return (
    <div className="space-y-6 text-white">
      {/* Barra de control */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/12 pb-5">
        <div>
          <h2 className="font-display text-2xl font-black text-white sm:text-3xl">
            Inteligencia de decisiones e históricos ({range} días)
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#86EFAC]">
              <Radio className="h-3.5 w-3.5" />
              {liveConnected ? "Actualización automática en vivo" : "Conectando datos en vivo..."}
            </span>
            <span className="text-white/30">·</span>
            <span>Incluye histórico demo de 90 días marcado SIMULADO (DEMO)</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sectorFilter}
            onChange={(e) =>
              setSectorFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            aria-label="Filtrar por sector"
            className="min-h-[40px] rounded-lg border border-white/20 bg-[#082438] px-3 text-xs font-bold text-white"
          >
            <option value="all">Todo el Atlántico</option>
            {CRA_SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre.split(" – ")[0]}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-white/20 bg-[#082438] p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRange(d as 7 | 30 | 90)}
                className={`min-h-[32px] rounded-md px-3 text-xs font-black transition ${
                  range === d ? "bg-[#EDB512] text-[#041A29]" : "text-white/75 hover:text-white"
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
          <a
            href="/api/open-data?format=csv"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs font-bold text-white transition hover:border-[#EDB512]"
          >
            <Download className="h-3.5 w-3.5 text-[#F8D86F]" />
            CSV
          </a>
        </div>
      </div>

      {/* 1. MOTOR DE DECISIONES INTELIGENTES — TOP 3 ACCIONES PRIORITARIAS HOY */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white sm:text-xl">
            <Target className="h-5 w-5 text-[#EDB512]" />
            Decisiones recomendadas para hoy (Índice de Presión Operativa)
          </h3>
          <span className="text-xs text-white/60">
            Cruce automático: alertas abiertas + riesgo satelital 2026 + rezago 828 ha
          </span>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-3">
          {sectorDecisions.slice(0, 3).map((dec, idx) => {
            const isCritical = dec.pressureScore >= 65;
            return (
              <div
                key={dec.sector.id}
                className="flex flex-col justify-between overflow-hidden rounded-xl border border-white/14 bg-[#082438]"
              >
                <div className="relative h-24 w-full overflow-hidden bg-[#041A29]">
                  <img
                    src={dec.sector.satImage}
                    alt={dec.sector.nombre}
                    className="h-full w-full object-cover opacity-55"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#082438] via-[#082438]/40 to-transparent" />
                  <span className="absolute left-3 top-2.5 rounded bg-[#041A29]/85 px-2 py-0.5 font-mono text-[10px] font-black text-[#F8D86F]">
                    PRIORIDAD #{idx + 1} · SECTOR 0{dec.sector.id}
                  </span>
                  <span
                    className={`absolute right-3 top-2.5 rounded px-2 py-0.5 font-mono text-[11px] font-black ${
                      isCritical
                        ? "bg-[#C84023] text-white"
                        : "bg-[#EDB512] text-[#041A29]"
                    }`}
                  >
                    {dec.pressureScore}/100
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <p className="font-display text-base font-black leading-snug text-white">
                      {dec.actionTitle}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/75">
                      {dec.actionWhy}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        onFocusSector?.(dec.sector.id);
                        onJumpToBandeja?.({
                          query: dec.sector.municipioPrincipal,
                          level: dec.targetLevel,
                        });
                      }}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#EDB512] px-3 text-xs font-black text-[#041A29] transition hover:bg-[#F8D86F]"
                    >
                      Actuar en Bandeja
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSectorFilter(dec.sector.id);
                        onFocusSector?.(dec.sector.id);
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-white/20 px-3 text-xs font-bold text-white/85 transition hover:border-[#EDB512] hover:text-white"
                    >
                      <Compass className="h-3.5 w-3.5 text-[#F8D86F]" />
                      Enfocar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. SIMULADOR TÁCTICO DE DESPLIEGUE + FOCOS CORROBORADOS */}
      <section className="grid gap-4 lg:grid-cols-12">
        {/* Simulador táctico de cuadrillas */}
        <div className="rounded-xl border border-white/14 bg-[#082438] p-5 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <Layers className="h-4 w-4 text-[#F8D86F]" />
              Simulador de despliegue de cuadrillas hoy
            </h3>
            <span className="font-mono text-[11px] font-bold text-[#86EFAC]">
              {deployedSectors.length} de 4 sectores seleccionados
            </span>
          </div>
          <p className="mt-1 text-xs text-white/65">
            Activa o desactiva sectores para estimar cobertura de alertas críticas, carbono azul resguardado y avance en las 828 ha por verificar.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sectorDecisions.map((d) => {
              const active = deployedSectors.includes(d.sector.id);
              return (
                <button
                  key={d.sector.id}
                  type="button"
                  onClick={() => toggleDeploySector(d.sector.id)}
                  className={`flex min-h-[76px] flex-col justify-between rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-[#EDB512] bg-[#005F96]/45 text-white"
                      : "border-white/12 bg-[#041A29]/65 text-white/65 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 font-mono text-[10px] font-black">
                    <span className={active ? "text-[#F8D86F]" : "text-white/50"}>
                      0{d.sector.id}
                    </span>
                    <span className={d.openUrgent > 0 ? "text-[#FCA5A5]" : "text-[#86EFAC]"}>
                      {d.pressureScore} pts
                    </span>
                  </div>
                  <span className="mt-1.5 block text-xs font-black leading-tight">
                    {d.sector.municipioPrincipal}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/12 pt-4 sm:grid-cols-4">
            <div>
              <span className="block text-[11px] text-white/60">Alertas críticas cubiertas</span>
              <span className="mt-0.5 block font-display text-2xl font-black tabular-nums text-[#86EFAC]">
                {simCoveredPct}%
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-white/60">Manglar en cobertura</span>
              <span className="mt-0.5 block font-display text-2xl font-black tabular-nums text-white">
                {simProtectedHa.toFixed(0)} ha
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-white/60">Carbono resguardado</span>
              <span className="mt-0.5 block font-display text-xl font-black tabular-nums text-[#F8D86F]">
                {simCo2e.toLocaleString("es-CO")} t
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-white/60">Brecha 828 ha cubierta</span>
              <span className="mt-0.5 block font-display text-2xl font-black tabular-nums text-[#7DD3FC]">
                {simPorRevisarHa.toFixed(0)} ha
              </span>
            </div>
          </div>
        </div>

        {/* Focos activos corroborados (agrupación espacial <= 1.8 km) */}
        <div className="rounded-xl border border-white/14 bg-[#082438] p-5 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <Flame className="h-4 w-4 text-[#FCA5A5]" />
              Focos corroborados (≤ 1.8 km)
            </h3>
            <span className="font-mono text-[11px] font-bold text-[#F8D86F]">
              {corroboratedClusters.length} eventos
            </span>
          </div>
          <p className="mt-1 text-xs text-white/65">
            Agrupación automática de observaciones cercanas para priorizar eventos reales sobre reportes aislados.
          </p>

          <div className="mt-3.5 divide-y divide-white/10">
            {corroboratedClusters.length === 0 ? (
              <p className="py-6 text-xs text-white/60">
                No se detectan agrupaciones múltiples en este rango de tiempo.
              </p>
            ) : (
              corroboratedClusters.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-white">
                      {c.municipio} · {c.topEvent}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/65">
                      <strong className="text-[#F8D86F]">{c.count} reportes</strong> ({c.urgentCount} críticos) ·{" "}
                      {c.avgScore}/100 conf. · {relativeTime(c.latestTs, now)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onFocusSector?.(c.sectorId);
                      onJumpToBandeja?.({ query: c.municipio, level: "all" });
                    }}
                    className="shrink-0 rounded-lg border border-white/20 px-2.5 py-1.5 text-[11px] font-black text-[#F8D86F] transition hover:border-[#EDB512] hover:bg-[#EDB512] hover:text-[#041A29]"
                  >
                    Auditar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 2B. SATÉLITE NASA FIRMS — FOCOS DE CALOR Y FUEGO EN TIEMPO REAL (24H) */}
      <section className="overflow-hidden rounded-xl border border-[#C84023]/45 bg-[#082438]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 bg-[#041A29]/65 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C84023] text-white">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-black text-white">
                Satélite NASA FIRMS · Focos de fuego en vivo (últimas 24 h)
              </h3>
              <p className="text-xs text-white/70">
                Datos abiertos gratuitos de los satélites NOAA-20 y NOAA-21 VIIRS (375 m) cruzados con los 4 sectores de manglar del Atlántico.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-black">
            <span className="rounded-lg bg-[#C84023]/25 px-3 py-1.5 text-[#FCA5A5]">
              {nasaFires ? `${nasaFires.atlanticoCount} en Atlántico` : "Consultando NASA..."}
            </span>
            <span className="rounded-lg border border-white/15 bg-[#041A29] px-3 py-1.5 text-[#F8D86F]">
              {nasaFires ? `${nasaFires.caribeCount} en Caribe cercano` : "..."}
            </span>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {(nasaFires?.atlantico?.length
            ? nasaFires.atlantico
            : nasaFires?.caribe || []
          )
            .slice(0, 4)
            .map((hot) => (
              <a
                key={hot.id}
                href={`https://www.google.com/maps?q=${hot.latitude},${hot.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col justify-between rounded-lg border border-white/12 bg-[#041A29]/75 p-3.5 transition hover:border-[#EDB512]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-[#C84023]/30 px-2 py-0.5 font-mono text-[10px] font-black text-[#FCA5A5]">
                    {hot.satellite} · {hot.acqTimeUtc}
                  </span>
                  <span className="font-mono text-[11px] font-black text-[#F8D86F]">
                    a {hot.distanceToMangroveKm} km
                  </span>
                </div>
                <p className="mt-2 text-xs font-black text-white">
                  Cerca de {hot.nearestSectorName.split(" – ")[0]}
                </p>
                <p className="mt-1 font-mono text-[11px] text-white/65">
                  {hot.latitude.toFixed(4)}, {hot.longitude.toFixed(4)} · {hot.frpMw} MW
                </p>
              </a>
            ))}
          {nasaFires && nasaFires.caribeCount === 0 && (
            <p className="col-span-full py-2 text-xs font-bold text-[#86EFAC]">
              Sin focos térmicos activos detectados por NASA VIIRS en el Caribe cercano en las últimas 24 horas.
            </p>
          )}
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 border-b border-white/12 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Reportes en el periodo",
            value: String(total),
            sub:
              trendPct == null
                ? "Sin periodo previo"
                : `${trendPct >= 0 ? "+" : ""}${trendPct}% vs periodo anterior`,
            tone: "text-white",
            trend: trendPct,
          },
          {
            label: "Validados por mentores",
            value: total > 0 ? `${Math.round((validatedCount / total) * 100)}%` : "0%",
            sub: `${validatedCount} de ${total}`,
            tone: "text-[#86EFAC]",
          },
          {
            label: "Confiabilidad promedio",
            value: `${avgScore}`,
            sub: "puntos sobre 100",
            tone: "text-[#F8D86F]",
          },
          {
            label: "Tiempo a 1ª validación",
            value: fmtHours(avgFirstVal),
            sub: `${withVal.length} casos medidos`,
            tone: "text-[#7DD3FC]",
          },
          {
            label: "Respuestas a tiempo",
            value: `${slaPct}%`,
            sub: "dentro de la meta por nivel",
            tone: slaPct >= 80 ? "text-[#86EFAC]" : "text-[#FCA5A5]",
          },
          {
            label: "Casos cerrados",
            value: String(attended),
            sub: total > 0 ? `${Math.round((attended / total) * 100)}% del periodo` : "—",
            tone: "text-white",
          },
        ].map((k, idx) => (
          <div
            key={k.label}
            className={`py-5 pr-3 ${idx > 0 ? "lg:border-l lg:border-white/12 lg:pl-4" : ""}`}
          >
            <p className="text-[11px] text-white/60">{k.label}</p>
            <p className={`mt-1 font-display text-3xl font-black tabular-nums ${k.tone}`}>
              {k.value}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/55">
              {"trend" in k && k.trend != null ? (
                k.trend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-[#F8D86F]" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-[#86EFAC]" />
                )
              ) : null}
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Serie temporal + mapa */}
      <div className="mt-8 grid gap-6 xl:grid-cols-12">
        <section className="rounded-xl border border-white/12 bg-[#082438] p-5 xl:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-black text-white">
              Reportes por {range === 90 ? "semana" : "día"} y nivel de alerta
            </h3>
            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-white/75">
              {LEVEL_ORDER.map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: LEVEL_META[l].color }} />
                  {LEVEL_META[l].label}
                </span>
              ))}
            </div>
          </div>

          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="mt-4 h-auto w-full"
            role="img"
            aria-label="Serie histórica de reportes apilados por nivel de alerta"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = 10 + plotH * (1 - f);
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={CHART_W - 8} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                  <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.45)">
                    {Math.round(maxBucket * f)}
                  </text>
                </g>
              );
            })}
            {buckets.map((b, i) => {
              const x = PAD_L + i * slot + (slot - barW) / 2;
              let yCursor = 10 + plotH;
              const showLabel = bucketCount <= 14 || i % 5 === 0 || i === bucketCount - 1;
              const d = new Date(b.start);
              return (
                <g key={b.start}>
                  {LEVEL_ORDER.map((l) => {
                    const h = (b.counts[l] / maxBucket) * plotH;
                    if (h <= 0) return null;
                    yCursor -= h;
                    return (
                      <rect
                        key={l}
                        x={x}
                        y={yCursor}
                        width={barW}
                        height={h}
                        rx={2}
                        fill={LEVEL_META[l].color}
                      />
                    );
                  })}
                  {showLabel && (
                    <text
                      x={x + barW / 2}
                      y={CHART_H - 8}
                      textAnchor="middle"
                      fontSize="10"
                      fill="rgba(255,255,255,0.5)"
                    >
                      {`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Embudo */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <h4 className="text-sm font-black text-white">Embudo de gobernanza (del reporte al cierre)</h4>
            <div className="mt-3 space-y-2">
              {funnel.map((f, i) => {
                const pct = total > 0 ? Math.round((f.value / total) * 100) : 0;
                return (
                  <div key={f.label} className="grid grid-cols-12 items-center gap-3 text-xs">
                    <span className="col-span-4 font-bold text-white/80 sm:col-span-3">{f.label}</span>
                    <div className="col-span-6 h-6 overflow-hidden rounded bg-white/8 sm:col-span-7">
                      <div
                        className="flex h-full items-center rounded px-2 font-mono text-[11px] font-black text-[#041A29] transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, f.value > 0 ? 8 : 0)}%`,
                          backgroundColor: ["#7DD3FC", "#2B8CC4", "#EDB512", "#C84023", "#16794A"][i],
                        }}
                      >
                        {f.value}
                      </div>
                    </div>
                    <span className="col-span-2 text-right font-mono font-bold text-white/70">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-3 xl:col-span-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-black text-white">Mapa histórico de presiones</h3>
            <span className="font-mono text-xs text-[#F8D86F]">{mapItems.length} puntos</span>
          </div>
          <CraMap
            reports={mapItems}
            layersVisible={{
              priorities: false,
              manglarProbable: true,
              porRevisar: true,
              doselSeco: true,
              groundTruth: false,
              reports: true,
            }}
            heightClass="h-[440px] xl:h-[520px]"
            darkFrame
          />
        </section>
      </div>

      {/* Sectores + factores */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-white/12 bg-[#082438] p-5 lg:col-span-7">
          <h3 className="font-display text-lg font-black text-white">Comparativo por sector costero</h3>
          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {sectorStats.map((x) => (
              <div key={x.s.id} className="grid grid-cols-12 items-center gap-3 py-3 text-xs">
                <div className="col-span-12 sm:col-span-4">
                  <p className="font-black text-white">{x.s.nombre.split(" – ")[0]}</p>
                  <p className="text-white/55">
                    {x.last ? `Último: ${relativeTime(x.last, now)}` : "Sin reportes en el periodo"}
                  </p>
                </div>
                <div className="col-span-7 sm:col-span-5">
                  <div className="h-2.5 overflow-hidden rounded-[2px] bg-white/10">
                    <div
                      className="h-full bg-[#2B8CC4] transition-all duration-500"
                      style={{ width: `${(x.count / maxSector) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-white/55">
                    {x.s.porRevisarHa} ha por revisar · riesgo {x.s.riesgoMedio}
                  </p>
                </div>
                <div className="col-span-5 grid grid-cols-3 gap-1 text-right font-mono sm:col-span-3">
                  <span className="font-black text-white" title="Reportes">{x.count}</span>
                  <span className="font-black text-[#FCA5A5]" title="Urgentes">{x.urgent}</span>
                  <span className="font-black text-[#F8D86F]" title="Confiabilidad promedio">{x.avg}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-right text-[10px] text-white/45">Reportes · Urgentes · Confiabilidad promedio</p>
        </section>

        <section className="rounded-xl border border-white/12 bg-[#082438] p-5 lg:col-span-5">
          <h3 className="font-display text-lg font-black text-white">Factores ambientales reportados</h3>
          <div className="mt-4 space-y-3">
            {domainStats.map((d) => (
              <div key={d.id}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white/85">{d.title}</span>
                  <span className="font-mono text-white">{d.count}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-[2px] bg-white/10">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${(d.count / maxDomain) * 100}%`, backgroundColor: d.accentHex }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-black text-[#F8D86F]">Top casos específicos</p>
            <ol className="mt-2 space-y-1.5 text-xs">
              {topSubtypes.map(([label, count], i) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-white/80">
                    <span className="mr-2 font-mono text-white/45">0{i + 1}</span>
                    {label}
                  </span>
                  <span className="font-mono font-black text-white">{count}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {/* Participación + correos + actividad */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="space-y-5 rounded-xl border border-white/12 bg-[#082438] p-5 lg:col-span-4">
          <div>
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <Users className="h-4 w-4 text-[#F8D86F]" />
              Quién participa
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {profileStats.map((p) => (
                <div key={p.id} className="rounded-lg border border-white/10 bg-[#041A29]/60 p-3">
                  <p className="font-display text-2xl font-black tabular-nums text-white">{p.count}</p>
                  <p className="text-[11px] font-bold text-white/70">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-black text-white">Canal de entrada</p>
            <div className="mt-2 flex h-3 overflow-hidden rounded-[2px] bg-white/10">
              {channelStats.map((c) =>
                c.count > 0 ? (
                  <div
                    key={c.label}
                    style={{ width: `${(c.count / Math.max(1, total)) * 100}%`, backgroundColor: c.color }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-2 space-y-1 text-[11px]">
              {channelStats.map((c) => (
                <div key={c.label} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-white/75">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </span>
                  <span className="font-mono font-bold text-white">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/12 bg-[#082438] p-5 lg:col-span-3">
          <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
            <Mail className="h-4 w-4 text-[#F8D86F]" />
            Correos de alerta
          </h3>
          <div className="mt-4 space-y-3 text-xs">
            {[
              { label: "Correos enviados", value: dispStats.sent, icon: CheckCircle2, tone: "text-[#86EFAC]" },
              { label: "Modo prueba", value: dispStats.sandbox, icon: Activity, tone: "text-[#F8D86F]" },
              { label: "Deduplicados anti-spam", value: dispStats.dedup, icon: ShieldCheck, tone: "text-[#7DD3FC]" },
              { label: "Con error", value: dispStats.error, icon: Clock, tone: "text-[#FCA5A5]" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="inline-flex items-center gap-2 text-white/80">
                    <Icon className={`h-4 w-4 ${s.tone}`} />
                    {s.label}
                  </span>
                  <span className={`font-display text-xl font-black tabular-nums ${s.tone}`}>{s.value}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-white/12 bg-[#082438] p-5 lg:col-span-5">
          <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
            <Activity className="h-4 w-4 text-[#F8D86F]" />
            Línea de tiempo de actividad
          </h3>
          <ol className="mt-4 max-h-[340px] space-y-0 overflow-y-auto pr-1">
            {timeline.map((e, i) => (
              <li key={`${e.title}-${e.ts}-${i}`} className="relative flex gap-3 pb-3.5">
                <span className="relative flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                  {i < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-white/12" />}
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold text-white">{e.title}</p>
                    <span className="shrink-0 font-mono text-[10px] text-white/50">{relativeTime(e.ts, now)}</span>
                  </div>
                  <p className="truncate text-white/60">{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
