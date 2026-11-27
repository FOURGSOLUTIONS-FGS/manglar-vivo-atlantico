"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Layers,
  Navigation,
  Radio,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";
import { CRA_SECTORS, type AttentionStatus } from "@/lib/cra-domain";
import { ReliabilityMeter } from "@/components/ReliabilityMeter";
import type { MapReportItem } from "@/components/CraMap";

const CraMap = dynamic(() => import("@/components/CraMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-xl border border-white/15 bg-[#082438] text-sm font-bold text-[#F8D86F]">
      Cargando visor satelital CRA Atlántico...
    </div>
  ),
});

interface FullReport extends MapReportItem {
  evidencia_foto_url?: string | null;
  en_zona_por_revisar?: boolean;
  timestamp_captura?: string;
  municipio?: string;
  evidencia_exif?: Record<string, unknown> | null;
}

export default function CraDashboardPage() {
  const [reports, setReports] = useState<FullReport[]>([]);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [liveConnected, setLiveConnected] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(
    null
  );
  const [layers, setLayers] = useState({
    priorities: true,
    manglarProbable: true,
    porRevisar: true,
    doselSeco: true,
    groundTruth: false,
    reports: true,
  });

  const fetchReports = async () => {
    const res = await fetch("/api/reports");
    if (!res.ok) return;
    const json = await res.json();
    setReports(json.reports || []);
  };

  useEffect(() => {
    fetchReports();

    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("cra-live-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "citizen_reports" },
        () => fetchReports()
      )
      .subscribe((status) => {
        setLiveConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (sectorFilter === "all") return reports;
    return reports.filter((r) =>
      r.zona_manglar.toLowerCase().includes(sectorFilter.toLowerCase())
    );
  }, [reports, sectorFilter]);

  const updateAttention = async (reportId: string, nextStatus: AttentionStatus) => {
    await fetch("/api/validations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId,
        validatorRole: "cra_oficial",
        validatorName: "Sala Operativa CRA",
        decision: "seguimiento_operativo",
        attentionStatus: nextStatus,
        notes: `Estado operativo actualizado a ${nextStatus}`,
      }),
    });
    fetchReports();
  };

  const alertasOficiales = reports.filter(
    (r) => r.estado_validacion === "alerta_oficial_cra"
  ).length;
  const enPorRevisar = reports.filter((r) => r.en_zona_por_revisar).length;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#041A29] text-white">
      {/* Cabecera operativa War Room */}
      <div className="border-b border-white/12 bg-[#041A29]">
        <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-black text-white sm:text-4xl">
                Sala Operativa Satelital CRA
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-white/75">
                <span className="inline-flex items-center gap-2 text-[#86EFAC]">
                  <span className="relative flex h-2.5 w-2.5">
                    {liveConnected && (
                      <span className="live-pulse absolute inline-flex h-full w-full rounded-full bg-[#22C55E]" />
                    )}
                    <Radio
                      className={`relative h-2.5 w-2.5 ${
                        liveConnected ? "text-[#22C55E]" : "text-[#EDB512]"
                      }`}
                    />
                  </span>
                  {liveConnected ? "Supabase Realtime conectado" : "Conectando flujo en vivo..."}
                </span>
                <span className="text-white/30">·</span>
                <span>Cruce automático con KMZ Prioridades, 828 ha y 524 puntos ground-truth</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <a
                href="/api/open-data?format=csv"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#EDB512] px-4 text-xs font-black text-[#041A29] transition hover:bg-[#F8D86F]"
              >
                <Download className="h-4 w-4" />
                Exportar CSV (Ley 1581)
              </a>
              <a
                href="/api/open-data?format=geojson"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-4 text-xs font-bold text-white transition hover:border-[#EDB512]"
              >
                <Download className="h-4 w-4 text-[#F8D86F]" />
                Exportar GeoJSON
              </a>
            </div>
          </div>

          {/* 4 métricas en vivo separadas por líneas finas */}
          <div className="mt-6 grid grid-cols-2 border-y border-white/12 sm:grid-cols-4">
            {[
              { label: "Reportes recibidos", value: String(reports.length), tone: "text-white" },
              { label: "Alertas oficiales CRA", value: String(alertasOficiales), tone: "text-[#FCA5A5]" },
              { label: "Sobre 828 ha por revisar", value: String(enPorRevisar), tone: "text-[#F8D86F]" },
              { label: "Base Ground-Truth CRA", value: "524 pts", tone: "text-[#86EFAC]" },
            ].map((k, idx) => (
              <div
                key={k.label}
                className={`py-4 sm:px-5 ${idx > 0 ? "sm:border-l sm:border-white/12" : "sm:pl-0"}`}
              >
                <p className="text-xs text-white/60">{k.label}</p>
                <p className={`mt-1 font-display text-3xl font-black tabular-nums ${k.tone}`}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controles de vuelo + capas + visor 65/35 */}
      <div className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-[#082438] p-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 font-bold text-[#F8D86F]">
              <Navigation className="h-3.5 w-3.5" /> Sector:
            </span>
            <button
              type="button"
              onClick={() => {
                setSectorFilter("all");
                setFlyTarget({ lat: 10.91, lon: -75.04, zoom: 10 });
              }}
              className={`min-h-[36px] rounded-md px-3 font-bold transition ${
                sectorFilter === "all"
                  ? "bg-[#EDB512] text-[#041A29]"
                  : "bg-white/8 text-white/80 hover:bg-white/15"
              }`}
            >
              Todo Atlántico
            </button>
            {CRA_SECTORS.map((s) => {
              const short = s.nombre.split(" – ")[0];
              const active = sectorFilter === short;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSectorFilter(short);
                    setFlyTarget({ lat: s.centroidLat, lon: s.centroidLon, zoom: 13 });
                  }}
                  className={`min-h-[36px] rounded-md px-3 font-bold transition ${
                    active
                      ? "bg-[#EDB512] text-[#041A29]"
                      : "bg-white/8 text-white/80 hover:bg-white/15"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 font-bold text-white/70">
              <Layers className="h-3.5 w-3.5" /> Capas:
            </span>
            {[
              { key: "priorities", label: "KMZ" },
              { key: "manglarProbable", label: "Manglar" },
              { key: "porRevisar", label: "828 ha" },
              { key: "doselSeco", label: "Dosel seco" },
              { key: "groundTruth", label: "524 pts" },
              { key: "reports", label: "Reportes" },
            ].map((item) => {
              const k = item.key as keyof typeof layers;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLayers((prev) => ({ ...prev, [k]: !prev[k] }))}
                  className={`min-h-[36px] rounded-md px-3 font-bold transition ${
                    layers[k]
                      ? "bg-[#005F96] text-white"
                      : "bg-white/8 text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CraMap
              reports={filtered}
              layersVisible={layers}
              flyToTarget={flyTarget}
              heightClass="h-[460px] lg:h-[620px]"
              darkFrame
            />
          </div>

          <div className="flex flex-col lg:col-span-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-black text-white">
                Bandeja priorizada ({filtered.length})
              </h2>
              <span className="text-xs text-white/60">Selecciona un registro para centrar</span>
            </div>

            <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
              {filtered.map((r) => {
                const subtipo =
                  r.evidencia_exif && typeof r.evidencia_exif.subtipo_label === "string"
                    ? r.evidencia_exif.subtipo_label
                    : null;
                return (
                  <div
                    key={r.id}
                    onClick={() => setFlyTarget({ lat: r.latitud, lon: r.longitud, zoom: 14 })}
                    className="cursor-pointer rounded-xl border border-white/12 bg-[#082438] p-4 transition hover:border-[#EDB512]/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {r.evidencia_foto_url && (
                          <img
                            src={r.evidencia_foto_url}
                            alt={r.tracking_code}
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-[#F8D86F]">
                              {r.tracking_code}
                            </span>
                            {r.is_simulated_gps && (
                              <span className="rounded bg-[#EDB512] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#041A29]">
                                SIMULADO DEMO
                              </span>
                            )}
                            {r.en_zona_por_revisar && (
                              <span className="rounded bg-[#16794A]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#86EFAC]">
                                828 ha
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm font-black text-white">
                            {r.zona_manglar}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-white/70">
                            {subtipo ? `${subtipo} · ` : ""}
                            {r.descripcion_ciudadana || r.tipo_evento}
                          </p>
                        </div>
                      </div>

                      <ReliabilityMeter
                        score={r.puntaje_confiabilidad}
                        variant="dark"
                        compact
                      />
                    </div>

                    <div
                      className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="inline-flex items-center gap-1.5 font-bold text-white/85">
                        {r.attention_status === "operativo_en_curso" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-[#FCA5A5]" />
                        ) : r.attention_status === "atendido" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#86EFAC]" />
                        ) : (
                          <Activity className="h-3.5 w-3.5 text-[#F8D86F]" />
                        )}
                        {r.estado_validacion} · {r.attention_status}
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateAttention(r.id, "operativo_en_curso")}
                          className="min-h-[32px] rounded-md bg-[#005F96] px-2.5 font-bold text-white transition hover:bg-[#0073B5]"
                        >
                          Operativo
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAttention(r.id, "atendido")}
                          className="min-h-[32px] rounded-md bg-[#16794A] px-2.5 font-bold text-white transition hover:bg-[#1E925B]"
                        >
                          Atendido
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
