"use client";

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import { CRA_SECTORS, type CraSectorInfo } from "./cra-domain";

export interface OfflineSpatialContext {
  sector: CraSectorInfo;
  inManglarProbable: boolean;
  inAltaProbabilidad: boolean;
  inPorRevisar828Ha: boolean;
  inDoselSeco2026: boolean;
  inRiesgoAlto: boolean;
  cienagaCercana: string | null;
  kmzPrioridad: string | null;
  kmzAccionPlan: string | null;
  kmzMicrocuenca: string | null;
  kmzAreaProtegida: string | null;
  fueraDeZonificacion: boolean;
  nearestGroundTruth: {
    pointId: number;
    clase: string;
    esManglar: boolean;
    distMeters: number;
  } | null;
  inCoastalBbox: boolean;
}

interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point;
  }>;
}

let cachedData: {
  sectors: GeoFeatureCollection;
  mangrove: GeoFeatureCollection;
  priorities: GeoFeatureCollection;
  groundTruth: GeoFeatureCollection;
} | null = null;

async function fetchJsonSafe(url: string): Promise<GeoFeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error cargando capa ${url}`);
  return res.json();
}

export async function preloadOfflineLayers() {
  if (cachedData) return cachedData;
  const [sectors, mangrove, priorities, groundTruth] = await Promise.all([
    fetchJsonSafe("/data/geo/cra_sectors.geojson"),
    fetchJsonSafe("/data/geo/cra_mangrove_layers.geojson"),
    fetchJsonSafe("/data/geo/coastal_priorities_light.geojson"),
    fetchJsonSafe("/data/geo/cra_ground_truth_pts.geojson"),
  ]);
  cachedData = { sectors, mangrove, priorities, groundTruth };
  return cachedData;
}

export async function analyzeLocationOffline(
  lat: number,
  lon: number
): Promise<OfflineSpatialContext> {
  const pt = point([lon, lat]);
  const inCoastalBbox = lat >= 10.45 && lat <= 11.15 && lon >= -75.4 && lon <= -74.75;

  // Fallback sector by nearest centroid
  let sector = CRA_SECTORS[0];
  let bestDist = Infinity;
  for (const s of CRA_SECTORS) {
    const d = distance(pt, point([s.centroidLon, s.centroidLat]), { units: "kilometers" });
    if (d < bestDist) {
      bestDist = d;
      sector = s;
    }
  }

  let inManglarProbable = false;
  let inAltaProbabilidad = false;
  let inPorRevisar828Ha = false;
  let inDoselSeco2026 = false;
  let inRiesgoAlto = false;
  let cienagaCercana: string | null = null;
  let kmzPrioridad: string | null = null;
  let kmzAccionPlan: string | null = null;
  let kmzMicrocuenca: string | null = null;
  let kmzAreaProtegida: string | null = null;
  let nearestGroundTruth: OfflineSpatialContext["nearestGroundTruth"] = null;

  try {
    const layers = await preloadOfflineLayers();

    for (const f of layers.sectors.features) {
      if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
        if (booleanPointInPolygon(pt, f as GeoJSON.Feature<GeoJSON.Polygon>)) {
          const sid = Number(f.properties.sector_id);
          const found = CRA_SECTORS.find((s) => s.id === sid);
          if (found) sector = found;
          break;
        }
      }
    }

    for (const f of layers.mangrove.features) {
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
      if (booleanPointInPolygon(pt, f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
        const layer = String(f.properties.layer ?? "");
        if (layer === "manglar_probable") inManglarProbable = true;
        else if (layer === "manglar_alta_probabilidad") {
          inAltaProbabilidad = true;
          inManglarProbable = true;
        } else if (layer === "por_revisar_828ha") inPorRevisar828Ha = true;
        else if (layer === "dosel_seco_2026") inDoselSeco2026 = true;
        else if (layer === "riesgo_alto") inRiesgoAlto = true;
        else if (layer === "cienaga") cienagaCercana = String(f.properties.nombre ?? "");
      }
    }

    for (const f of layers.priorities.features) {
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
      if (booleanPointInPolygon(pt, f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
        kmzPrioridad = String(f.properties.val_priori ?? "Alto");
        kmzAccionPlan = String(f.properties.accion_gen ?? "Preservación");
        kmzMicrocuenca = String(f.properties.nomuh ?? "") || null;
        kmzAreaProtegida = String(f.properties.zona ?? "") || String(f.properties.desc_i ?? "") || null;
        break;
      }
    }

    let minGtDist = Infinity;
    for (const f of layers.groundTruth.features) {
      if (f.geometry.type !== "Point") continue;
      const d = distance(pt, f as GeoJSON.Feature<GeoJSON.Point>, { units: "meters" });
      if (d < minGtDist) {
        minGtDist = d;
        nearestGroundTruth = {
          pointId: Number(f.properties.point_id),
          clase: String(f.properties.clase_interpretada ?? ""),
          esManglar: Boolean(f.properties.es_manglar_consenso),
          distMeters: Math.round(d),
        };
      }
    }
  } catch {
    // Si falló carga de geojson, devolvemos sector por centroide
  }

  return {
    sector,
    inManglarProbable,
    inAltaProbabilidad,
    inPorRevisar828Ha,
    inDoselSeco2026,
    inRiesgoAlto,
    cienagaCercana,
    kmzPrioridad,
    kmzAccionPlan,
    kmzMicrocuenca,
    kmzAreaProtegida,
    fueraDeZonificacion: inManglarProbable && !kmzAccionPlan,
    nearestGroundTruth,
    inCoastalBbox,
  };
}
