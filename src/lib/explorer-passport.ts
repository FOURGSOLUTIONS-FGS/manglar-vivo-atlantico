export interface TrailChallengeItem {
  id: string;
  label: string;
  hint: string;
  suggestedDomain: "cobertura_suelo" | "agua_dosel" | "contaminacion" | "fauna_verificacion";
}

export interface TrailStationMeta {
  stationId: string;
  shortCode: "1" | "2" | "3" | "4";
  badgeTitle: string;
  municipio: string;
  shortName: string;
  lat: number;
  lon: number;
  heroPhoto: string;
  teaser: string;
  secretFact: string;
  challenges: TrailChallengeItem[];
}

export const TRAIL_STATIONS: TrailStationMeta[] = [
  {
    stationId: "mallorquin-sendero-1",
    shortCode: "1",
    badgeTitle: "Guardián del Carbono Azul",
    municipio: "Barranquilla – Pto. Colombia",
    shortName: "Ciénaga de Mallorquín",
    lat: 11.0442,
    lon: -74.8592,
    heroPhoto: "/images/turista-qr-sendero.png",
    teaser: "70,659 t de carbono azul frente a Barranquilla.",
    secretFact:
      "Una sola hectárea de mangle rojo aquí captura hasta 4 veces más carbono que un bosque tropical terrestre.",
    challenges: [
      {
        id: "m1-raices",
        label: "Encuentra las raíces zancudas del mangle rojo",
        hint: "Son arcos que sostienen el árbol sobre el agua salobre.",
        suggestedDomain: "fauna_verificacion",
      },
      {
        id: "m1-aves",
        label: "Avista una garza blanca o cangrejo de manglar",
        hint: "Mira en silencio hacia los canales laterales.",
        suggestedDomain: "fauna_verificacion",
      },
      {
        id: "m1-borde",
        label: "Verifica si el borde urbano está libre de basura o rellenos",
        hint: "Si ves plásticos o escombros, repórtalo en 1 toque.",
        suggestedDomain: "contaminacion",
      },
    ],
  },
  {
    stationId: "puerto-velero-muelle",
    shortCode: "2",
    badgeTitle: "Vigía de la Sala Cuna",
    municipio: "Puerto Colombia",
    shortName: "Puerto Velero – Balboa",
    lat: 10.9554,
    lon: -75.0412,
    heroPhoto: "/images/hero-manglar-atlantico.png",
    teaser: "Corredor estuarino que amortigua el oleaje del Caribe.",
    secretFact:
      "Más del 70 % de los peces y camarones de la pesca artesanal local crecen protegidos entre estas raíces.",
    challenges: [
      {
        id: "m2-neumatoforos",
        label: "Observa los neumatóforos del mangle negro",
        hint: "Parecen pequeños lápices saliendo del lodo para respirar oxígeno.",
        suggestedDomain: "fauna_verificacion",
      },
      {
        id: "m2-oleaje",
        label: "Revisa la línea de playa y raíces expuestas por oleaje",
        hint: "Si ves árboles caídos o erosión fuerte, márcalo en Agua y Dosel.",
        suggestedDomain: "agua_dosel",
      },
      {
        id: "m2-agua",
        label: "Comprueba el color y olor del agua junto al muelle",
        hint: "Reporta espuma inusual o manchas iridiscentes de combustible.",
        suggestedDomain: "contaminacion",
      },
    ],
  },
  {
    stationId: "juan-acosta-estuario",
    shortCode: "3",
    badgeTitle: "Centinela del Dosel 2026",
    municipio: "Tubará – Juan de Acosta",
    shortName: "Estuario Juan de Acosta",
    lat: 10.8719,
    lon: -75.0972,
    heroPhoto: "/images/hero-manglar-atlantico.png",
    teaser: "Zona crítica de sequía 2026 (-0.151 anomalía NDVI).",
    secretFact:
      "Este tramo registró el mayor estrés hídrico del Atlántico en 2026: cada foto ciudadana ayuda a medir su recuperación.",
    challenges: [
      {
        id: "m3-dosel",
        label: "Compara copas verdes vs. hojas amarillas o secas",
        hint: "Confirma en terreno lo que el satélite Sentinel-2 detectó desde el espacio.",
        suggestedDomain: "agua_dosel",
      },
      {
        id: "m3-cano",
        label: "Revisa si el caño tiene flujo libre o está taponado",
        hint: "Los taponamientos cortan el intercambio de agua y secan el manglar.",
        suggestedDomain: "agua_dosel",
      },
      {
        id: "m3-fauna",
        label: "Registra fauna activa o signos de tala en la ronda",
        hint: "Tu foto entra directo al tablero oficial CRA.",
        suggestedDomain: "cobertura_suelo",
      },
    ],
  },
  {
    stationId: "totumo-astilleros",
    shortCode: "4",
    badgeTitle: "Explorador de las 828 ha",
    municipio: "Piojó – Totumo",
    shortName: "Ciénaga del Totumo",
    lat: 10.7512,
    lon: -75.2384,
    heroPhoto: "/images/escuelas-guardianes.png",
    teaser: "451.8 ha pendientes por verificar en campo (55% del reto).",
    secretFact:
      "Aquí está la mayor oportunidad de ciencia ciudadana del departamento: convertir dudas satelitales en mapa oficial.",
    challenges: [
      {
        id: "m4-828",
        label: "Toma una foto abierta de manglar sano en zona por revisar",
        hint: "Cada foto validada ayuda a cerrar las 451.8 ha de Piojó.",
        suggestedDomain: "fauna_verificacion",
      },
      {
        id: "m4-borde",
        label: "Verifica que no haya quemas ni cercados avanzando",
        hint: "Las quemas en borde seco activan alerta roja automática.",
        suggestedDomain: "cobertura_suelo",
      },
      {
        id: "m4-aves",
        label: "Identifica aves acuáticas sobre el espejo de la ciénaga",
        hint: "El Totumo es refugio clave de avifauna costera.",
        suggestedDomain: "fauna_verificacion",
      },
    ],
  },
];

