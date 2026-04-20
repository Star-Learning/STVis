"""
Step 3: Download boundaries, join GDP metrics, and export GeoJSON/TopoJSON.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import requests
import yaml


def load_config(config_path: Path) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def build_paths(config: dict[str, Any], config_path: Path) -> dict[str, Path]:
    root = config_path.parent.parent
    data_cfg = config.get("data", {})
    raw_dir = root / data_cfg.get("raw_dir", "data_raw")
    processed_dir = root / data_cfg.get("processed_dir", "data_processed")
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    return {
        "root": root,
        "clean_csv": processed_dir / data_cfg.get("clean_country_year_file", "gdp_country_year_clean.csv"),
        "raw_boundary": raw_dir / data_cfg.get("raw_boundary_file", "world_boundaries_raw.geojson"),
        "joined_geojson": processed_dir / data_cfg.get("joined_geojson_file", "world_gdp_joined.geojson"),
        "joined_topojson": processed_dir / data_cfg.get("joined_topojson_file", "world_gdp_joined.topojson"),
    }


def extract_iso3(properties: dict[str, Any]) -> str:
    candidates = [
        properties.get("ADM0_A3"),
        properties.get("ISO_A3_EH"),
        properties.get("ISO_A3"),
        properties.get("SOV_A3"),
        properties.get("GU_A3"),
    ]
    for value in candidates:
        code = (value or "").strip().upper()
        if len(code) == 3 and code != "-99":
            return code
    return ""


def polygon_centroid(ring: list[list[float]]) -> tuple[float, float, float]:
    if len(ring) < 3:
        lon = sum(point[0] for point in ring) / max(len(ring), 1)
        lat = sum(point[1] for point in ring) / max(len(ring), 1)
        return lon, lat, 0.0

    signed_area = 0.0
    cx = 0.0
    cy = 0.0
    for index in range(len(ring) - 1):
        x0, y0 = ring[index]
        x1, y1 = ring[index + 1]
        cross = x0 * y1 - x1 * y0
        signed_area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross

    if signed_area == 0:
        lon = sum(point[0] for point in ring) / len(ring)
        lat = sum(point[1] for point in ring) / len(ring)
        return lon, lat, 0.0

    signed_area *= 0.5
    return cx / (6.0 * signed_area), cy / (6.0 * signed_area), abs(signed_area)


def geometry_centroid(geometry: dict[str, Any]) -> tuple[float, float]:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    centroids = []

    if geometry_type == "Polygon":
        if coordinates:
            centroids.append(polygon_centroid(coordinates[0]))
    elif geometry_type == "MultiPolygon":
        for polygon in coordinates:
            if polygon:
                centroids.append(polygon_centroid(polygon[0]))

    if not centroids:
        return 0.0, 0.0

    total_area = sum(item[2] for item in centroids)
    if total_area == 0:
        return centroids[0][0], centroids[0][1]

    lon = sum(item[0] * item[2] for item in centroids) / total_area
    lat = sum(item[1] * item[2] for item in centroids) / total_area
    return lon, lat


def geojson_to_topology(feature_collection: dict[str, Any]) -> dict[str, Any]:
    arcs: list[list[list[float]]] = []
    geometries = []

    def register_polygon(polygon: list[list[list[float]]]) -> list[list[int]]:
        polygon_arcs = []
        for ring in polygon:
            arcs.append(ring)
            polygon_arcs.append([len(arcs) - 1])
        return polygon_arcs

    for feature in feature_collection.get("features", []):
        geometry = feature.get("geometry") or {}
        geometry_type = geometry.get("type")
        entry = {
            "type": geometry_type,
            "properties": feature.get("properties", {}),
        }
        if geometry_type == "Polygon":
            entry["arcs"] = register_polygon(geometry.get("coordinates", []))
        elif geometry_type == "MultiPolygon":
            entry["arcs"] = [register_polygon(polygon) for polygon in geometry.get("coordinates", [])]
        else:
            continue
        geometries.append(entry)

    return {
        "type": "Topology",
        "bbox": feature_collection.get("bbox"),
        "objects": {
            "countries": {
                "type": "GeometryCollection",
                "geometries": geometries,
            }
        },
        "arcs": arcs,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Join cleaned GDP metrics with country boundaries")
    parser.add_argument("--config", default="configs/default.yaml")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    paths = build_paths(config, config_path)
    boundary_url = config.get("data", {}).get(
        "country_boundary_url",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
    )

    if not paths["raw_boundary"].exists():
        response = requests.get(boundary_url, timeout=60)
        response.raise_for_status()
        paths["raw_boundary"].write_text(response.text, encoding="utf-8")

    with paths["clean_csv"].open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        metrics_by_country: dict[str, dict[str, Any]] = {}
        for row in reader:
            iso3 = row["iso3"]
            metrics_by_country.setdefault(
                iso3,
                {
                    "country": row["country"],
                    "years": {},
                },
            )
            metrics_by_country[iso3]["years"][row["year"]] = {
                "gdp_current_usd": float(row["gdp_current_usd"]),
                "global_gdp_total": float(row["global_gdp_total"]),
                "gdp_share": float(row["gdp_share"]),
                "gdp_log": float(row["gdp_log"]),
                "gdp_rank": int(row["gdp_rank"]),
                "gdp_share_change": float(row["gdp_share_change"]),
            }

    boundary_payload = json.loads(paths["raw_boundary"].read_text(encoding="utf-8"))
    output_features = []
    missing_iso3 = []
    bbox = boundary_payload.get("bbox")

    for feature in boundary_payload.get("features", []):
        properties = feature.get("properties") or {}
        iso3 = extract_iso3(properties)
        if not iso3:
            continue
        centroid_lon, centroid_lat = geometry_centroid(feature.get("geometry") or {})
        joined = metrics_by_country.get(iso3, {"country": properties.get("NAME") or properties.get("ADMIN"), "years": {}})

        if not joined["years"]:
            missing_iso3.append(iso3)

        output_features.append(
            {
                "type": "Feature",
                "geometry": feature.get("geometry"),
                "properties": {
                    "iso3": iso3,
                    "country": joined["country"] or properties.get("NAME") or properties.get("ADMIN"),
                    "continent": properties.get("CONTINENT"),
                    "subregion": properties.get("SUBREGION"),
                    "centroid_lon": centroid_lon,
                    "centroid_lat": centroid_lat,
                    "metrics": joined["years"],
                },
            }
        )

    feature_collection = {
        "type": "FeatureCollection",
        "bbox": bbox,
        "features": output_features,
        "metadata": {
            "source_boundary_url": boundary_url,
            "missing_metric_iso3": sorted(missing_iso3),
        },
    }
    topology = geojson_to_topology(feature_collection)

    paths["joined_geojson"].write_text(json.dumps(feature_collection, ensure_ascii=False), encoding="utf-8")
    paths["joined_topojson"].write_text(json.dumps(topology, ensure_ascii=False), encoding="utf-8")

    print(
        f"Wrote joined country geometry with {len(output_features)} features. "
        f"Missing GDP metrics for {len(missing_iso3)} boundary features."
    )


if __name__ == "__main__":
    main()
