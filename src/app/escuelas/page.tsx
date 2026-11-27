"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, GraduationCap, Search, Sparkles } from "lucide-react";
import { MascotaCangrejo } from "@/components/MascotaCangrejo";

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
  { id: "nuevo", label: "1. Recibido", hint: "Tu foto llegó a la red" },
  { id: "validado_comunitario", label: "2. Mentor Local", hint: "Confirmado en terreno" },
  { id: "validado_academico", label: "3. Mentor Académico", hint: "Clasificado por expertos" },
  { id: "alerta_oficial_cra", label: "4. ¡CRA en acción!", hint: "Atendido por la Corporación" },
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
    <div className="mx-auto max-w-6xl px-4 pt-4">
      {/* Hero escolar ilustrado */}
      <div className="bezel-outer">
        <div className="bezel-inner grid items-center gap-6 overflow-hidden p-6 sm:p-9 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F7A4C]/12 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
              <GraduationCap className="h-4 w-4" />
              Modo Escuelas · Misión 828 ha por revisar
            </span>
            <h1 className="font-display mt-3 text-3xl font-black text-[#08334C] sm:text-4xl">
              ¡Guardianes Escolares del Atlántico!
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#08334C]/80">
              Cada colegio adopta zonas marcadas como <strong>828 hectáreas por revisar</strong> en Juan de Acosta, Totumo y Mallorquín. Tus fotos en salida pedagógica ayudan a actualizar el mapa satelital de la CRA.
            </p>

            {/* Barra visual de reto */}
            <div className="mt-4 rounded-2xl bg-[#F7F3EA] p-4">
              <div className="mb-1.5 flex items-center justify-between text-xs font-black">
                <span className="text-[#08334C]">Progreso escolar de verificación</span>
                <span className="tabular-nums text-[#1F7A4C]">
                  {schoolReports.length} reportes verificados
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1F7A4C] to-[#EDB512]"
                  style={{ width: `${Math.min(100, Math.max(18, schoolReports.length * 14))}%` }}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div className="min-w-[250px] flex-1">
                <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                  Elige tu institución educativa
                </label>
                <select
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm font-bold text-[#08334C]"
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
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#005F96] px-6 py-2.5 text-sm font-black text-white shadow-md hover:bg-[#08334C]"
              >
                <Sparkles className="h-4 w-4 text-[#F8D86F]" />
                Registrar salida escolar
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <img
              src="/images/escuelas-guardianes.png"
              alt="Estudiantes del Caribe observando manglares"
              className="h-72 w-full rounded-3xl object-cover shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Cierre de ciclo visual + Tablero escolar */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="bezel-outer lg:col-span-6">
          <div className="bezel-inner space-y-5 p-6">
            <MascotaCangrejo
              size="sm"
              title="Cierre de ciclo CRA"
              message="Escribe tu código de reporte para ver en qué paso va tu alerta y cómo ayudó al manglar."
            />

            <form onSubmit={handleLookup} className="flex gap-2">
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Ej. MGL-2026-0101"
                className="min-h-[46px] flex-1 rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-4 text-sm font-black uppercase text-[#08334C]"
              />
              <button
                type="submit"
                className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl bg-[#005F96] px-5 text-xs font-black text-white"
              >
                <Search className="h-4 w-4" />
                Consultar
              </button>
            </form>

            {foundReport ? (
              <div className="space-y-4 rounded-2xl bg-[#F7F3EA] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#005F96]">
                    {foundReport.tracking_code} · {foundReport.zona_manglar}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-[#1F7A4C]">
                    {foundReport.puntaje_confiabilidad}/100 pts
                  </span>
                </div>

                {/* Rastreador de 4 estaciones */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CYCLE_STEPS.map((st, idx) => {
                    const done = idx <= activeStage;
                    return (
                      <div
                        key={st.id}
                        className={`rounded-xl p-2.5 text-center text-[11px] ${
                          done
                            ? "bg-[#1F7A4C] text-white shadow-sm"
                            : "bg-white text-[#08334C]/55"
                        }`}
                      >
                        <CheckCircle2
                          className={`mx-auto mb-1 h-4 w-4 ${
                            done ? "text-[#F8D86F]" : "text-[#08334C]/25"
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
              <p className="text-xs font-bold text-[#D94E2A]">
                No encontramos ese código todavía. Prueba con MGL-2026-0101 o MGL-2026-0104.
              </p>
            )}
          </div>
        </div>

        <div className="bezel-outer lg:col-span-6">
          <div className="bezel-inner p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-[#08334C]">
                Bitácora de aportes escolares
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F8D86F]/45 px-3 py-1 text-xs font-black text-[#08334C]">
                <Award className="h-3.5 w-3.5" /> Red PRAES
              </span>
            </div>

            <div className="space-y-3">
              {schoolReports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setLookupCode(r.tracking_code);
                    setFoundReport(r);
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#08334C]/10 bg-[#F7F3EA]/70 p-4 text-left text-xs transition hover:border-[#005F96] hover:bg-white"
                >
                  <div>
                    <p className="font-black text-[#08334C]">{r.school_name}</p>
                    <p className="text-[#08334C]/75">
                      {r.tracking_code} · {r.zona_manglar}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.en_zona_por_revisar && (
                      <span className="rounded-full bg-[#1F7A4C]/15 px-2.5 py-0.5 font-black text-[#1F7A4C]">
                        828 ha por revisar
                      </span>
                    )}
                    <span className="rounded-full bg-white px-2.5 py-0.5 font-bold text-[#005F96]">
                      {r.attention_status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
