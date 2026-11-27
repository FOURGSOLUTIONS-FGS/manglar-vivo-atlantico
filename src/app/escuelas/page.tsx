"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, GraduationCap, Search } from "lucide-react";

interface SchoolReport {
  id: string;
  tracking_code: string;
  school_name: string | null;
  zona_manglar: string;
  estado_validacion: string;
  attention_status: string;
  en_zona_por_revisar: boolean;
  timestamp_captura: string;
  puntaje_confiabilidad: number;
}

const SCHOOLS = [
  "I.E. Técnica Agropecuaria de Juan de Acosta",
  "I.E. El Totumo",
  "I.E. Eduardo Santos — La Playa (Mallorquín)",
  "I.E. San Nicolás de Tolentino — Puerto Colombia",
];

const CYCLE_STEPS = [
  { id: "nuevo", label: "1. Recibido", hint: "Foto y GPS registrados" },
  { id: "validado_comunitario", label: "2. Mentor Local", hint: "Confirmado en terreno" },
  { id: "validado_academico", label: "3. Mentor Académico", hint: "Validación técnica" },
  { id: "alerta_oficial_cra", label: "4. CRA en acción", hint: "Atendido en sala CRA" },
];

export default function EscuelasPage() {
  const [school, setSchool] = useState(SCHOOLS[0]);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [lookupCode, setLookupCode] = useState("MGL-2026-0101");
  const [foundReport, setFoundReport] = useState<SchoolReport | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.reports || []) as SchoolReport[];
        setReports(list);
        const first = list.find((x) => x.tracking_code === "MGL-2026-0101") ?? list[0] ?? null;
        setFoundReport(first);
      })
      .catch(() => {});
  }, []);

  const schoolReports = reports.filter((r) => r.school_name);
  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const match = reports.find(
      (r) => r.tracking_code.toUpperCase() === lookupCode.trim().toUpperCase()
    );
    setFoundReport(match || null);
  };

  const activeStage = foundReport
    ? foundReport.attention_status === "atendido" ||
      foundReport.estado_validacion === "alerta_oficial_cra"
      ? 3
      : foundReport.estado_validacion === "validado_academico"
      ? 2
      : foundReport.estado_validacion === "validado_comunitario"
      ? 1
      : 0
    : -1;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#EDF2F6]">
      {/* Hero escolar editorial */}
      <section className="border-b border-[#041A29]/10 bg-white">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-10 lg:grid-cols-12 lg:px-10 lg:py-14">
          <div className="space-y-5 lg:col-span-7">
            <h1 className="font-display text-3xl font-black leading-[1.03] text-[#041A29] sm:text-5xl">
              Red Escolar de Guardianes del Manglar
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#041A29]/75">
              Los colegios costeros del Atlántico adoptan polígonos de las{" "}
              <strong className="text-[#041A29]">828 hectáreas por revisar</strong> en Juan de Acosta, Totumo, Puerto Colombia y Mallorquín. Cada salida pedagógica suma evidencia real al mapa satelital de la CRA.
            </p>

            {/* Progreso de verificación escolar */}
            <div className="rounded-xl border border-[#041A29]/12 bg-[#EDF2F6] p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-bold">
                <span className="text-[#041A29]">Avance de aportes escolares PRAES</span>
                <span className="font-mono tabular-nums text-[#16794A]">
                  {schoolReports.length} reportes registrados
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-[2px] bg-white">
                <div
                  className="h-full bg-[#16794A] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(18, schoolReports.length * 16))}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="min-w-[260px] flex-1">
                <label
                  htmlFor="school-select"
                  className="mb-1.5 block text-xs font-bold text-[#041A29]/70"
                >
                  Institución educativa
                </label>
                <select
                  id="school-select"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="min-h-[48px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/60 px-3.5 text-sm font-bold text-[#041A29]"
                >
                  {SCHOOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Link
                href={`/reportar?perfil=estudiante_escuela&colegio=${encodeURIComponent(school)}`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#005F96] px-5 text-sm font-black text-white transition hover:bg-[#041A29]"
              >
                <GraduationCap className="h-4 w-4 text-[#F8D86F]" />
                <span>Registrar salida escolar</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl lg:col-span-5">
            <img
              src="/images/escuelas-guardianes.jpg"
              alt="Estudiantes del Atlántico participando en monitoreo costero"
              className="h-[300px] w-full object-cover sm:h-[360px]"
            />
          </div>
        </div>
      </section>

      {/* Cierre de ciclo + Bitácora escolar */}
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-10 lg:grid-cols-12 lg:px-10">
        <div className="space-y-5 rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8 lg:col-span-6">
          <div>
            <h2 className="font-display text-2xl font-black text-[#041A29]">
              Cierre de ciclo del reporte
            </h2>
            <p className="mt-1 text-sm text-[#041A29]/70">
              Ingresa un código de seguimiento para verificar en qué fase de validación y atención oficial se encuentra.
            </p>
          </div>

          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="Ej. MGL-2026-0101"
              className="min-h-[46px] flex-1 rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/60 px-4 font-mono text-sm font-bold uppercase text-[#041A29]"
            />
            <button
              type="submit"
              className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-[#041A29] px-5 text-xs font-black text-white transition hover:bg-[#005F96]"
            >
              <Search className="h-4 w-4 text-[#F8D86F]" />
              Consultar
            </button>
          </form>

          {foundReport ? (
            <div className="space-y-4 rounded-xl border border-[#041A29]/10 bg-[#EDF2F6]/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold text-[#005F96]">
                  {foundReport.tracking_code} · {foundReport.zona_manglar}
                </span>
                <span className="rounded bg-white px-2.5 py-0.5 font-mono font-bold text-[#16794A]">
                  {foundReport.puntaje_confiabilidad}/100 pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CYCLE_STEPS.map((st, idx) => {
                  const done = idx <= activeStage;
                  return (
                    <div
                      key={st.id}
                      className={`rounded-lg border p-3 text-left text-[11px] ${
                        done
                          ? "border-[#16794A] bg-[#16794A] text-white"
                          : "border-[#041A29]/10 bg-white text-[#041A29]/55"
                      }`}
                    >
                      <CheckCircle2
                        className={`mb-1.5 h-4 w-4 ${
                          done ? "text-[#F8D86F]" : "text-[#041A29]/25"
                        }`}
                      />
                      <p className="font-black leading-tight">{st.label}</p>
                      <p className="mt-0.5 text-[10px] opacity-85">{st.hint}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs font-bold text-[#C84023]">
              No encontramos ese código todavía. Prueba con MGL-2026-0101 o MGL-2026-0104.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8 lg:col-span-6">
          <div className="mb-5 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-black text-[#041A29]">
              Bitácora de aportes escolares
            </h2>
            <span className="font-mono text-xs font-bold text-[#005F96]">
              Red PRAES Atlántico
            </span>
          </div>

          <div className="divide-y divide-[#041A29]/10 border-y border-[#041A29]/10">
            {schoolReports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setLookupCode(r.tracking_code);
                  setFoundReport(r);
                }}
                className="flex w-full flex-wrap items-center justify-between gap-2 py-4 text-left text-xs transition hover:bg-[#EDF2F6]/60"
              >
                <div>
                  <p className="font-black text-[#041A29]">{r.school_name}</p>
                  <p className="mt-0.5 text-[#041A29]/70">
                    <span className="font-mono font-bold text-[#005F96]">{r.tracking_code}</span> ·{" "}
                    {r.zona_manglar}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.en_zona_por_revisar && (
                    <span className="rounded bg-[#16794A]/12 px-2 py-0.5 font-bold text-[#16794A]">
                      828 ha
                    </span>
                  )}
                  <span className="rounded bg-[#EDF2F6] px-2.5 py-0.5 font-bold text-[#041A29]">
                    {r.attention_status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
