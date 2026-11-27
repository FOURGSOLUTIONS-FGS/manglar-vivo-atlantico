"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
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
  heightClass?: string;
}

export default function CraMap({
  reports,
  layersVisible,
  onPickPoint,
  pickedPoint,
  heightClass = "h-[460px] md:h-[540px]",
}: CraMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Record<string, L.LayerGroup>>({});
  const pickMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [10.91, -75.04],
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap · CRA Atlántico",
      maxZoom: 18,
    }).addTo(map);

    const groups: Record<string, L.LayerGroup> = {
      priorities: L.layerGroup(),
      manglarProbable: L.layerGroup(),
      porRevisar: L.layerGroup(),
      doselSeco: L.layerGroup(),
      groundTruth: L.layerGroup(),
      reports: L.layerGroup().addTo(map),
    };
    groupsRef.current = groups;
    mapRef.current = map;

    if (onPickPoint) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onPickPoint(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
    }

    // Cargar capas oficiales CRA GeoJSON
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
              weight: 1,
              fillOpacity: 0.2,
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
              style: { color: "#1F7A4C", weight: 1.5, fillColor: "#33A02C", fillOpacity: 0.45 },
            })
              .bindPopup(`<strong>Manglar probable</strong><br/>${f.properties?.sector_nombre || ""}`)
              .addTo(groups.manglarProbable);
          } else if (kind === "por_revisar_828ha") {
            L.geoJSON(f, {
              style: { color: "#EDB512", weight: 1.5, fillColor: "#F8D86F", fillOpacity: 0.5 },
            })
              .bindPopup(`<strong>Zona por revisar (828 ha)</strong><br/>${f.properties?.sector_nombre || ""}`)
              .addTo(groups.porRevisar);
          } else if (kind === "dosel_seco_2026") {
            L.geoJSON(f, {
              style: { color: "#D94E2A", weight: 1.5, fillColor: "#D94E2A", fillOpacity: 0.45 },
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
            color: esManglar ? "#08334C" : "#64748b",
            fillColor: esManglar ? "#33a02c" : "#cbd5e1",
            fillOpacity: 0.9,
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
  }, [onPickPoint]);

  // Sincronizar visibilidad de capas
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

  // Sincronizar marcadores de reportes en vivo
  useEffect(() => {
    const grp = groupsRef.current.reports;
    if (!grp) return;
    grp.clearLayers();

    for (const r of reports) {
      const color =
        r.estado_validacion === "alerta_oficial_cra"
          ? "#D94E2A"
          : r.estado_validacion === "validado_academico" || r.estado_validacion === "validado_comunitario"
          ? "#1F7A4C"
          : "#EDB512";

      L.circleMarker([r.latitud, r.longitud], {
        radius: 8,
        color: "#08334C",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div style="min-width:190px">
            <strong>${r.tracking_code}</strong> ${r.is_simulated_gps ? "(SIMULADO DEMO)" : ""}<br/>
            <span>${r.zona_manglar}</span><br/>
            <span>Evento: <b>${r.tipo_evento}</b></span><br/>
            <span>Confiabilidad: <b>${r.puntaje_confiabilidad}/100</b></span><br/>
            <span>Estado: ${r.estado_validacion} · ${r.attention_status}</span>
          </div>`
        )
        .addTo(grp);
    }
  }, [reports]);

  // Marcador de punto seleccionado (para /participacion)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickMarkerRef.current) {
      map.removeLayer(pickMarkerRef.current);
      pickMarkerRef.current = null;
    }
    if (pickedPoint) {
      pickMarkerRef.current = L.circleMarker([pickedPoint.lat, pickedPoint.lon], {
        radius: 10,
        color: "#005F96",
        weight: 3,
        fillColor: "#F8D86F",
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [pickedPoint]);

  return (
    <div className="bezel-outer">
      <div className={`bezel-inner overflow-hidden ${heightClass}`}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
