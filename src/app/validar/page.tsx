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
import { ReliabilityRing } from "@/components/ReliabilityRing";
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
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005F96]">
            Gobernanza · Rigor antes de activar operativos CRA
          </p>
          <h1 className="font-display mt-1 text-3xl font-black text-[#08334C]">
            Consola de Doble Validación y Semáforo
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#08334C]/12 bg-white p-2 shadow-sm">
          <span className="px-2 text-xs font-black text-[#08334C]/65">Rol activo:</span>
          {[
            { id: "mentor_comunitario", label: "Mentor Comunitario" },
            { id: "mentor_academico", label: "Mentor Académico" },
            { id: "cra_oficial", label: "Oficial CRA" },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id as typeof role)}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
                role === r.id
                  ? "bg-[#005F96] text-white"
                  : "bg-[#F7F3EA] text-[#08334C] hover:bg-[#08334C]/10"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
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
                className={`flex w-full items-center justify-between gap-3 rounded-3xl border p-4 text-left transition ${
                  active
                    ? "border-[#005F96] bg-white shadow-md ring-2 ring-[#005F96]/20"
                    : "border-[#08334C]/10 bg-white/85 hover:bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#005F96]">{r.tracking_code}</span>
                    <span className="rounded-full bg-[#F7F3EA] px-2.5 py-0.5 text-[10px] font-black text-[#08334C]">
                      {r.estado_validacion}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-black text-[#08334C]">{r.zona_manglar}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[#08334C]/70">
                    {r.descripcion_ciudadana || r.tipo_evento}
                  </p>
                </div>
                <ReliabilityRing score={r.puntaje_confiabilidad} size={56} />
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7">
          {selected && breakdown ? (
            <div className="bezel-outer">
              <div className="bezel-inner space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#005F96]">
                      {selected.tracking_code} · {selected.municipio}
                    </span>
                    <h2 className="font-display text-2xl font-bold text-[#08334C]">
                      {selected.zona_manglar}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-[#08334C]/70">{breakdown.label}</p>
                  </div>
                  <ReliabilityRing score={breakdown.score} size={86} />
                </div>

                {selected.evidencia_foto_url && (
                  <img
                    src={selected.evidencia_foto_url}
                    alt={`Evidencia ${selected.tracking_code}`}
                    className="h-60 w-full rounded-2xl object-cover"
                  />
                )}

                <div className="grid gap-3 rounded-2xl bg-[#F7F3EA] p-4 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-black text-[#08334C]">Relato ciudadano</p>
                    <p className="mt-1 text-[#08334C]/80">
                      {selected.descripcion_ciudadana || "Sin relato textual."}
                    </p>
                    <p className="mt-2 font-bold text-[#005F96]">
                      GPS: {selected.latitud}, {selected.longitud}{" "}
                      {selected.precision_gps_m ? `(±${selected.precision_gps_m} m)` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="font-black text-[#08334C]">Contraste Ground-Truth CRA</p>
                    <p className="mt-1 text-[#08334C]/80">
                      {selected.ground_truth_match?.nearest_point_id
                        ? `Punto oficial #${selected.ground_truth_match.nearest_point_id} a ${selected.ground_truth_match.dist_m} m (${
                            selected.ground_truth_match.es_manglar_consenso
                              ? "Consenso manglar"
                              : "Contraste"
                          })`
                        : "En zona costera CRA"}
                    </p>
                    {selected.ai_classification && (
                      <p className="mt-2 inline-flex items-start gap-1 text-[#005F96]">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          IA: {String(selected.ai_classification.clasificacion_tecnica || "")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {breakdown.factors.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between rounded-xl border border-[#08334C]/10 bg-white px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-[#08334C]">{f.label}</span>
                      <span
                        className={`tabular-nums font-black ${
                          f.met ? "text-[#1F7A4C]" : "text-[#08334C]/45"
                        }`}
                      >
                        +{f.points}/{f.maxPoints}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-[#08334C]/10 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={techLabel}
                      onChange={(e) => setTechLabel(e.target.value)}
                      placeholder="Clasificación técnica académica"
                      className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={`Nota de validación (${validatorName})`}
                      className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDecision("aprobado")}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#1F7A4C] px-5 py-2 text-xs font-black text-white"
                    >
                      <UserCheck className="h-4 w-4" />
                      {role === "mentor_comunitario"
                        ? "Avalar Mentor Comunitario"
                        : role === "mentor_academico"
                        ? "Avalar Mentor Académico"
                        : "Validar"}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDecision("alerta_oficial")}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#005F96] px-5 py-2 text-xs font-black text-white"
                    >
                      <AlertTriangle className="h-4 w-4 text-[#F8D86F]" />
                      Emitir Alerta Oficial CRA
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDecision("descartado")}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[#D94E2A]/35 bg-[#D94E2A]/10 px-4 py-2 text-xs font-black text-[#D94E2A]"
                    >
                      <XCircle className="h-4 w-4" />
                      Descartar
                    </button>
                  </div>
                </div>

                {selected.validations && selected.validations.length > 0 && (
                  <div className="space-y-1.5 border-t border-[#08334C]/10 pt-3">
                    {selected.validations.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-start justify-between gap-2 rounded-xl bg-[#F7F3EA]/75 px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-black text-[#08334C]">
                            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#1F7A4C]" />
                            {v.validator_name}
                          </span>{" "}
                          <span className="text-[#08334C]/70">({v.decision})</span>
                          {v.notes && <p className="text-[#08334C]/75">{v.notes}</p>}
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-[#08334C]/55">
                          {new Date(v.created_at).toLocaleString("es-CO")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bezel-outer">
              <div className="bezel-inner p-10 text-center text-sm font-bold text-[#08334C]/65">
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-[#005F96]" />
                No hay reportes en cola todavía.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
