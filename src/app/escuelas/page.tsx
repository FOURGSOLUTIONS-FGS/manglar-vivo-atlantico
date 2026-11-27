"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, GraduationCap, Search, Sparkles } from "lucide-react";

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

export default function EscuelasPage() {
  const [school, setSchool] = useState(SCHOOLS[0]);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [lookupCode, setLookupCode] = useState("");
  const [foundReport, setFoundReport] = useState<SchoolReport | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setReports(d.reports || []))
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

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-8">
      <div className="bezel-outer">
        <div className="bezel-inner grid items-center gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F7A4C]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
              <GraduationCap className="h-4 w-4" />
              Modo Escuelas · Reto 828 ha por revisar
            </span>
            <h1 className="font-display mt-3 text-3xl font-black text-[#08334C] sm:text-4xl">
              Guardianes Escolares del Manglar del Atlántico
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#08334C]/80">
              Las instituciones educativas y sus PRAES verifican en campo las zonas marcadas como <strong>828 hectáreas por revisar</strong> (especialmente en Juan de Acosta y Totumo). Cada foto validada entrena el mapa oficial de la CRA.
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[#08334C]/65">
                  Selecciona tu colegio
                </label>
                <select
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm font-bold text-[#08334C]"
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
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#005F96] px-6 py-2.5 text-sm font-black text-white hover:bg-[#08334C]"
              >
                <Sparkles className="h-4 w-4 text-[#F8D86F]" />
                Registrar salida escolar
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <img
              src="/images/escuelas-guardianes.png"
              alt="Estudiantes del Caribe verificando manglares en el Atlántico"
              className="h-64 w-full rounded-2xl object-cover shadow-md"
            />
          </div>
        </div>
      </div>

      {/* Tablero escolar + Cierre de ciclo */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="bezel-outer lg:col-span-7">
          <div className="bezel-inner p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#08334C]">
                Tablero de aportes escolares
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F8D86F]/40 px-3 py-1 text-xs font-black text-[#08334C]">
                <Award className="h-3.5 w-3.5" /> {schoolReports.length} verificaciones
              </span>
            </div>

            <div className="space-y-2.5">
              {schoolReports.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F3EA] p-3.5 text-xs"
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cierre de ciclo */}
        <div className="bezel-outer lg:col-span-5">
          <div className="bezel-inner p-6">
            <div className="mb-3 flex items-center gap-3">
              <img
                src="/images/mascota-cangrejo-vigia.png"
                alt="Cangrejo Vigía"
                className="h-14 w-14 rounded-2xl object-cover"
              />
              <div>
                <h2 className="font-display text-xl font-bold text-[#08334C]">
                  Cierre de ciclo CRA
                </h2>
                <p className="text-xs text-[#08334C]/70">
                  Consulta qué pasó con tu reporte (ej. MGL-2026-0101)
                </p>
              </div>
            </div>

            <form onSubmit={handleLookup} className="mt-3 flex gap-2">
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Código MGL-2026-XXXX"
                className="min-h-[44px] flex-1 rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-sm font-bold uppercase"
              />
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#005F96] px-4 text-xs font-black text-white"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
            </form>

            {foundReport && (
              <div className="mt-4 rounded-2xl border border-[#1F7A4C]/25 bg-[#1F7A4C]/10 p-4 text-xs">
                <p className="font-black text-[#1F7A4C]">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  {foundReport.tracking_code} · {foundReport.zona_manglar}
                </p>
                <p className="mt-1 text-[#08334C]">
                  Validación: <strong>{foundReport.estado_validacion}</strong> · Estado CRA:{" "}
                  <strong>{foundReport.attention_status}</strong> ({foundReport.puntaje_confiabilidad}/100 pts)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
