#!/usr/bin/env python3
"""Convierte Prioridades de Conservación (.kmz) y capas CRA (core.json / hl.json)
a GeoJSON WGS84 (EPSG:4326) para la PWA offline y Supabase PostGIS.

Uso:
  python3 convert_cra_geodata.py \
    --kmz "Prioridades de Conservación (1).kmz" \
    --out-dir data/geo
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

CRA_BASE_URL = "https://manglarcra.netlify.app/data"
COASTAL_SUBZONES = {"Arroyos Directos al Caribe", "Cienaga Mallorquin"}

TD_RE = re.compile(
    r"<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>",
    re.S | re.I,
)
TAG_STRIP_RE = re.compile(r"<[^>]+>")
SVG_TOKEN_RE = re.compile(r"([MLZmlz])|(-?\d+(?:\.\d+)?)")


def utm18n_to_wgs84(easting: float, northing: float) -> list[float]:
    """Convierte coordenadas WGS84 / UTM Zona 18N a [lon, lat] en EPSG:4326."""
    a = 6378137.0
    e = 0.0818191908426215
    e1sq = 0.006739496742276434
    k0 = 0.9996
    x = easting - 500000.0
    y = northing
    m = y / k0
    mu = m / (a * (1 - e**2 / 4 - 3 * e**4 / 64 - 5 * e**6 / 256))
    e1 = (1 - math.sqrt(1 - e**2)) / (1 + math.sqrt(1 - e**2))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )
    c1 = e1sq * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = a / math.sqrt(1 - e**2 * math.sin(phi1) ** 2)
    r1 = a * (1 - e**2) / (1 - e**2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * e1sq) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * e1sq - 3 * c1**2)
        * d**6
        / 720
    )
    lon0 = math.radians(-75.0)
    lon = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * e1sq + 24 * t1**2) * d**5 / 120
    ) / math.cos(phi1)
    return [round(math.degrees(lon), 6), round(math.degrees(lat), 6)]


def local_xy_to_wgs84(x: float, y: float, orig: list[float]) -> list[float]:
    return utm18n_to_wgs84(orig[0] + x, orig[1] - y)


def _perp_dist(pt: list[float], start: list[float], end: list[float]) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0.0 and dy == 0.0:
        return math.hypot(pt[0] - start[0], pt[1] - start[1])
    t = ((pt[0] - start[0]) * dx + (pt[1] - start[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = start[0] + t * dx
    proj_y = start[1] + t * dy
    return math.hypot(pt[0] - proj_x, pt[1] - proj_y)


def simplify_ring(ring: list[list[float]], tol: float) -> list[list[float]]:
    """Simplifica un anillo cerrado preservando al menos 4 vértices."""
    if tol <= 0 or len(ring) <= 6:
        return ring
    open_pts = ring[:-1] if ring[0] == ring[-1] else ring

    def _dp(pts: list[list[float]]) -> list[list[float]]:
        if len(pts) <= 2:
            return pts
        max_d = -1.0
        idx = 0
        for i in range(1, len(pts) - 1):
            d = _perp_dist(pts[i], pts[0], pts[-1])
            if d > max_d:
                max_d = d
                idx = i
        if max_d > tol:
            left = _dp(pts[: idx + 1])
            right = _dp(pts[idx:])
            return left[:-1] + right
        return [pts[0], pts[-1]]

    # Split ring at antipodal vertex to keep closed loop balanced
    mid = len(open_pts) // 2
    first = _dp(open_pts[: mid + 1])
    second = _dp(open_pts[mid:] + [open_pts[0]])
    simplified = first[:-1] + second
    if len(simplified) < 4:
        return ring
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified


def parse_es_float(val: str) -> float:
    if not val:
        return 0.0
    try:
        return round(float(val.replace(".", "").replace(",", ".")), 6) if "," in val and "." in val else round(float(val.replace(",", ".")), 6)
    except ValueError:
        return 0.0


def parse_kml_coords(text: str, tol: float = 0.0) -> list[list[float]]:
    pts: list[list[float]] = []
    for token in text.strip().split():
        parts = token.split(",")
        if len(parts) >= 2:
            pts.append([round(float(parts[0]), 6), round(float(parts[1]), 6)])
    if len(pts) >= 3 and pts[0] != pts[-1]:
        pts.append(pts[0])
    return simplify_ring(pts, tol) if len(pts) >= 4 else pts


def extract_kmz_geojson(
    kmz_path: Path,
    out_dir: Path,
    tol: float,
    export_all: bool,
) -> dict[str, Any]:
    with zipfile.ZipFile(kmz_path, "r") as zf:
        kml_name = next((n for n in zf.namelist() if n.endswith(".kml")), None)
        if not kml_name:
            raise FileNotFoundError(f"No se encontró .kml dentro de {kmz_path}")
        raw_kml = zf.read(kml_name)

    root = ET.fromstring(raw_kml)
    tag_ns = root.tag.split("}")[0].strip("{") if "}" in root.tag else ""
    ns = {"k": tag_ns} if tag_ns else {}

    def findall(el: ET.Element, tag: str) -> list[ET.Element]:
        return el.findall(f".//k:{tag}", ns) if tag_ns else el.findall(f".//{tag}")

    def findtext(el: ET.Element, tag: str) -> str:
        node = el.find(f"k:{tag}", ns) if tag_ns else el.find(tag)
        return node.text.strip() if (node is not None and node.text) else ""

    coastal_features: list[dict[str, Any]] = []
    all_features: list[dict[str, Any]] = []
    by_szh: Counter[str] = Counter()
    by_prio: Counter[str] = Counter()
    by_accion: Counter[str] = Counter()
    bbox = [999.0, 999.0, -999.0, -999.0]

    for pm in findall(root, "Placemark"):
        desc = findtext(pm, "description")
        raw_attrs: dict[str, str] = {}
        for k_raw, v_raw in TD_RE.findall(desc):
            k_clean = TAG_STRIP_RE.sub("", k_raw).strip()
            v_clean = TAG_STRIP_RE.sub("", v_raw).strip()
            if k_clean:
                norm_key = k_clean.splitlines()[-1].strip()
                raw_attrs[norm_key] = v_clean

        szh = raw_attrs.get("NOMSZH", "")
        prio = raw_attrs.get("Val_Priori", "")
        acc = raw_attrs.get("AccionGen", "")
        by_szh[szh] += 1
        by_prio[prio] += 1
        by_accion[acc] += 1

        is_coastal = szh in COASTAL_SUBZONES
        if not export_all and not is_coastal:
            continue

        polygons: list[list[list[list[float]]]] = []
        for poly_el in findall(pm, "Polygon"):
            rings: list[list[list[float]]] = []
            outer = poly_el.find(".//k:outerBoundaryIs//k:coordinates", ns) if tag_ns else poly_el.find(".//outerBoundaryIs//coordinates")
            if outer is not None and outer.text:
                r = parse_kml_coords(outer.text, tol)
                if len(r) >= 4:
                    rings.append(r)
                    for lon, lat in r:
                        bbox[0] = min(bbox[0], lon)
                        bbox[1] = min(bbox[1], lat)
                        bbox[2] = max(bbox[2], lon)
                        bbox[3] = max(bbox[3], lat)
            for inner in (poly_el.findall(".//k:innerBoundaryIs//k:coordinates", ns) if tag_ns else poly_el.findall(".//innerBoundaryIs//coordinates")):
                if inner.text:
                    ir = parse_kml_coords(inner.text, tol)
                    if len(ir) >= 4:
                        rings.append(ir)
            if rings:
                polygons.append(rings)

        if not polygons:
            continue

        geometry: dict[str, Any]
        if len(polygons) == 1:
            geometry = {"type": "Polygon", "coordinates": polygons[0]}
        else:
            geometry = {"type": "MultiPolygon", "coordinates": polygons}

        props = {
            "fid": raw_attrs.get("FID", ""),
            "nomzh": raw_attrs.get("NOMZH", ""),
            "nomszh": szh,
            "nomuh": raw_attrs.get("NOMUH", ""),
            "val_priori": prio,
            "accion_gen": acc,
            "accion_desc": raw_attrs.get("AccRegDesc", ""),
            "escenarios": raw_attrs.get("Escenarios", ""),
            "desc_i": raw_attrs.get("DESC_I", ""),
            "zona": raw_attrs.get("Zona", ""),
            "cat_runap": raw_attrs.get("Cat_Runap", ""),
            "nom_apc": raw_attrs.get("NOM_APC", ""),
            "area_ha": parse_es_float(raw_attrs.get("AREA_HA", "0")),
        }
        feat = {"type": "Feature", "properties": props, "geometry": geometry}
        if is_coastal:
            coastal_features.append(feat)
        if export_all:
            all_features.append(feat)

    coastal_path = out_dir / "coastal_priorities.geojson"
    coastal_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": coastal_features}, ensure_ascii=False),
        encoding="utf-8",
    )

    if export_all:
        all_path = out_dir / "all_priorities.geojson"
        all_path.write_text(
            json.dumps({"type": "FeatureCollection", "features": all_features}, ensure_ascii=False),
            encoding="utf-8",
        )

    summary = {
        "total_placemarks": sum(by_szh.values()),
        "coastal_features_exported": len(coastal_features),
        "tolerance_deg": tol,
        "coastal_bbox_wgs84": bbox,
        "by_nomszh": dict(by_szh),
        "by_val_priori": dict(by_prio),
        "by_accion_gen": dict(by_accion),
    }
    (out_dir / "kmz_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return summary


def svg_path_to_polygons(
    path_str: str,
    orig: list[float],
    tol: float = 0.0,
) -> list[list[list[list[float]]]]:
    """Convierte un path SVG (M x,y L x,y ... Z) en lista de polígonos WGS84."""
    tokens = SVG_TOKEN_RE.findall(path_str)
    rings: list[list[list[float]]] = []
    cur: list[list[float]] = []
    nums: list[float] = []
    cmd = ""

    def flush_nums() -> None:
        while len(nums) >= 2:
            x = nums.pop(0)
            y = nums.pop(0)
            cur.append(local_xy_to_wgs84(x, y, orig))

    for op, num in tokens:
        if op:
            flush_nums()
            if op in ("M", "m") and cur:
                if cur[0] != cur[-1]:
                    cur.append(cur[0])
                if len(cur) >= 4:
                    rings.append(simplify_ring(cur, tol))
                cur = []
            elif op in ("Z", "z") and cur:
                if cur[0] != cur[-1]:
                    cur.append(cur[0])
                if len(cur) >= 4:
                    rings.append(simplify_ring(cur, tol))
                cur = []
            cmd = op
        elif num:
            nums.append(float(num))
            if len(nums) == 2 and cmd in ("M", "L", "m", "l"):
                flush_nums()

    flush_nums()
    if cur:
        if cur[0] != cur[-1]:
            cur.append(cur[0])
        if len(cur) >= 4:
            rings.append(simplify_ring(cur, tol))

    return [[r] for r in rings]


def fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "CRA-Manglar-Geopipeline/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def export_cra_remote_layers(out_dir: Path, tol: float) -> dict[str, Any]:
    core = fetch_json(f"{CRA_BASE_URL}/core.json")
    hl = fetch_json(f"{CRA_BASE_URL}/hl.json")
    orig = core["orig"]

    resumen_by_z = {str(r["zona"]): r for r in core.get("resumen", [])}
    seco_by_z = {str(r["zona"]): r for r in core.get("seco", {}).get("sect", [])}
    riesgo_by_z = {str(r["zona"]): r for r in core.get("riesgo", {}).get("sect", [])}
    carb_by_z = {str(r["k"]): r for r in core.get("carb", {}).get("sect", [])}

    # 1. Sectores bounding boxes (4 zonas oficiales)
    sector_features = []
    for k, z in core["zonas"].items():
        x0, y0, w, h = z["x"], z["y"], z["w"], z["h"]
        ring = [
            local_xy_to_wgs84(x0, y0, orig),
            local_xy_to_wgs84(x0 + w, y0, orig),
            local_xy_to_wgs84(x0 + w, y0 + h, orig),
            local_xy_to_wgs84(x0, y0 + h, orig),
            local_xy_to_wgs84(x0, y0, orig),
        ]
        center = local_xy_to_wgs84(x0 + w / 2, y0 + h / 2, orig)
        props = {
            "sector_id": int(k),
            "nombre": z["nombre"],
            "centroid_lon": center[0],
            "centroid_lat": center[1],
            "resumen": resumen_by_z.get(k, {}),
            "seco": seco_by_z.get(k, {}),
            "riesgo": riesgo_by_z.get(k, {}),
            "carbono": carb_by_z.get(k, {}),
        }
        sector_features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )

    (out_dir / "cra_sectors.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": sector_features}, ensure_ascii=False),
        encoding="utf-8",
    )

    # 2. Capas de manglar (ref, seg, ind=828ha por revisar, seco, riesgo, cienagas)
    layer_features = []
    for layer_key, label in [
        ("ref", "manglar_probable"),
        ("seg", "manglar_alta_probabilidad"),
        ("ind", "por_revisar_828ha"),
        ("seco", "dosel_seco_2026"),
        ("riesgo", "riesgo_alto"),
    ]:
        by_z = hl.get(layer_key, {})
        if isinstance(by_z, dict):
            for zk, path_str in by_z.items():
                polys = svg_path_to_polygons(path_str, orig, tol)
                if polys:
                    layer_features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "layer": label,
                                "sector_id": int(zk),
                                "sector_nombre": core["zonas"].get(zk, {}).get("nombre", ""),
                                "polygon_count": len(polys),
                            },
                            "geometry": {"type": "MultiPolygon", "coordinates": polys},
                        }
                    )

    for cienaga_name, path_str in hl.get("cienaga", {}).items():
        polys = svg_path_to_polygons(path_str, orig, tol)
        if polys:
            layer_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "layer": "cienaga",
                        "nombre": cienaga_name,
                        "polygon_count": len(polys),
                    },
                    "geometry": {"type": "MultiPolygon", "coordinates": polys},
                }
            )

    (out_dir / "cra_mangrove_layers.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": layer_features}, ensure_ascii=False),
        encoding="utf-8",
    )

    # 3. 524 puntos ground-truth CRA
    pt_features = []
    for idx, pt in enumerate(hl.get("pts", [])):
        x, y, clase, is_manglar = pt[0], pt[1], pt[2], pt[3]
        lon, lat = local_xy_to_wgs84(x, y, orig)
        pt_features.append(
            {
                "type": "Feature",
                "properties": {
                    "point_id": idx + 1,
                    "clase_interpretada": clase,
                    "es_manglar_consenso": bool(is_manglar),
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            }
        )

    (out_dir / "cra_ground_truth_pts.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": pt_features}, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "sectors_count": len(sector_features),
        "mangrove_layer_features": len(layer_features),
        "ground_truth_points": len(pt_features),
    }


def validate_atlantico_bbox(bbox: list[float]) -> None:
    min_lon, min_lat, max_lon, max_lat = bbox
    if not (-75.6 <= min_lon <= -74.5 and 10.0 <= min_lat <= 11.3):
        raise ValueError(f"Bounding box fuera del Atlántico: {bbox}")
    if not (-75.6 <= max_lon <= -74.5 and 10.0 <= max_lat <= 11.3):
        raise ValueError(f"Bounding box fuera del Atlántico: {bbox}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convierte KMZ y capas CRA a GeoJSON WGS84.")
    parser.add_argument("--kmz", default="Prioridades de Conservación (1).kmz", help="Ruta al archivo .kmz")
    parser.add_argument("--out-dir", default="data/geo", help="Directorio de salida")
    parser.add_argument("--tolerance", type=float, default=0.00015, help="Tolerancia Douglas-Peucker en grados")
    parser.add_argument("--all-kmz", action="store_true", help="Exporta además los 14,732 polígonos completos")
    parser.add_argument("--skip-remote", action="store_true", help="Omite descarga de core.json/hl.json")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    kmz_path = Path(args.kmz)
    if not kmz_path.exists():
        raise FileNotFoundError(f"No existe el KMZ: {kmz_path}")

    kmz_summary = extract_kmz_geojson(kmz_path, out_dir, args.tolerance, args.all_kmz)
    validate_atlantico_bbox(kmz_summary["coastal_bbox_wgs84"])
    result: dict[str, Any] = {"kmz": kmz_summary}

    if not args.skip_remote:
        result["cra_remote"] = export_cra_remote_layers(out_dir, args.tolerance)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
