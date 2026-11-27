import { NextResponse } from "next/server";
import { CRA_SECTORS } from "@/lib/cra-domain";

export interface NasaFireHotspot {
  id: string;
  latitude: number;
  longitude: number;
  brightnessK: number;
  frpMw: number;
  confidence: string;
  satellite: string;
  acqDate: string;
  acqTimeUtc: string;
  dayNight: "D" | "N";
  inAtlantico: boolean;
  nearestSectorId: number;
  nearestSectorName: string;
  distanceToMangroveKm: number;
  riskTier: "critico_5km" | "vigilancia_15km" | "regional_caribe";
}

interface NasaCache {
  fetchedAt: number;
  atlantico: NasaFireHotspot[];
  caribe: NasaFireHotspot[];
  totalSouthAmericaScanned: number;
  sources: string[];
}

let CACHE: NasaCache | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCsvHotspots(csvText: string, sourceLabel: string): {
  total: number;
  caribe: NasaFireHotspot[];
} {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return { total: 0, caribe: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => headers.indexOf(name);
  const iLat = idx("latitude");
  const iLon = idx("longitude");
  const iBright = idx("bright_ti4") >= 0 ? idx("bright_ti4") : idx("brightness");
  const iDate = idx("acq_date");
  const iTime = idx("acq_time");
  const iSat = idx("satellite");
  const iConf = idx("confidence");
  const iFrp = idx("frp");
  const iDn = idx("daynight");

  if (iLat < 0 || iLon < 0) return { total: 0, caribe: [] };

  const caribe: NasaFireHotspot[] = [];
  let total = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    total += 1;
    const cols = line.split(",");
    const lat = Number(cols[iLat]);
    const lon = Number(cols[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    // Filtro Caribe Colombiano cercano (Atlántico + Bolívar Norte + Magdalena Occidental)
    if (lat < 9.8 || lat > 11.55 || lon < -75.85 || lon > -74.0) continue;

    const inAtlantico = lat >= 10.22 && lat <= 11.2 && lon >= -75.4 && lon <= -74.65;

    let nearest = CRA_SECTORS[0];
    let minKm = Infinity;
    for (const sec of CRA_SECTORS) {
      const d = haversineKm(lat, lon, sec.centroidLat, sec.centroidLon);
      if (d < minKm) {
        minKm = d;
        nearest = sec;
      }
    }

    const distRounded = Number(minKm.toFixed(1));
    const riskTier: NasaFireHotspot["riskTier"] =
      distRounded <= 5
        ? "critico_5km"
        : distRounded <= 15
        ? "vigilancia_15km"
        : "regional_caribe";

    const rawTime = (cols[iTime] || "").padStart(4, "0");
    const acqTimeUtc = rawTime.length === 4 ? `${rawTime.slice(0, 2)}:${rawTime.slice(2)} UTC` : rawTime;

    caribe.push({
      id: `${sourceLabel}-${lat.toFixed(4)}-${lon.toFixed(4)}-${rawTime}`,
      latitude: lat,
      longitude: lon,
      brightnessK: Number(Number(cols[iBright] || 0).toFixed(1)),
      frpMw: Number(Number(cols[iFrp] || 0).toFixed(2)),
      confidence: (cols[iConf] || "nominal").trim(),
      satellite: (cols[iSat] || sourceLabel).trim(),
      acqDate: (cols[iDate] || "").trim(),
      acqTimeUtc,
      dayNight: cols[iDn] === "N" ? "N" : "D",
      inAtlantico,
      nearestSectorId: nearest.id,
      nearestSectorName: nearest.nombre,
      distanceToMangroveKm: distRounded,
      riskTier,
    });
  }

  return { total, caribe };
}

export async function fetchNasaFirmsData(): Promise<NasaCache> {
  if (CACHE && Date.now() - CACHE.fetchedAt < CACHE_TTL_MS) {
    return CACHE;
  }

  const feeds = [
    {
      label: "NOAA-20 VIIRS 375m",
      url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_24h.csv",
    },
    {
      label: "NOAA-21 VIIRS 375m",
      url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_America_24h.csv",
    },
  ];

  const allCaribe: NasaFireHotspot[] = [];
  let totalScanned = 0;
  const activeSources: string[] = [];

  await Promise.all(
    feeds.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: { "User-Agent": "ManglarVivoAtlanticoCRA/1.0" },
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
        if (!res.ok) return;
        const txt = await res.text();
        const parsed = parseCsvHotspots(txt, f.label);
        if (parsed.total > 0) {
          totalScanned += parsed.total;
          activeSources.push(f.label);
          allCaribe.push(...parsed.caribe);
        }
      } catch {
        // graceful fallback if one satellite feed is temporarily slow
      }
    })
  );

  // Deduplicar focos casi idénticos (misma celda 0.004°) y ordenar por cercanía al manglar
  const seen = new Set<string>();
  const uniqueCaribe = allCaribe
    .filter((h) => {
      const key = `${h.latitude.toFixed(3)},${h.longitude.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.distanceToMangroveKm - b.distanceToMangroveKm);

  const atlantico = uniqueCaribe.filter((h) => h.inAtlantico);

  CACHE = {
    fetchedAt: Date.now(),
    atlantico,
    caribe: uniqueCaribe.slice(0, 60),
    totalSouthAmericaScanned: totalScanned,
    sources: activeSources.length > 0 ? activeSources : ["NASA FIRMS VIIRS 375m (NRT)"],
  };
  return CACHE;
}

export async function GET() {
  try {
    const data = await fetchNasaFirmsData();
    return NextResponse.json(
      {
        source: "NASA FIRMS · VIIRS 375m Near Real-Time (últimas 24 h)",
        attribution: "Datos abiertos NASA Earthdata / FIRMS (sin clave requerida)",
        fetchedAt: new Date(data.fetchedAt).toISOString(),
        sources: data.sources,
        totalSouthAmericaScanned: data.totalSouthAmericaScanned,
        atlanticoCount: data.atlantico.length,
        caribeCount: data.caribe.length,
        closestHotspot: data.caribe[0] ?? null,
        atlantico: data.atlantico,
        caribe: data.caribe,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        source: "NASA FIRMS · VIIRS 375m",
        fetchedAt: new Date().toISOString(),
        atlanticoCount: 0,
        caribeCount: 0,
        atlantico: [],
        caribe: [],
      },
      { status: 200 }
    );
  }
}
