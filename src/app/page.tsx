import Link from "next/link";
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Compass,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Trees,
  WifiOff,
} from "lucide-react";
import { CRA_GLOBAL_METRICS, CRA_SECTORS } from "@/lib/cra-domain";

export default function HomePage() {
  const totalCo2e = Math.round(
    CRA_GLOBAL_METRICS.reservaCarbonoTc * CRA_GLOBAL_METRICS.co2eFactor
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-10">
      {/* HERO CARIBE EDITORIAL */}
      <section className="bezel-outer">
        <div className="bezel-inner relative overflow-hidden">
          <div className="grid items-stretch lg:grid-cols-12">
            <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-7">
              <div>
                <div className="mb-5 inline-flex flex-wrap items-center gap-2 rounded-full bg-[#005F96]/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#005F96]">
                  <span className="h-2 w-2 rounded-full bg-[#1F7A4C]" />
                  <span>CRA Atlántico · Ciencia Ciudadana 2026</span>
                </div>

                <h1 className="font-display text-3xl font-black leading-[1.03] tracking-tight text-[#08334C] sm:text-5xl">
                  Cuidamos el manglar del Atlántico en tiempo real, incluso sin señal.
                </h1>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-[#08334C]/80 sm:text-lg">
                  Cualquier persona —estudiantes, pescadores, turistas y entidades— puede reportar amenazas o verificar en campo las{" "}
                  <strong className="font-black text-[#08334C]">828 hectáreas por revisar</strong>{" "}
                  cruzando cada foto GPS con las capas oficiales de la CRA.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/reportar"
                  className="group inline-flex min-h-[52px] items-center gap-3 rounded-full bg-[#005F96] py-2 pl-6 pr-2 text-sm font-black text-white shadow-lg shadow-[#005F96]/25 transition-all duration-300 ease-coastal hover:bg-[#08334C] active:scale-[0.98]"
                >
                  <span>Reportar en 3 pasos (Offline)</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDB512] text-[#08334C] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:scale-105">
                    <Camera className="h-4 w-4" strokeWidth={2} />
                  </span>
                </Link>

                <Link
                  href="/cra"
                  className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-full border border-[#08334C]/15 bg-[#F7F3EA] px-5 py-2.5 text-sm font-bold text-[#08334C] transition-all duration-300 ease-coastal hover:border-[#005F96] hover:bg-white"
                >
                  <MapPin className="h-4 w-4 text-[#005F96]" strokeWidth={1.8} />
                  <span>Abrir Panel CRA en vivo</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#08334C]/10 pt-5 text-xs font-bold text-[#08334C]/70">
                <span className="inline-flex items-center gap-1.5">
                  <WifiOff className="h-4 w-4 text-[#D94E2A]" strokeWidth={1.7} />
                  Funciona en modo avión
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#1F7A4C]" strokeWidth={1.7} />
                  Doble validación + IA
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#005F96]" strokeWidth={1.7} />
                  Cruce con 524 puntos CRA
                </span>
              </div>
            </div>

            <div className="relative min-h-[280px] lg:col-span-5">
              <img
                src="/images/hero-manglar-atlantico.png"
                alt="Manglar rojo en el departamento del Atlántico al amanecer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08334C]/85 via-[#08334C]/15 to-transparent lg:bg-gradient-to-r lg:from-[#08334C]/30 lg:via-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/20 bg-[#08334C]/75 p-4 text-white backdrop-blur-md">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#F8D86F]">
                  Estado satelital CRA · 2026
                </p>
                <p className="mt-1 text-sm font-bold leading-snug">
                  Tubará – Juan de Acosta registra la mayor sequía del dosel (-0.151) y requiere vigilancia prioritaria.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO DE CIFRAS OFICIALES VERIFICADAS */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005F96]">
              Línea base oficial CRA · Sentinel-2 &amp; KMZ
            </p>
            <h2 className="font-display text-2xl font-bold text-[#08334C]">
              Por qué cada reporte ciudadano importa hoy
            </h2>
          </div>
          <span className="text-xs font-bold text-[#08334C]/65">
            14,732 polígonos de prioridad · 524 puntos ground-truth
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              kicker: "Cobertura base",
              value: `${CRA_GLOBAL_METRICS.manglarProbableHa} ha`,
              sub: `${CRA_GLOBAL_METRICS.altaProbabilidadHa} ha con probabilidad alta · ${CRA_GLOBAL_METRICS.planManglarFueraHa} ha fuera de zonificación`,
              accent: "text-[#1F7A4C]",
            },
            {
              kicker: "Reto prioritario",
              value: `${CRA_GLOBAL_METRICS.porRevisarHa} ha`,
              sub: "Áreas por revisar en campo (451.8 ha en Totumo–Galerazamba y 102.3 ha en Juan de Acosta)",
              accent: "text-[#005F96]",
            },
            {
              kicker: "Alerta El Niño 2026",
              value: `${CRA_GLOBAL_METRICS.doselSeco2026Ha} ha`,
              sub: "Dosel claramente más seco (-0.10). El seguimiento comunitario previene pérdidas.",
              accent: "text-[#D94E2A]",
            },
            {
              kicker: "Carbono azul protegido",
              value: `${(CRA_GLOBAL_METRICS.reservaCarbonoTc / 1000).toFixed(0)}k tC`,
              sub: `Equivale a ~${totalCo2e.toLocaleString("es-CO")} t CO₂e retenidas en suelo y árboles`,
              accent: "text-[#08334C]",
            },
          ].map((stat) => (
            <div key={stat.kicker} className="bezel-outer">
              <div className="bezel-inner flex h-full flex-col justify-between p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#08334C]/60">
                  {stat.kicker}
                </p>
                <p className={`tabular-nums mt-2 font-display text-4xl font-black ${stat.accent}`}>
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#08334C]/75">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LAS 3 PREGUNTAS DE GOBERNANZA (CON IMÁGENES A MEDIDA) */}
      <section className="mt-12">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005F96]">
            Gobernanza abierta y sostenible
          </p>
          <h2 className="font-display text-2xl font-bold text-[#08334C] sm:text-3xl">
            Tres respuestas claras para proteger el Atlántico
          </h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Pregunta 1 */}
          <div className="bezel-outer">
            <div className="bezel-inner flex h-full flex-col justify-between p-6">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#D94E2A]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#D94E2A]">
                    1 · Inmediatez y ubicación
                  </span>
                  <MapPin className="h-5 w-5 text-[#005F96]" strokeWidth={1.6} />
                </div>
                <h3 className="font-display text-xl font-bold text-[#08334C]">
                  ¿Dónde ocurre ahora mismo y con qué prioridad coincide?
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#08334C]/75">
                  Cada reporte guarda fecha ISO-8601, GPS real y se cruza —incluso sin internet— con los polígonos del KMZ de la CRA, las 828 ha por revisar y las microcuencas costeras.
                </p>
              </div>
              <div className="mt-5 space-y-2 border-t border-[#08334C]/10 pt-4">
                {CRA_SECTORS.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#08334C]">{s.nombre.split(" – ")[0]}</span>
                    <span className="tabular-nums rounded-full bg-[#F7F3EA] px-2.5 py-0.5 font-bold text-[#005F96]">
                      Riesgo {s.riesgoMedio}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pregunta 2 */}
          <div className="bezel-outer">
            <div className="bezel-inner flex h-full flex-col justify-between p-6">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#1F7A4C]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#1F7A4C]">
                    2 · Rigor antes de operar
                  </span>
                  <ShieldCheck className="h-5 w-5 text-[#1F7A4C]" strokeWidth={1.6} />
                </div>
                <h3 className="font-display text-xl font-bold text-[#08334C]">
                  ¿Cómo validamos el dato antes de emitir alerta oficial?
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#08334C]/75">
                  Combinamos fotografía con EXIF intacto, preclasificación IA, contraste con los 524 puntos <em>ground-truth</em> y doble aval: <strong>mentor comunitario</strong> + <strong>mentor académico</strong> en el Semáforo 0–100.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#F7F3EA] p-3.5">
                <img
                  src="/images/mascota-cangrejo-vigia.png"
                  alt="Cangrejo Vigía del Manglar"
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                />
                <div className="text-xs">
                  <p className="font-black text-[#08334C]">Semáforo de Confiabilidad</p>
                  <p className="mt-0.5 text-[#08334C]/75">
                    75–100 pts pasa directo a la Sala Operativa CRA y genera datos abiertos Gobierno Digital.
                  </p>
                  <Link href="/validar" className="mt-1 inline-block font-black text-[#005F96] underline">
                    Ir a consola de mentores →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Pregunta 3 */}
          <div className="bezel-outer">
            <div className="bezel-inner flex h-full flex-col justify-between overflow-hidden p-6">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#EDB512]/25 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#08334C]">
                    3 · Escuelas y Turistas
                  </span>
                  <GraduationCap className="h-5 w-5 text-[#005F96]" strokeWidth={1.6} />
                </div>
                <h3 className="font-display text-xl font-bold text-[#08334C]">
                  ¿Cómo sostener la participación en el tiempo?
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#08334C]/75">
                  Escuelas con retos sobre las 828 ha por revisar, turistas con acceso QR sin registro en 60 segundos, y cierre de ciclo público cuando la CRA atiende cada caso.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <Link
                  href="/escuelas"
                  className="group overflow-hidden rounded-2xl border border-[#08334C]/10 bg-[#F7F3EA]"
                >
                  <img
                    src="/images/escuelas-guardianes.png"
                    alt="Estudiantes guardianes del manglar"
                    className="h-24 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="p-2.5">
                    <span className="flex items-center justify-between text-xs font-black text-[#08334C]">
                      Modo Escuelas
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#005F96]" />
                    </span>
                  </div>
                </Link>
                <Link
                  href="/turista"
                  className="group overflow-hidden rounded-2xl border border-[#08334C]/10 bg-[#F7F3EA]"
                >
                  <img
                    src="/images/turista-qr-sendero.png"
                    alt="Sendero turístico en manglar del Atlántico"
                    className="h-24 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="p-2.5">
                    <span className="flex items-center justify-between text-xs font-black text-[#08334C]">
                      Turistas QR
                      <Compass className="h-3.5 w-3.5 text-[#1F7A4C]" />
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PUENTE DIRECTO CON /MAQUETA DE LA CRA */}
      <section className="mt-10">
        <div className="bezel-outer">
          <div className="bezel-inner flex flex-col items-start justify-between gap-4 bg-gradient-to-r from-[#005F96] to-[#08334C] p-7 text-white md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F8D86F]">
                Evolución real de manglarcra.netlify.app/maqueta
              </p>
              <h2 className="font-display mt-1 text-2xl font-bold">
                Registro obligatorio de actores, checklists Res. 1263/2018 y formulador MGA / CO₂e
              </h2>
              <p className="mt-2 text-sm text-white/80">
                Conecta tu organización o escuela, propone siembras o restauración hidrológica sobre el mapa real y genera borradores prellenados con datos oficiales del Atlántico.
              </p>
            </div>
            <Link
              href="/participacion"
              className="group inline-flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-full bg-[#EDB512] py-2 pl-5 pr-2 text-sm font-black text-[#08334C] transition hover:bg-[#F8D86F]"
            >
              <span>Abrir Actores y Proyectos</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#08334C] text-white">
                <Trees className="h-4 w-4" strokeWidth={1.8} />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
