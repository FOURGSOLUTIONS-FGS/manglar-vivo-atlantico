"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Globe, Map as MapIcon } from "lucide-react";
import { PLAN_COLORS } from "@/lib/cra-domain";

export interface MapReportItem {
  id: string;
  tracking_code: string;
  latitud: number;
  longitud: number;
  zona_manglar: string;
  tipo_evento: string;
  estado_validacion: string;
  attention_status: string;
  nivel_prioridad: string;
  puntaje_confiabilidad: number;
  is_simulated_gps?: boolean;
  descripcion_ciudadana?: string;
}

export interface CraMapProps {
  reports: MapReportItem[];
  layersVisible: {
    priorities: boolean;
    manglarProbable: boolean;
    porRevisar: boolean;
    doselSeco: boolean;
    groundTruth: boolean;
    reports: boolean;
  };
  onPickPoint?: (lat: number, lon: number) => void;
  pickedPoint?: { lat: number; lon: number } | null;
  flyToTarget?: { lat: number; lon: number; zoom?: number } | null;
  heightClass?: string;
  defaultSatellite?: boolean;
  darkFrame?: boolean;
}

export default function CraMap({
  reports,
  layersVisible,
  onPickPoint,
  pickedPoint,
  flyToTarget,
  heightClass = "h-[460px] md:h-[540px]",
  defaultSatellite = true,
  darkFrame = false,
}: CraMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Record<string, L.LayerGroup>>({});
  const pickMarkerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<{ sat: L.TileLayer; street: L.TileLayer } | null>(null);
  const [isSatellite, setIsSatellite] = useState(defaultSatellite);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [10.91, -75.04],
      zoom: 10,
      zoomControl: true,
    });

    const sat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Esri World Imagery · CRA Atlántico",
        maxZoom: 18,
      }
    );

    const street = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap &copy; CARTO · CRA Atlántico",
        maxZoom: 18,
      }
    );

    if (defaultSatellite) sat.addTo(map);
    else street.addTo(map);

    tileRef.current = { sat, street };

    const groups: Record<string, L.LayerGroup> = {
      priorities: L.layerGroup(),
      manglarProbable: L.layerGroup(),
      porRevisar: L.layerGroup(),
      doselSeco: L.layerGroup(),
      groundTruth: L.layerGroup(),
      reports: L.layerGroup().addTo(map),
    };
    groupsRef.current = groups;
    pickMarkerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onPickPoint) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onPickPoint(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
    }

    Promise.all([
      fetch("/data/geo/coastal_priorities_light.geojson").then((r) => r.json()).catch(() => null),
      fetch("/data/geo/cra_mangrove_layers.geojson").then((r) => r.json()).catch(() => null),
      fetch("/data/geo/cra_ground_truth_pts.geojson").then((r) => r.json()).catch(() => null),
    ]).then(([prioGeo, mangroveGeo, gtGeo]) => {
      if (!mapRef.current) return;

      if (prioGeo?.features) {
        L.geoJSON(prioGeo, {
          style: (f) => {
            const acc = String(f?.properties?.accion_gen || "Preservación");
            return {
              color: PLAN_COLORS[acc] || "#1f78b4",
              weight: 1.2,
              fillOpacity: 0.22,
            };
          },
          onEachFeature: (f, layer) => {
            const p = f.properties || {};
            layer.bindPopup(
              `<strong>${p.accion_gen || "Prioridad"} (${p.val_priori || ""})</strong><br/>Microcuenca: ${p.nomuh || "—"}<br/>Área: ${p.area_ha || 0} ha`
            );
          },
        }).addTo(groups.priorities);
      }

      if (mangroveGeo?.features) {
        for (const f of mangroveGeo.features) {
          const kind = f.properties?.layer;
          if (kind === "manglar_probable" || kind === "manglar_alta_probabilidad") {
            L.geoJSON(f, {
              style: { color: "#4ADE80", weight: 1.5, fillColor: "#16794A", fillOpacity: 0.42 },
            })
              .bindPopup(`<strong>Manglar probable</strong><br/>${f.properties?.sector_nombre || ""}`)
              .addTo(groups.manglarProbable);
          } else if (kind === "por_revisar_828ha") {
            L.geoJSON(f, {
              style: { color: "#F8D86F", weight: 1.5, fillColor: "#EDB512", fillOpacity: 0.48 },
            })
              .bindPopup(`<strong>Zona por revisar (828 ha)</strong><br/>${f.properties?.sector_nombre || ""}`)
              .addTo(groups.porRevisar);
          } else if (kind === "dosel_seco_2026") {
            L.geoJSON(f, {
              style: { color: "#FB7185", weight: 1.5, fillColor: "#C84023", fillOpacity: 0.48 },
            })
              .bindPopup(`<strong>Dosel más seco 2026</strong><br/>${f.properties?.sector_nombre || ""}`)
              .addTo(groups.doselSeco);
          }
        }
      }

      if (gtGeo?.features) {
        for (const f of gtGeo.features) {
          const [lon, lat] = f.geometry.coordinates;
          const esManglar = Boolean(f.properties?.es_manglar_consenso);
          L.circleMarker([lat, lon], {
            radius: 3.5,
            color: "#FFFFFF",
            fillColor: esManglar ? "#22C55E" : "#94A3B8",
            fillOpacity: 0.95,
            weight: 1,
          })
            .bindPopup(
              `<strong>Ground-Truth CRA #${f.properties?.point_id}</strong><br/>Consenso: ${esManglar ? "Manglar" : "No manglar"} (${f.properties?.clase_interpretada})`
            )
            .addTo(groups.groundTruth);
        }
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onPickPoint, defaultSatellite]);

  useEffect(() => {
    const map = mapRef.current;
    const tiles = tileRef.current;
    if (!map || !tiles) return;
    if (isSatellite) {
      if (map.hasLayer(tiles.street)) map.removeLayer(tiles.street);
      if (!map.hasLayer(tiles.sat)) tiles.sat.addTo(map);
    } else {
      if (map.hasLayer(tiles.sat)) map.removeLayer(tiles.sat);
      if (!map.hasLayer(tiles.street)) tiles.street.addTo(map);
    }
  }, [isSatellite]);

  useEffect(() => {
    const map = mapRef.current;
    const groups = groupsRef.current;
    if (!map) return;

    (Object.keys(layersVisible) as Array<keyof typeof layersVisible>).forEach((k) => {
      const grp = groups[k];
      if (!grp) return;
      if (layersVisible[k]) {
        if (!map.hasLayer(grp)) grp.addTo(map);
      } else if (map.hasLayer(grp)) {
        map.removeLayer(grp);
      }
    });
  }, [layersVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;
    map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom ?? 13, {
      duration: 1.0,
    });
  }, [flyToTarget]);

  useEffect(() => {
    const grp = groupsRef.current.reports;
    if (!grp) return;
    grp.clearLayers();

    for (const r of reports) {
      const color =
        r.estado_validacion === "alerta_oficial_cra"
          ? "#C84023"
          : r.estado_validacion === "validado_academico" || r.estado_validacion === "validado_comunitario"
          ? "#22C55E"
          : "#EDB512";

      L.circleMarker([r.latitud, r.longitud], {
        radius: 14,
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.28,
      }).addTo(grp);

      L.circleMarker([r.latitud, r.longitud], {
        radius: 7.5,
        color: "#FFFFFF",
        weight: 2.5,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(
          `<div style="min-width:200px">
            <strong>${r.tracking_code}</strong> ${r.is_simulated_gps ? "(SIMULADO DEMO)" : ""}<br/>
            <span>${r.zona_manglar}</span><br/>
            <span>Evento: <b>${r.tipo_evento}</b></span><br/>
            <span>Semáforo: <b>${r.puntaje_confiabilidad}/100</b></span><br/>
            <span>Estado: ${r.estado_validacion} · ${r.attention_status}</span>
          </div>`
        )
        .addTo(grp);
    }
  }, [reports]);

  useEffect(() => {
    const grp = pickMarkerRef.current;
    if (!grp) return;
    grp.clearLayers();
    if (pickedPoint) {
      L.circleMarker([pickedPoint.lat, pickedPoint.lon], {
        radius: 18,
        color: "#F8D86F",
        weight: 1.5,
        fillColor: "#EDB512",
        fillOpacity: 0.28,
      }).addTo(grp);
      L.circleMarker([pickedPoint.lat, pickedPoint.lon], {
        radius: 9,
        color: "#FFFFFF",
        weight: 3,
        fillColor: "#005F96",
        fillOpacity: 1,
      }).addTo(grp);
    }
  }, [pickedPoint]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${
        darkFrame ? "border-white/15 bg-[#041A29]" : "border-[#041A29]/15 bg-[#041A29]"
      } ${heightClass}`}
    >
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute right-3 top-3 z-[400] flex overflow-hidden rounded-lg border border-white/20 bg-[#041A29]/90 p-1 text-xs font-bold text-white backdrop-blur-md">
        <button
          type="button"
          onClick={() => setIsSatellite(true)}
          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 transition ${
            isSatellite ? "bg-[#EDB512] text-[#041A29]" : "text-white/80 hover:text-white"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          Satélite
        </button>
        <button
          type="button"
          onClick={() => setIsSatellite(false)}
          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 transition ${
            !isSatellite ? "bg-white text-[#041A29]" : "text-white/80 hover:text-white"
          }`}
        >
          <MapIcon className="h-3.5 w-3.5" />
          Mapa
        </button>
      </div>
    </div>
  );
}
