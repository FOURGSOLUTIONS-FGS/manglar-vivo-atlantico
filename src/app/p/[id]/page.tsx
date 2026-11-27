import type { Metadata } from "next";
import { CRA_SECTORS, QR_STATIONS } from "@/lib/cra-domain";
import { createServerSupabase } from "@/lib/supabase";
import {
  NfcStationExperience,
  type SectorRecentReport,
  type StationMeta,
} from "@/components/NfcStationExperience";

export const dynamic = "force-dynamic";

const SHORT_ID_MAP: Record<string, string> = {
  "1": "mallorquin-sendero-1",
  "2": "puerto-velero-muelle",
  "3": "juan-acosta-estuario",
  "4": "totumo-astilleros",
  mallorquin: "mallorquin-sendero-1",
  "puerto-velero": "puerto-velero-muelle",
  "juan-acosta": "juan-acosta-estuario",
  totumo: "totumo-astilleros",
};

const STATION_VISUALS: Record<
  string,
  {
    shortCode: string;
    heroPhoto: string;
    audioSrc: string;
    urgencyNote: string;
    audioScript: string;
    fieldPhotos: Array<{ src: string; caption: string }>;
  }
> = {
  "mallorquin-sendero-1": {
    shortCode: "01",
    heroPhoto: "/images/turista-qr-sendero.jpg",
    audioSrc: "/media/audio/estacion-1.mp3",
    urgencyNote:
      "Borde urbano de mayor presión junto a Barranquilla · Concentra 70,659 toneladas de carbono azul.",
    audioScript:
      "Bienvenido al Sendero Ecológico de la Ciénaga de Mallorquín, entre Barranquilla y Puerto Colombia. Estás frente a la mayor reserva de carbono azul del Atlántico: más de setenta mil toneladas de carbono protegidas por las raíces del mangle rojo. Si miras con calma verás garzas blancas y cangrejos de manglar. Si observas basura, rellenos o algo fuera de lugar, toca el botón amarillo para reportarlo en menos de un minuto.",
    fieldPhotos: [
      { src: "/dataset/verificacion_828ha.jpg", caption: "Canal vivo de mangle rojo" },
      { src: "/dataset/avistamiento_fauna.jpg", caption: "Avifauna costera en raíces" },
    ],
  },
  "puerto-velero-muelle": {
    shortCode: "02",
    heroPhoto: "/images/hero-manglar-atlantico.jpg",
    audioSrc: "/media/audio/estacion-2.mp3",
    urgencyNote:
      "Corredor estuarino estratégico para amortiguación de oleaje y pesca artesanal · 105.8 ha por revisar.",
    audioScript:
      "Bienvenido al manglar de Puerto Velero y Balboa, en Puerto Colombia. Este corredor de mangle negro es la sala cuna natural de peces y crustáceos que sostienen a los pescadores locales, además de amortiguar la fuerza del oleaje del Caribe. Ayúdanos a cuidar sus caños y reporta cualquier erosión, basura o vertimiento con tu foto.",
    fieldPhotos: [
      { src: "/dataset/avistamiento_fauna.jpg", caption: "Fauna costera registrada" },
      { src: "/dataset/erosion_costera.jpg", caption: "Vigilancia de erosión de borde" },
    ],
  },
  "juan-acosta-estuario": {
    shortCode: "03",
    heroPhoto: "/images/hero-manglar-atlantico.jpg",
    audioSrc: "/media/audio/estacion-3.mp3",
    urgencyNote:
      "Sector prioridad crítica 2026: registró la anomalía de sequía más fuerte (-0.151) y riesgo 0.436.",
    audioScript:
      "Bienvenido al Estuario Costero de Juan de Acosta y Tubará. Este tramo es prioridad crítica para la CRA porque durante el fenómeno de El Niño de 2026 su dosel registró el mayor estrés por sequía de todo el Atlántico. Tus fotos desde aquí ayudan a confirmar dónde el mangle blanco se está secando y dónde sigue sano. Toca el botón amarillo y ayuda a proteger el Caribe.",
    fieldPhotos: [
      { src: "/dataset/dosel_seco.jpg", caption: "Vigilancia de dosel seco 2026" },
      { src: "/dataset/verificacion_828ha.jpg", caption: "Verificación de manglar sano" },
    ],
  },
  "totumo-astilleros": {
    shortCode: "04",
    heroPhoto: "/images/escuelas-guardianes.jpg",
    audioSrc: "/media/audio/estacion-4.mp3",
    urgencyNote:
      "Mayor rezago de verificación en campo del departamento: 451.8 ha de las 828 ha por revisar.",
    audioScript:
      "Bienvenido al Mirador de la Ciénaga del Totumo y Astilleros, en Piojó. Alrededor de este espejo de agua hay más de cuatrocientas cincuenta hectáreas que el satélite aún necesita confirmar en terreno. Cada foto tuya o de las escuelas de la zona convierte una duda satelital en dato oficial vivo para cuidar el manglar.",
    fieldPhotos: [
      { src: "/dataset/verificacion_828ha.jpg", caption: "Polígonos 828 ha por confirmar" },
      { src: "/dataset/cano_taponado.jpg", caption: "Monitoreo de caños y flujo de agua" },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const key = id.trim().toLowerCase();
  const mappedId = SHORT_ID_MAP[key] || key;
  const st = QR_STATIONS.find((s) => s.id === mappedId) ?? QR_STATIONS[2];
  const visuals = STATION_VISUALS[st.id] ?? STATION_VISUALS["juan-acosta-estuario"];
  const ogUrl = `/api/og?title=${encodeURIComponent(st.nombre)}&subtitle=${encodeURIComponent(
    st.datoClave
  )}&badge=${encodeURIComponent(`PUNTO NFC #${visuals.shortCode} · ${st.municipio.toUpperCase()}`)}`;

  return {
    title: `${st.nombre} · Punto NFC #${visuals.shortCode}`,
    description: st.datoClave,
    openGraph: {
      title: `${st.nombre} · Manglar Vivo Atlántico`,
      description: st.datoClave,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: st.nombre }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${st.nombre} · Punto NFC #${visuals.shortCode}`,
      description: st.datoClave,
      images: [ogUrl],
    },
  };
}

export default async function NfcPointLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const key = id.trim().toLowerCase();
  const mappedId = SHORT_ID_MAP[key] || key;
  const baseStation = QR_STATIONS.find((s) => s.id === mappedId) ?? QR_STATIONS[2];
  const sector = CRA_SECTORS.find((s) => s.id === baseStation.sectorId) ?? CRA_SECTORS[2];
  const visuals = STATION_VISUALS[baseStation.id] ?? STATION_VISUALS["juan-acosta-estuario"];

  const station: StationMeta = {
    ...baseStation,
    shortCode: visuals.shortCode,
    heroPhoto: visuals.heroPhoto,
    audioSrc: visuals.audioSrc,
    urgencyNote: visuals.urgencyNote,
    audioScript: visuals.audioScript,
    fieldPhotos: visuals.fieldPhotos,
  };

  let recentReports: SectorRecentReport[] = [];
  let totalSectorReports = 0;
  try {
    const supabase = createServerSupabase();
    const { data, count } = await supabase
      .from("citizen_reports")
      .select(
        "id,tracking_code,descripcion_ciudadana,evidencia_foto_url,puntaje_confiabilidad,estado_validacion,timestamp_captura",
        { count: "exact" }
      )
      .eq("sector_id", sector.id)
      .order("created_at", { ascending: false })
      .limit(2);
    recentReports = (data as SectorRecentReport[] | null) ?? [];
    totalSectorReports = count ?? recentReports.length;
  } catch {
    // fallback graceful si falla red
  }

  return (
    <NfcStationExperience
      station={station}
      sector={sector}
      recentReports={recentReports}
      totalSectorReports={totalSectorReports}
    />
  );
}
