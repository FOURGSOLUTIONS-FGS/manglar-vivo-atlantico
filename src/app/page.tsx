"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Map as MapIcon,
  Pause,
  Play,
  ShieldCheck,
  Users,
} from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { CRA_GLOBAL_METRICS, FACTOR_DOMAINS } from "@/lib/cra-domain";
import { CoastalExplorer } from "@/components/CoastalExplorer";

export default function HomePage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        if (videoRef.current) {
          videoRef.current.pause();
          setPaused(true);
        }
        return;
      }

      // Entrada limpia del titular principal
      gsap.from("[data-hero-line]", {
        y: 36,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
      });

      // Zoom óptico controlado en scroll del video aéreo CRA
      gsap.to("[data-hero-media]", {
        scale: 1.09,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-hero-stage]",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Aparición editorial de métricas y secciones
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 28,
          opacity: 0,
          duration: 0.75,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 86%",
            once: true,
          },
        });
      });

      // Revelado con clip-path en fotografías territoriales
      gsap.utils.toArray<HTMLElement>("[data-clip-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: "inset(8% 0% 8% 0%)", opacity: 0.65 },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            opacity: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 84%",
              once: true,
            },
          }
        );
      });
    },
    { scope: rootRef }
  );

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div ref={rootRef} className="bg-[#041A29] text-[#041A29]">
      {/* CAPÍTULO 1: HERO CINEMATOGRÁFICO CON VIDEO OFICIAL CRA Y 2 PUERTAS */}
      <section data-hero-stage className="relative h-[126svh] bg-[#041A29]">
        <div className="sticky top-0 flex h-[100svh] flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <video
              ref={videoRef}
              data-hero-media
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/images/hero-manglar-atlantico.jpg"
              className="h-full w-full object-cover will-change-transform"
            >
              <source src="/media/portada_960.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#041A29] via-[#041A29]/45 to-[#041A29]/55" />
          </div>

          {/* Espacio superior para navbar fija */}
          <div className="relative z-10 mx-auto flex w-full max-w-[1440px] justify-end px-5 pt-24 lg:px-10">
            <button
              type="button"
              onClick={toggleVideo}
              aria-label={paused ? "Reproducir video aéreo" : "Pausar video aéreo"}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/25 bg-[#041A29]/65 px-3.5 text-xs font-bold text-white backdrop-blur-sm transition hover:border-[#EDB512]"
            >
              {paused ? <Play className="h-3.5 w-3.5 text-[#F8D86F]" /> : <Pause className="h-3.5 w-3.5 text-[#F8D86F]" />}
              <span>{paused ? "Reproducir vista aérea" : "Pausar vista aérea"}</span>
            </button>
          </div>

          {/* Titular monumental */}
          <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-8 lg:px-10 lg:pb-12">
            <div className="max-w-4xl">
              <h1
                data-hero-line
                className="font-display text-[clamp(2.45rem,6.1vw,5.4rem)] font-black leading-[0.94] text-white"
              >
                El manglar del Atlántico, vigilado por su gente.
              </h1>
              <p
                data-hero-line
                className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg"
              >
                Ciencia ciudadana offline, validación comunitaria y satelital en vivo para proteger los ecosistemas costeros desde Bocas de Ceniza hasta la Ciénaga del Totumo.
              </p>
            </div>
          </div>

          {/* Dos puertas operativas pegadas al borde inferior */}
          <div className="relative z-10 border-t border-white/15 bg-[#041A29]/85 backdrop-blur-md">
            <div className="mx-auto grid max-w-[1440px] sm:grid-cols-2">
              <Link
                href="/reportar"
                className="group flex min-h-[78px] items-center justify-between gap-4 bg-[#EDB512] px-6 py-4 text-[#041A29] transition hover:bg-[#F8D86F] lg:px-10"
              >
                <div>
                  <span className="flex items-center gap-2 font-display text-lg font-black">
                    <Camera className="h-5 w-5" strokeWidth={2.2} />
                    Reportar en campo
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-[#041A29]/80">
                    Funciona sin internet · 4 dominios claros · Foto EXIF y GPS honesto
                  </span>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/cra"
                className="group flex min-h-[78px] items-center justify-between gap-4 border-t border-white/12 px-6 py-4 text-white transition hover:bg-[#005F96] sm:border-l sm:border-t-0 lg:px-10"
              >
                <div>
                  <span className="flex items-center gap-2 font-display text-lg font-black">
                    <MapIcon className="h-5 w-5 text-[#F8D86F]" strokeWidth={2.1} />
                    Sala Operativa CRA
                  </span>
                  <span className="mt-0.5 block text-xs text-white/75">
                    Mapa satelital en vivo · 524 puntos ground-truth · Datos abiertos Ley 1581
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-[#F8D86F] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CAPÍTULO 2: CIFRAS TERRITORIALES SIN CAJAS DECORATIVAS */}
      <section className="border-t border-white/12 bg-[#041A29] py-20 text-white lg:py-24">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
          <div data-reveal className="max-w-3xl">
            <h2 className="font-display text-3xl font-black leading-[1.05] text-white sm:text-5xl">
              Datos satelitales reales que necesitan ojos en territorio
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/72">
              El monitoreo óptico y de radar de la CRA identificó zonas prioritarias y áreas con estrés hídrico tras El Niño 2026. Cada reporte ciudadano geolocalizado se cruza al instante contra estas capas oficiales.
            </p>
          </div>

          <div
            data-reveal
            className="mt-12 grid border-y border-white/15 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              {
                value: `${CRA_GLOBAL_METRICS.manglarProbableHa} ha`,
                title: "Manglar probable",
                detail: `${CRA_GLOBAL_METRICS.altaProbabilidadHa} ha de alta probabilidad · ${CRA_GLOBAL_METRICS.planManglarFueraHa} ha por fuera de zonificación actual.`,
                accent: "text-white",
              },
              {
                value: `${CRA_GLOBAL_METRICS.porRevisarHa} ha`,
                title: "Áreas por revisar en campo",
                detail: "Polígonos con cobertura incierta donde escuelas y vigías confirman estado real.",
                accent: "text-[#F8D86F]",
              },
              {
                value: `${CRA_GLOBAL_METRICS.doselSeco2026Ha} ha`,
                title: "Dosel más seco en 2026",
                detail: "Estrés hídrico y salinidad concentrados en Tubará y Juan de Acosta (-0.151).",
                accent: "text-[#FCA5A5]",
              },
              {
                value: `${CRA_GLOBAL_METRICS.reservaCarbonoTc.toLocaleString("es-CO")} tC`,
                title: "Reserva de carbono azul",
                detail: `Contraste continuo con ${CRA_GLOBAL_METRICS.groundTruthPoints} puntos ground-truth validados por la CRA.`,
                accent: "text-[#86EFAC]",
              },
            ].map((item, idx) => (
              <div
                key={item.title}
                className={`py-8 sm:px-6 ${
                  idx > 0 ? "border-t border-white/12 sm:border-t-0" : "sm:pl-0"
                } ${idx % 2 === 1 ? "sm:border-l sm:border-white/12" : ""} ${
                  idx >= 2 ? "sm:border-t lg:border-l lg:border-t-0 lg:border-white/12" : ""
                }`}
              >
                <p className={`font-display text-4xl font-black tabular-nums lg:text-5xl ${item.accent}`}>
                  {item.value}
                </p>
                <p className="mt-3 text-sm font-bold text-white">{item.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/65">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAPÍTULO 3: TEATRO SATELITAL INTERACTIVO CON RÁSTERS REALES CRA */}
      <CoastalExplorer />

      {/* CAPÍTULO 4: 4 DOMINIOS AMBIENTALES SEPARADOS (12 FACTORES EXACTOS) */}
      <section className="bg-white py-20 text-[#041A29] lg:py-28">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-6 border-b border-[#041A29]/12 pb-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-black leading-[1.03] text-[#041A29] sm:text-5xl">
                Cuatro dominios claros para clasificar lo que ves
              </h2>
              <p className="mt-3 text-base text-[#041A29]/72">
                Separamos las presiones ambientales en doce factores específicos para evitar mezclas ambiguas y dirigir cada alerta al equipo técnico correcto desde el primer toque.
              </p>
            </div>
            <Link
              href="/reportar"
              className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-[#005F96] px-5 text-sm font-black text-white transition hover:bg-[#041A29]"
            >
              <span>Iniciar reporte guiado</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div
            data-reveal
            className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4"
          >
            {FACTOR_DOMAINS.map((domain, index) => (
              <div
                key={domain.id}
                className="flex flex-col justify-between border-t-2 pt-5"
                style={{ borderTopColor: domain.accentHex }}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl font-black text-[#041A29]">
                      {domain.title}
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#041A29]/45">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#041A29]/70">
                    {domain.summary}
                  </p>

                  <ul className="mt-5 divide-y divide-[#041A29]/10 border-t border-[#041A29]/10">
                    {domain.subtypes.map((sub) => (
                      <li key={sub.id} className="py-3">
                        <Link
                          href={`/reportar?dominio=${domain.id}&subtipo=${sub.id}`}
                          className="group flex items-start justify-between gap-2"
                        >
                          <span>
                            <span className="block text-sm font-bold text-[#041A29] group-hover:text-[#005F96]">
                              {sub.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#041A29]/60">
                              {sub.description}
                            </span>
                          </span>
                          <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[#041A29]/35 transition group-hover:translate-x-0.5 group-hover:text-[#005F96]" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAPÍTULO 5: SOSTENIBILIDAD COMUNITARIA — ESCUELAS + TURISTAS QR */}
      <section className="border-t border-[#041A29]/10 bg-[#EDF2F6] py-20 text-[#041A29] lg:py-28">
        <div className="mx-auto max-w-[1440px] space-y-20 px-5 lg:px-10">
          {/* Split Escuelas */}
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div data-clip-reveal className="overflow-hidden rounded-xl lg:col-span-7">
              <img
                src="/images/escuelas-guardianes.jpg"
                loading="lazy"
                decoding="async"
                alt="Estudiantes del Atlántico realizando monitoreo ciudadano de manglares"
                className="h-[320px] w-full object-cover sm:h-[420px]"
              />
            </div>

            <div data-reveal className="space-y-5 lg:col-span-5">
              <h2 className="font-display text-3xl font-black leading-[1.05] text-[#041A29] sm:text-4xl">
                Escuelas que adoptan las 828 hectáreas por revisar
              </h2>
              <p className="text-base leading-relaxed text-[#041A29]/75">
                Instituciones educativas de Juan de Acosta, Piojó, Puerto Colombia y Barranquilla registran salidas PRAES, confirman cobertura viva y consultan en tiempo real cuándo su alerta pasa de reporte ciudadano a acción oficial de la CRA.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/escuelas"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#041A29] px-5 text-sm font-black text-white transition hover:bg-[#005F96]"
                >
                  <span>Entrar a Modo Escuelas</span>
                  <ArrowRight className="h-4 w-4 text-[#F8D86F]" />
                </Link>
                <Link
                  href="/reportar?perfil=estudiante_escuela"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-[#041A29]/20 bg-white px-5 text-sm font-bold text-[#041A29] transition hover:border-[#005F96]"
                >
                  Registrar salida
                </Link>
              </div>
            </div>
          </div>

          {/* Split Turistas QR */}
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div data-reveal className="order-2 space-y-5 lg:order-1 lg:col-span-5">
              <h2 className="font-display text-3xl font-black leading-[1.05] text-[#041A29] sm:text-4xl">
                Estaciones QR en senderos y muelles turísticos
              </h2>
              <p className="text-base leading-relaxed text-[#041A29]/75">
                Cualquier visitante escanea el punto en Mallorquín, Puerto Velero o Totumo, descubre en 30 segundos qué especies habitan ese tramo y reporta residuos o fauna sin crear cuentas ni formularios extensos.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/turista"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#005F96] px-5 text-sm font-black text-white transition hover:bg-[#041A29]"
                >
                  <span>Ver estaciones y códigos QR</span>
                  <ArrowRight className="h-4 w-4 text-[#F8D86F]" />
                </Link>
              </div>
            </div>

            <div data-clip-reveal className="order-1 overflow-hidden rounded-xl lg:order-2 lg:col-span-7">
              <img
                src="/images/turista-qr-sendero.jpg"
                loading="lazy"
                decoding="async"
                alt="Sendero elevado con estación QR en manglar del Caribe colombiano"
                className="h-[320px] w-full object-cover sm:h-[420px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CAPÍTULO 6: CAMPO INSTITUCIONAL AZUL CRA (#005F96) — GOBERNANZA Y VALIDACIÓN */}
      <section className="bg-[#005F96] py-20 text-white lg:py-24">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-10">
          <div data-reveal className="grid gap-10 lg:grid-cols-2 lg:divide-x lg:divide-white/20">
            <div className="space-y-5 lg:pr-10">
              <ShieldCheck className="h-8 w-8 text-[#F8D86F]" strokeWidth={1.8} />
              <h2 className="font-display text-3xl font-black leading-tight text-white">
                Doble validación antes de activar alertas oficiales
              </h2>
              <p className="text-sm leading-relaxed text-white/85 sm:text-base">
                Ningún dato sin verificar dispara operativos en falso. Cada reporte suma puntaje en el Semáforo de Confiabilidad (0–100) combinando foto con EXIF, GPS preciso, contraste con los 524 puntos ground-truth y aval de mentor comunitario y académico.
              </p>
              <Link
                href="/validar"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-[#041A29] transition hover:bg-[#F8D86F]"
              >
                <span>Abrir consola de mentores</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-5 border-t border-white/20 pt-10 lg:border-t-0 lg:pl-10 lg:pt-0">
              <Users className="h-8 w-8 text-[#F8D86F]" strokeWidth={1.8} />
              <h2 className="font-display text-3xl font-black leading-tight text-white">
                Actores, checklists Res. 1263/2018 y formulación MGA
              </h2>
              <p className="text-sm leading-relaxed text-white/85 sm:text-base">
                Organizaciones locales, ONG, academia y entidades públicas registran iniciativas sobre el mapa satelital, heredan automáticamente la acción del Plan de Manejo CRA y generan borradores prellenados MGA (DNP) y nota conceptual CO₂e.
              </p>
              <Link
                href="/participacion"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-white/35 px-5 text-sm font-black text-white transition hover:bg-white hover:text-[#041A29]"
              >
                <span>Ir a participación y proyectos</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PIE INSTITUCIONAL */}
      <footer className="border-t border-white/12 bg-[#041A29] py-14 text-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 lg:grid-cols-12 lg:px-10">
          <div className="space-y-3 lg:col-span-5">
            <img
              src="/media/logo_cra_blanco.png"
              alt="CRA Atlántico"
              className="h-10 w-auto object-contain"
            />
            <p className="max-w-md text-xs leading-relaxed text-white/65">
              Plataforma de ciencia ciudadana y gobernanza de manglares del departamento del Atlántico. Exportaciones abiertas CSV y GeoJSON anonimizadas conforme a la Ley 1581 de 2012. Asistencia de clasificación multimodal con Gemini vía OpenRouter y respaldo heurístico offline.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs sm:grid-cols-3 lg:col-span-7">
            <div className="space-y-2.5">
              <p className="font-bold text-[#F8D86F]">Campo</p>
              <Link href="/reportar" className="block text-white/75 hover:text-white">
                Reportar en campo
              </Link>
              <Link href="/escuelas" className="block text-white/75 hover:text-white">
                Modo Escuelas PRAES
              </Link>
              <Link href="/turista" className="block text-white/75 hover:text-white">
                Estaciones QR Turistas
              </Link>
            </div>
            <div className="space-y-2.5">
              <p className="font-bold text-[#F8D86F]">Gobernanza CRA</p>
              <Link href="/cra" className="block text-white/75 hover:text-white">
                Sala Operativa Satelital
              </Link>
              <Link href="/validar" className="block text-white/75 hover:text-white">
                Consola de Mentores
              </Link>
              <Link href="/participacion" className="block text-white/75 hover:text-white">
                Actores y Formulación MGA
              </Link>
            </div>
            <div className="space-y-2.5">
              <p className="font-bold text-[#F8D86F]">Datos abiertos</p>
              <a
                href="/api/open-data?format=csv"
                className="block text-white/75 hover:text-white"
              >
                Descargar CSV (Ley 1581)
              </a>
              <a
                href="/api/open-data?format=geojson"
                className="block text-white/75 hover:text-white"
              >
                Descargar GeoJSON
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
