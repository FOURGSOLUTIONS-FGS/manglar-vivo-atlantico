import type { ValidationStatus } from "./cra-domain";

export interface ReliabilityBreakdown {
  score: number;
  tier: "alta" | "media" | "baja";
  label: string;
  factors: {
    label: string;
    points: number;
    maxPoints: number;
    met: boolean;
  }[];
}

export function computeReliabilityScore(input: {
  hasPhoto: boolean;
  photoCount?: number;
  aiPhotoValid?: boolean | null;
  precisionGpsM?: number | null;
  inCoastalZone: boolean;
  isSimulatedGps?: boolean;
  timestampCaptura?: string | null;
  nearbyCorroborations?: number;
  nearGroundTruthM?: number | null;
  estadoValidacion?: ValidationStatus;
}): ReliabilityBreakdown {
  const count = input.photoCount ?? (input.hasPhoto ? 1 : 0);
  const hasPhoto = count > 0 || Boolean(input.hasPhoto);
  const photoRejectedByAi = hasPhoto && input.aiPhotoValid === false;

  // Multi-evidencia: 2+ fotos válidas dan el puntaje completo (25/25); 1 sola foto da 18/25
  let pPhoto = 0;
  if (!photoRejectedByAi) {
    if (count >= 2) pPhoto = 25;
    else if (hasPhoto) pPhoto = 18;
  }

  const precision = input.precisionGpsM ?? 999;
  const gpsPrecisionOk = !input.isSimulatedGps && precision <= 50;
  let pSpatial = 0;
  if (input.inCoastalZone && gpsPrecisionOk) pSpatial = 25;
  else if (input.inCoastalZone) pSpatial = 15;

  let isRecent = true;
  if (input.timestampCaptura) {
    const ageH = (Date.now() - new Date(input.timestampCaptura).getTime()) / 36e5;
    isRecent = ageH <= 24;
  }
  const pTime = isRecent ? 15 : 5;

  const hasCorroboration =
    (input.nearbyCorroborations ?? 0) > 0 ||
    (input.nearGroundTruthM != null && input.nearGroundTruthM <= 650);
  const pCorrob = hasCorrobOrFalse(hasCorroboration);

  const st = input.estadoValidacion ?? "nuevo";
  let pMentors = 0;
  if (st === "validado_comunitario") pMentors = 10;
  else if (st === "validado_academico" || st === "alerta_oficial_cra") pMentors = 20;

  const score = Math.min(100, pPhoto + pSpatial + pTime + pCorrob + pMentors);
  const tier = photoRejectedByAi
    ? "baja"
    : score >= 75
    ? "alta"
    : score >= 45
    ? "media"
    : "baja";

  const label = photoRejectedByAi
    ? "Evidencia observada por IA · Fotografía no corresponde a manglar"
    : tier === "alta"
    ? "Confiabilidad Alta · Lista para alerta oficial CRA"
    : tier === "media"
    ? "Confiabilidad Media · Requiere 2ª foto o aval de mentor"
    : "Confiabilidad Baja · Evidencia incompleta o fuera de zona";

  return {
    score,
    tier,
    label,
    factors: [
      {
        label: photoRejectedByAi
          ? "Foto rechazada por filtro visual IA (0/25)"
          : count >= 2
          ? `Multi-evidencia fotográfica (${count} fotos EXIF)`
          : hasPhoto
          ? "1 foto EXIF (añade 2ª toma para 25/25)"
          : "Sin fotografía adjunta",
        points: pPhoto,
        maxPoints: 25,
        met: pPhoto >= 25,
      },
      {
        label: input.isSimulatedGps
          ? "Ubicación en zona costera (Modo Demo)"
          : "GPS real preciso (<= 50 m) en zona CRA",
        points: pSpatial,
        maxPoints: 25,
        met: pSpatial >= 20,
      },
      { label: "Inmediatez de captura (< 24 h)", points: pTime, maxPoints: 15, met: pTime === 15 },
      { label: "Corroboración / cercanía ground-truth CRA", points: pCorrob, maxPoints: 15, met: pCorrob > 0 },
      { label: "Doble validación (Comunitario + Académico)", points: pMentors, maxPoints: 20, met: pMentors === 20 },
    ],
  };
}

function hasCorrobOrFalse(v: boolean): number {
  return v ? 15 : 0;
}
