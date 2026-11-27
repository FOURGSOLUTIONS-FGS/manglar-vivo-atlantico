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
import { ReliabilityRing } from "@/components/ReliabilityRing";
import type { MapReportItem } from "@/components/CraMap";

const CraMap = dynamic(() => import("@/components/CraMap"), {
  ssr: false,
  loading: () => (
    <div className="bezel-outer">
      <div className="bezel-inner flex h-[500px] items-center justify-center text-sm font-bold text-[#005F96]">
        Cargando visor satelital CRA Atlántico...
      </div>
    </div>
  ),
});

interface FullReport extends MapReportItem {
  evidencia_foto_url?: string | null;
  en_zona_por_revisar?: boolean;
  timestamp_captura?: string;
  municipio?: string;
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
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-[#005F96]/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#005F96]">
            <span className="relative flex h-2.5 w-2.5">
              {liveConnected && (
                <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-[#1F7A4C]" />
              )}
              <Radio
                className={`relative h-2.5 w-2.5 ${
                  liveConnected ? "text-[#1F7A4C]" : "text-[#EDB512]"
                }`}
              />
            </span>
            <span>{liveConnected ? "Supabase Realtime en vivo" : "Sala Operativa CRA"}</span>
          </div>
          <h1 className="font-display text-3xl font-black text-[#08334C] sm:text-4xl">
            Sala Operativa Satelital CRA
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/open-data?format=csv"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#005F96] px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-[#08334C]"
          >
            <Download className="h-4 w-4 text-[#F8D86F]" />
            Exportar CSV (Ley 1581)
          </a>
          <a
            href="/api/open-data?format=geojson"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#08334C]/15 bg-white px-5 py-2 text-xs font-black text-[#08334C] hover:border-[#005F96]"
          >
            <Download className="h-4 w-4 text-[#1F7A4C]" />
            Exportar GeoJSON
          </a>
        </div>
      </div>

      {/* KPIs en vivo */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Reportes recibidos", value: String(reports.length), color: "text-[#005F96]" },
          { label: "Alertas oficiales CRA", value: String(alertasOficiales), color: "text-[#D94E2A]" },
          { label: "Sobre 828 ha por revisar", value: String(enPorRevisar), color: "text-[#1F7A4C]" },
          { label: "Base Ground-Truth CRA", value: "524 pts", color: "text-[#08334C]" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-[#08334C]/10 bg-white/95 p-4 shadow-sm"
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-[#08334C]/60">
              {k.label}
            </p>
            <p className={`tabular-nums font-display mt-1 text-3xl font-black ${k.color}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Vuelo rápido + Capas */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#08334C]/10 bg-white/95 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 font-black text-[#005F96]">
            <Navigation className="h-3.5 w-3.5" /> Ir al sector:
          </span>
          <button
            type="button"
            onClick={() => {
              setSectorFilter("all");
              setFlyTarget({ lat: 10.91, lon: -75.04, zoom: 10 });
            }}
            className="rounded-full bg-[#F7F3EA] px-3 py-1 font-bold hover:bg-[#005F96] hover:text-white"
          >
            Todo Atlántico
          </button>
          {CRA_SECTORS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSectorFilter(s.nombre.split(" – ")[0]);
                setFlyTarget({ lat: s.centroidLat, lon: s.centroidLon, zoom: 13 });
              }}
              className="rounded-full bg-[#F7F3EA] px-3 py-1 font-bold hover:bg-[#005F96] hover:text-white"
            >
              {s.nombre.split(" – ")[0]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 font-black text-[#08334C]/70">
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
                className={`rounded-full px-3 py-1 font-bold transition ${
                  layers[k] ? "bg-[#005F96] text-white" : "bg-[#F7F3EA] text-[#08334C]/70"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mapa Satelital + Bandeja de Tarjetas Operativas */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CraMap
            reports={filtered}
            layersVisible={layers}
            flyToTarget={flyTarget}
            heightClass="h-[460px] lg:h-[600px]"
          />
        </div>

        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#08334C]">
              Bandeja priorizada ({filtered.length})
            </h2>
            <span className="text-xs font-bold text-[#08334C]/60">Clic para volar al punto</span>
          </div>

          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => setFlyTarget({ lat: r.latitud, lon: r.longitud, zoom: 14 })}
                className="cursor-pointer rounded-3xl border border-[#08334C]/10 bg-white p-4 shadow-sm transition hover:border-[#005F96]/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {r.evidencia_foto_url && (
                      <img
                        src={r.evidencia_foto_url}
                        alt={r.tracking_code}
                        className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                      />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-[#005F96]">{r.tracking_code}</span>
                        {r.is_simulated_gps && (
                          <span className="rounded-full bg-[#EDB512] px-2 py-0.5 text-[10px] font-black text-[#08334C]">
                            DEMO
                          </span>
                        )}
                        {r.en_zona_por_revisar && (
                          <span className="rounded-full bg-[#1F7A4C]/12 px-2 py-0.5 text-[10px] font-black text-[#1F7A4C]">
                            828 ha
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-black text-[#08334C]">{r.zona_manglar}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[#08334C]/70">
                        {r.descripcion_ciudadana || r.tipo_evento}
                      </p>
                    </div>
                  </div>
                  <ReliabilityRing score={r.puntaje_confiabilidad} size={62} />
                </div>

                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#08334C]/10 pt-2.5 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="inline-flex items-center gap-1 font-bold text-[#08334C]">
                    {r.attention_status === "operativo_en_curso" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-[#D94E2A]" />
                    ) : r.attention_status === "atendido" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4C]" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-[#005F96]" />
                    )}
                    {r.estado_validacion} · {r.attention_status}
                  </span>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateAttention(r.id, "operativo_en_curso")}
                      className="rounded-full bg-[#005F96] px-2.5 py-1 font-bold text-white hover:bg-[#08334C]"
                    >
                      Operativo
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttention(r.id, "atendido")}
                      className="rounded-full bg-[#1F7A4C] px-2.5 py-1 font-bold text-white"
                    >
                      Atendido
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
