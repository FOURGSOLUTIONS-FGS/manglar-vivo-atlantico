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
    urgencyNote: string;
    fieldPhotos: Array<{ src: string; caption: string }>;
  }
> = {
  "mallorquin-sendero-1": {
    shortCode: "01",
    heroPhoto: "/images/turista-qr-sendero.png",
    urgencyNote:
      "Borde urbano de mayor presión junto a Barranquilla · Concentra 70,659 toneladas de carbono azul.",
    fieldPhotos: [
      { src: "/dataset/verificacion_828ha.jpg", caption: "Canal vivo de mangle rojo" },
      { src: "/dataset/avistamiento_fauna.jpg", caption: "Avifauna costera en raíces" },
    ],
  },
  "puerto-velero-muelle": {
    shortCode: "02",
    heroPhoto: "/images/hero-manglar-atlantico.png",
    urgencyNote:
      "Corredor estuarino estratégico para amortiguación de oleaje y pesca artesanal · 105.8 ha por revisar.",
    fieldPhotos: [
      { src: "/dataset/avistamiento_fauna.jpg", caption: "Fauna costera registrada" },
      { src: "/dataset/erosion_costera.jpg", caption: "Vigilancia de erosión de borde" },
    ],
  },
  "juan-acosta-estuario": {
    shortCode: "03",
    heroPhoto: "/images/hero-manglar-atlantico.png",
    urgencyNote:
      "Sector prioridad crítica 2026: registró la anomalía de sequía más fuerte (-0.151) y riesgo 0.436.",
    fieldPhotos: [
      { src: "/dataset/dosel_seco.jpg", caption: "Vigilancia de dosel seco 2026" },
      { src: "/dataset/verificacion_828ha.jpg", caption: "Verificación de manglar sano" },
    ],
  },
  "totumo-astilleros": {
    shortCode: "04",
    heroPhoto: "/images/escuelas-guardianes.png",
    urgencyNote:
      "Mayor rezago de verificación en campo del departamento: 451.8 ha de las 828 ha por revisar.",
    fieldPhotos: [
      { src: "/dataset/verificacion_828ha.jpg", caption: "Polígonos 828 ha por confirmar" },
      { src: "/dataset/cano_taponado.jpg", caption: "Monitoreo de caños y flujo de agua" },
    ],
  },
};

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
    urgencyNote: visuals.urgencyNote,
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
