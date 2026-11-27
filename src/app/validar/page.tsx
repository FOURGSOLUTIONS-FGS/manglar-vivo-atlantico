"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { computeReliabilityScore } from "@/lib/reliability";
import { ReliabilityMeter } from "@/components/ReliabilityMeter";
import { type ValidationStatus } from "@/lib/cra-domain";

interface ReportItem {
  id: string;
  tracking_code: string;
  timestamp_captura: string;
  latitud: number;
  longitud: number;
  precision_gps_m: number | null;
  is_simulated_gps: boolean;
  zona_manglar: string;
  municipio: string;
  en_zona_por_revisar: boolean;
  tipo_evento: string;
  descripcion_ciudadana: string;
  evidencia_foto_url: string | null;
  evidencia_exif: Record<string, unknown> | null;
  perfil_reportante: string;
  estado_validacion: ValidationStatus;
  attention_status: string;
  clasificacion_tecnica: string | null;
  nivel_prioridad: string;
  puntaje_confiabilidad: number;
  ai_classification: Record<string, unknown> | null;
  ground_truth_match: {
    nearest_point_id?: number;
    dist_m?: number;
    es_manglar_consenso?: boolean;
  } | null;
  validations?: Array<{
    id: string;
    validator_role: string;
    validator_name: string;
    decision: string;
    technical_label: string | null;
    notes: string | null;
    created_at: string;
  }>;
}

