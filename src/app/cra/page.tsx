"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Layers,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";
import { CRA_SECTORS, type AttentionStatus } from "@/lib/cra-domain";
import type { MapReportItem } from "@/components/CraMap";

const CraMap = dynamic(() => import("@/components/CraMap"), {
  ssr: false,
  loading: () => (
    <div className="bezel-outer">
      <div className="bezel-inner flex h-[480px] items-center justify-center text-sm font-bold text-[#005F96]">
        Cargando visor territorial CRA Atlántico...
      </div>
    </div>
  ),
});

export default function CraDashboardPage() {
  const [reports, setReports] = useState<MapReportItem[]>([]);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [liveConnected, setLiveConnected] = useState(false);
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
        () => {
          fetchReports();
        }
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
  const enPorRevisar = reports.filter(
    (r) => (r as unknown as { en_zona_por_revisar?: boolean }).en_zona_por_revisar
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-[#005F96]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#005F96]">
            <Radio className={`h-3.5 w-3.5 ${liveConnected ? "text-[#1F7A4C]" : "text-[#EDB512]"}`} />
            <span>{liveConnected ? "Supabase Realtime en vivo" : "Sala Operativa CRA"}</span>
          </div>
          <h1 className="font-display text-3xl font-black text-[#08334C]">
            Panel Operativo CRA · Tiempo Real y Datos Abiertos
          </h1>
        </div>

        {/* Exportación Gobierno Digital */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/open-data?format=csv"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#005F96] px-4 py-2 text-xs font-black text-white hover:bg-[#08334C]"
          >
            <Download className="h-4 w-4 text-[#F8D86F]" />
            Exportar CSV (Ley 1581)
          </a>
          <a
            href="/api/open-data?format=geojson"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#08334C]/15 bg-white px-4 py-2 text-xs font-black text-[#08334C] hover:border-[#005F96]"
          >
            <Download className="h-4 w-4 text-[#1F7A4C]" />
            Exportar GeoJSON
          </a>
        </div>
      </div>

      {/* KPIs en vivo */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#08334C]/10 bg-white p-4">
          <p className="text-[11px] font-black uppercase text-[#08334C]/60">Reportes recibidos</p>
          <p className="tabular-nums font-display mt-1 text-3xl font-black text-[#005F96]">
            {reports.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#08334C]/10 bg-white p-4">
          <p className="text-[11px] font-black uppercase text-[#08334C]/60">Alertas oficiales CRA</p>
          <p className="tabular-nums font-display mt-1 text-3xl font-black text-[#D94E2A]">
            {alertasOficiales}
          </p>
        </div>
        <div className="rounded-2xl border border-[#08334C]/10 bg-white p-4">
          <p className="text-[11px] font-black uppercase text-[#08334C]/60">Sobre 828 ha por revisar</p>
          <p className="tabular-nums font-display mt-1 text-3xl font-black text-[#1F7A4C]">
            {enPorRevisar}
          </p>
        </div>
        <div className="rounded-2xl border border-[#08334C]/10 bg-white p-4">
          <p className="text-[11px] font-black uppercase text-[#08334C]/60">Base Ground-Truth CRA</p>
          <p className="tabular-nums font-display mt-1 text-3xl font-black text-[#08334C]">
            524 pts
          </p>
        </div>
      </div>

      {/* Control de capas */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#08334C]/10 bg-white/90 p-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-black text-[#005F96]">
          <Layers className="h-4 w-4" /> Capas oficiales:
        </span>
        {[
          { key: "priorities", label: "Prioridades KMZ" },
          { key: "manglarProbable", label: "Manglar probable (775 ha)" },
          { key: "porRevisar", label: "Por revisar (828 ha)" },
          { key: "doselSeco", label: "Dosel seco 2026" },
          { key: "groundTruth", label: "524 Puntos Ground-Truth" },
          { key: "reports", label: "Reportes en vivo" },
        ].map((item) => {
          const k = item.key as keyof typeof layers;
          const active = layers[k];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setLayers((prev) => ({ ...prev, [k]: !prev[k] }))}
              className={`rounded-full px-3 py-1.5 font-bold transition ${
                active
                  ? "bg-[#005F96] text-white"
                  : "bg-[#F7F3EA] text-[#08334C]/75 hover:bg-[#08334C]/10"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <CraMap reports={filtered} layersVisible={layers} />

      {/* Bandeja de respuesta rápida */}
      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-[#08334C]">
            Bandeja de respuesta rápida
          </h2>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="min-h-[40px] rounded-full border border-[#08334C]/15 bg-white px-4 text-xs font-bold text-[#08334C]"
          >
            <option value="all">Todos los sectores del Atlántico</option>
            {CRA_SECTORS.map((s) => (
              <option key={s.id} value={s.nombre.split(" – ")[0]}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="bezel-outer">
          <div className="bezel-inner overflow-x-auto p-3">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#08334C]/10 text-[11px] font-black uppercase text-[#08334C]/60">
                  <th className="p-3">Código</th>
                  <th className="p-3">Sector</th>
                  <th className="p-3">Evento</th>
                  <th className="p-3">Semáforo</th>
                  <th className="p-3">Validación</th>
                  <th className="p-3">Atención CRA</th>
                  <th className="p-3">Acción operativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#08334C]/10">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F3EA]/50">
                    <td className="p-3 font-black text-[#005F96]">
                      {r.tracking_code}
                      {r.is_simulated_gps && (
                        <span className="ml-1 rounded bg-[#EDB512] px-1.5 py-0.5 text-[10px] text-[#08334C]">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold">{r.zona_manglar}</td>
                    <td className="p-3">{r.tipo_evento}</td>
                    <td className="tabular-nums p-3 font-black">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
                          r.puntaje_confiabilidad >= 75
                            ? "bg-[#1F7A4C]/15 text-[#1F7A4C]"
                            : "bg-[#F8D86F]/45 text-[#08334C]"
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {r.puntaje_confiabilidad}/100
                      </span>
                    </td>
                    <td className="p-3">{r.estado_validacion}</td>
                    <td className="p-3 font-bold">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F3EA] px-2.5 py-0.5">
                        {r.attention_status === "operativo_en_curso" ? (
                          <AlertTriangle className="h-3 w-3 text-[#D94E2A]" />
                        ) : (
                          <Activity className="h-3 w-3 text-[#005F96]" />
                        )}
                        {r.attention_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateAttention(r.id, "operativo_en_curso")}
                          className="rounded-full bg-[#005F96] px-2.5 py-1 text-[11px] font-bold text-white"
                        >
                          Activar operativo
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAttention(r.id, "atendido")}
                          className="rounded-full bg-[#1F7A4C] px-2.5 py-1 text-[11px] font-bold text-white"
                        >
                          Marcar atendido
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