export interface ExplorerPassportState {
  visited: Record<string, string>; // shortCode -> ISO timestamp
  checkedChallenges: string[];
}

const STORAGE_KEY = "manglar_vivo_passport_v1";

export function readPassport(): ExplorerPassportState {
  if (typeof window === "undefined") {
    return { visited: {}, checkedChallenges: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visited: {}, checkedChallenges: [] };
    const parsed = JSON.parse(raw) as Partial<ExplorerPassportState>;
    return {
      visited: parsed.visited && typeof parsed.visited === "object" ? parsed.visited : {},
      checkedChallenges: Array.isArray(parsed.checkedChallenges)
        ? parsed.checkedChallenges
        : [],
    };
  } catch {
    return { visited: {}, checkedChallenges: [] };
  }
}

export function stampStationInPassport(shortCode: string): {
  state: ExplorerPassportState;
  justUnlocked: boolean;
} {
  const current = readPassport();
  const key = shortCode.replace(/^0+/, "");
  const already = Boolean(current.visited[key]);
  const next: ExplorerPassportState = {
    visited: {
      ...current.visited,
      [key]: current.visited[key] || new Date().toISOString(),
    },
    checkedChallenges: current.checkedChallenges,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  }
  return { state: next, justUnlocked: !already };
}

export function togglePassportChallenge(challengeId: string): ExplorerPassportState {
  const current = readPassport();
  const exists = current.checkedChallenges.includes(challengeId);
  const next: ExplorerPassportState = {
    ...current,
    checkedChallenges: exists
      ? current.checkedChallenges.filter((id) => id !== challengeId)
      : [...current.checkedChallenges, challengeId],
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  }
  return next;
}

export function getExplorerRank(visitedCount: number): {
  title: string;
  nextGoal: string;
} {
  if (visitedCount >= 4) {
    return {
      title: "Guardián del Caribe Atlántico",
      nextGoal: "¡Completaste las 4 estaciones costeras de la CRA!",
    };
  }
  if (visitedCount === 3) {
    return {
      title: "Vigía del Manglar",
      nextGoal: "Te falta solo 1 estación para completar tu Pasaporte Costero.",
    };
  }
  if (visitedCount === 2) {
    return {
      title: "Explorador Costero",
      nextGoal: "Visita 2 estaciones más para desbloquear el rango Guardián.",
    };
  }
  if (visitedCount === 1) {
    return {
      title: "Visitante Curioso",
      nextGoal: "Explora 3 puntos más a lo largo de la costa del Atlántico.",
    };
  }
  return {
    title: "Nuevo Explorador",
    nextGoal: "Acerca tu celular a una estación NFC o QR para ganar tu primer sello.",
  };
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