export default function ValidarPage() {
  const [role, setRole] = useState<"mentor_comunitario" | "mentor_academico" | "cra_oficial">(
    "mentor_comunitario"
  );
  const [validatorName, setValidatorName] = useState("Líder Comunitario Atlántico");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [techLabel, setTechLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadReports = async () => {
    const res = await fetch("/api/reports");
    if (!res.ok) return;
    const json = await res.json();
    const list = (json.reports || []) as ReportItem[];
    setReports(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id);
      setTechLabel(list[0].clasificacion_tecnica || "");
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (role === "mentor_comunitario") setValidatorName("Líder Comunitario Atlántico");
    else if (role === "mentor_academico") setValidatorName("Mentor Académico · UniAtlántico");
    else setValidatorName("Oficial Sala CRA");
  }, [role]);

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  const breakdown = selected
    ? computeReliabilityScore({
        hasPhoto: Boolean(selected.evidencia_foto_url),
        precisionGpsM: selected.precision_gps_m,
        inCoastalZone: true,
        isSimulatedGps: selected.is_simulated_gps,
        timestampCaptura: selected.timestamp_captura,
        nearGroundTruthM: selected.ground_truth_match?.dist_m ?? null,
        estadoValidacion: selected.estado_validacion,
      })
    : null;

  const handleDecision = async (
    decision: "aprobado" | "observado" | "descartado" | "alerta_oficial"
  ) => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/validations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selected.id,
          validatorRole: role,
          validatorName,
          decision,
          technicalLabel: techLabel || selected.clasificacion_tecnica,
          notes,
        }),
      });
      if (res.ok) {
        setNotes("");
        await loadReports();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#EDF2F6]">
      <div className="border-b border-white/12 bg-[#041A29] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4 px-5 py-7 lg:px-10">
          <div>
            <h1 className="font-display text-3xl font-black text-white sm:text-4xl">
              Consola de Doble Validación y Semáforo
            </h1>
            <p className="mt-1.5 text-sm text-white/75">
              Aval secuencial de mentor comunitario y mentor académico antes de elevar reportes ciudadanos a alertas oficiales de la CRA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/15 bg-[#082438] p-1.5">
            {[
              { id: "mentor_comunitario", label: "Mentor Comunitario" },
              { id: "mentor_academico", label: "Mentor Académico" },
              { id: "cra_oficial", label: "Oficial CRA" },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id as typeof role)}
                className={`min-h-[40px] rounded-md px-3.5 text-xs font-black transition ${
                  role === r.id
                    ? "bg-[#EDB512] text-[#041A29]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Cola lateral de reportes */}
          <div className="space-y-2.5 lg:col-span-5">
            {reports.map((r) => {
              const active = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(r.id);
                    setTechLabel(r.clasificacion_tecnica || "");
                  }}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-[#005F96] bg-white ring-1 ring-[#005F96]"
                      : "border-[#041A29]/12 bg-white/80 hover:border-[#005F96]/50 hover:bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#005F96]">
                        {r.tracking_code}
                      </span>
                      <span className="rounded bg-[#EDF2F6] px-2 py-0.5 text-[11px] font-bold text-[#041A29]">
                        {r.estado_validacion}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-black text-[#041A29]">
                      {r.zona_manglar}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-[#041A29]/70">
                      {r.descripcion_ciudadana || r.tipo_evento}
                    </p>
                  </div>
                  <ReliabilityMeter score={r.puntaje_confiabilidad} compact />
                </button>
              );
            })}
          </div>

          {/* Ficha técnica de evaluación */}
          <div className="lg:col-span-7">
            {selected && breakdown ? (
              <div className="space-y-6 rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8">
                <div className="border-b border-[#041A29]/10 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#005F96]">
                    <span className="font-mono">
                      {selected.tracking_code} · {selected.municipio}
                    </span>
                    {selected.is_simulated_gps && (
                      <span className="rounded bg-[#EDB512] px-2 py-0.5 font-mono text-[11px] font-black text-[#041A29]">
                        SIMULADO (DEMO)
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-black text-[#041A29]">
                    {selected.zona_manglar}
                  </h2>
                </div>

                <ReliabilityMeter score={breakdown.score} breakdown={breakdown} />

                {selected.evidencia_foto_url && (
                  <img
                    src={selected.evidencia_foto_url}
                    alt={`Evidencia ${selected.tracking_code}`}
                    className="h-64 w-full rounded-lg border border-[#041A29]/10 object-cover"
                  />
                )}

                <div className="grid gap-4 rounded-lg border border-[#041A29]/10 bg-[#EDF2F6]/65 p-4 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-black text-[#041A29]">Observación ciudadana</p>
                    <p className="mt-1 leading-relaxed text-[#041A29]/80">
                      {selected.descripcion_ciudadana || "Sin relato textual."}
                    </p>
                    <p className="mt-2 font-mono font-bold text-[#005F96]">
                      {selected.latitud}, {selected.longitud}{" "}
                      {selected.precision_gps_m ? `(±${selected.precision_gps_m} m)` : ""}
                    </p>
                  </div>

                  <div>
                    <p className="font-black text-[#041A29]">Contraste Ground-Truth CRA</p>
                    <p className="mt-1 text-[#041A29]/80">
                      {selected.ground_truth_match?.nearest_point_id
                        ? `Punto oficial #${selected.ground_truth_match.nearest_point_id} a ${selected.ground_truth_match.dist_m} m (${
                            selected.ground_truth_match.es_manglar_consenso
                              ? "Consenso manglar"
                              : "Contraste"
                          })`
                        : "Dentro de cobertura costera CRA"}
                    </p>
                    {selected.ai_classification && (
                      <p className="mt-2 inline-flex items-start gap-1.5 font-bold text-[#005F96]">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          IA: {String(selected.ai_classification.clasificacion_tecnica || "")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Acciones de dictamen */}
                <div className="space-y-3 border-t border-[#041A29]/10 pt-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={techLabel}
                      onChange={(e) => setTechLabel(e.target.value)}
                      placeholder="Clasificación técnica académica"
                      className="min-h-[44px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs font-bold text-[#041A29]"
                    />
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={`Nota de dictamen (${validatorName})`}
                      className="min-h-[44px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs text-[#041A29]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDecision("aprobado")}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-[#16794A] px-5 text-xs font-black text-white transition hover:bg-[#115E39]"
                    >
                      <UserCheck className="h-4 w-4" />
                      {role === "mentor_comunitario"
                        ? "Avalar Mentor Comunitario"
                        : role === "mentor_academico"
                        ? "Avalar Mentor Académico"
                        : "Validar reporte"}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDecision("alerta_oficial")}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-[#005F96] px-5 text-xs font-black text-white transition hover:bg-[#041A29]"
                    >
                      <AlertTriangle className="h-4 w-4 text-[#F8D86F]" />
                      Emitir Alerta Oficial CRA
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDecision("descartado")}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-lg border border-[#C84023]/40 bg-[#C84023]/10 px-4 text-xs font-black text-[#9F2D15] transition hover:bg-[#C84023]/20"
                    >
                      <XCircle className="h-4 w-4" />
                      Descartar
                    </button>
                  </div>
                </div>

                {/* Historial de trazabilidad */}
                {selected.validations && selected.validations.length > 0 && (
                  <div className="space-y-2 border-t border-[#041A29]/10 pt-4">
                    <p className="text-xs font-black text-[#041A29]">
                      Trazabilidad de avales registrados
                    </p>
                    {selected.validations.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[#041A29]/10 bg-[#EDF2F6]/60 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-black text-[#041A29]">
                            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#16794A]" />
                            {v.validator_name}
                          </span>{" "}
                          <span className="text-[#041A29]/70">({v.decision})</span>
                          {v.notes && <p className="mt-0.5 text-[#041A29]/75">{v.notes}</p>}
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-[#041A29]/55">
                          {new Date(v.created_at).toLocaleString("es-CO")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-[#041A29]/12 bg-white p-12 text-center text-sm font-bold text-[#041A29]/65">
                <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-[#005F96]" />
                No hay reportes en cola de validación todavía.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
