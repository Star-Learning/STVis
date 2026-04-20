"""
Step 4: Generate frontend render assets from joined GDP geometry.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


def load_config(config_path: Path) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def build_paths(config: dict[str, Any], config_path: Path) -> dict[str, Path]:
    root = config_path.parent.parent
    data_cfg = config.get("data", {})
    output_cfg = config.get("output", {})
    processed_dir = root / data_cfg.get("processed_dir", "data_processed")
    outputs_dir = root / data_cfg.get("outputs_dir", "outputs")
    viz_public_data = root / "viz" / "public" / "data"
    viz_public_config = root / "viz" / "public" / "config"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    viz_public_data.mkdir(parents=True, exist_ok=True)
    viz_public_config.mkdir(parents=True, exist_ok=True)
    return {
        "root": root,
        "joined_geojson": processed_dir / data_cfg.get("joined_geojson_file", "world_gdp_joined.geojson"),
        "timeseries": outputs_dir / output_cfg.get("gdp_timeseries_file", "gdp_timeseries.json"),
        "render_config": outputs_dir / output_cfg.get("render_config_file", "render_config.json"),
        "viz_geojson": viz_public_data / "world_gdp_joined.geojson",
        "viz_timeseries": viz_public_data / "gdp_timeseries.json",
        "viz_render_config": viz_public_config / "render_config.json",
    }


def weighted_center(countries: list[dict[str, Any]]) -> dict[str, float]:
    lon_x_total = 0.0
    lon_y_total = 0.0
    lat_total = 0.0
    weight_total = 0.0

    for item in countries:
        weight = item["gdp_share"]
        lon = math.radians(item["centroid_lon"])
        lat = item["centroid_lat"]
        lon_x_total += math.cos(lon) * weight
        lon_y_total += math.sin(lon) * weight
        lat_total += lat * weight
        weight_total += weight

    if weight_total == 0:
        return {"lon": 0.0, "lat": 0.0}

    lon = math.degrees(math.atan2(lon_y_total, lon_x_total))
    lat = lat_total / weight_total
    return {"lon": lon, "lat": lat}


def build_continent_summary(countries: list[dict[str, Any]]) -> dict[str, Any]:
    continent_totals: dict[str, float] = {}
    for item in countries:
        continent = item.get("continent") or "Other"
        continent_totals[continent] = continent_totals.get(continent, 0.0) + item["gdp_share"]

    ordered = sorted(continent_totals.items(), key=lambda item: item[1], reverse=True)
    dominant_continent = ordered[0][0] if ordered else "Unknown"
    return {
        "dominant_continent": dominant_continent,
        "continent_shares": [
            {"continent": continent, "gdp_share": share}
            for continent, share in ordered
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate render assets for the GDP frontend")
    parser.add_argument("--config", default="configs/default.yaml")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    paths = build_paths(config, config_path)
    processing_cfg = config.get("processing", {})
    animation_cfg = config.get("animation", {})
    output_cfg = config.get("output", {})
    project_cfg = config.get("project", {})
    viz_cfg = config.get("visualization", {})

    joined = json.loads(paths["joined_geojson"].read_text(encoding="utf-8"))
    features = joined.get("features", [])

    years = sorted(
        {
            int(year)
            for feature in features
            for year in (feature.get("properties", {}).get("metrics") or {}).keys()
        }
    )

    yearly = []
    country_summaries = []
    all_shares = []
    all_logs = []
    all_changes = []

    for feature in features:
        props = feature.get("properties", {})
        metrics = props.get("metrics") or {}
        available = []
        peak_share = {"year": None, "value": -1.0}
        latest_year = None
        latest_metric = None
        for year_str, values in metrics.items():
            year = int(year_str)
            available.append(year)
            if values["gdp_share"] > peak_share["value"]:
                peak_share = {"year": year, "value": values["gdp_share"]}
            if latest_year is None or year > latest_year:
                latest_year = year
                latest_metric = values
        if available:
            country_summaries.append(
                {
                    "iso3": props["iso3"],
                    "country": props["country"],
                    "latest_year": latest_year,
                    "latest_rank": latest_metric["gdp_rank"] if latest_metric else None,
                    "peak_share_year": peak_share["year"],
                    "peak_share": peak_share["value"],
                }
            )

    for year in years:
        year_countries = []
        global_total = 0.0
        for feature in features:
            props = feature.get("properties", {})
            metrics = props.get("metrics") or {}
            year_metric = metrics.get(str(year))
            if not year_metric:
                continue
            entry = {
                "iso3": props["iso3"],
                "country": props["country"],
                "continent": props.get("continent") or "Other",
                "centroid_lon": props["centroid_lon"],
                "centroid_lat": props["centroid_lat"],
                **year_metric,
            }
            year_countries.append(entry)
            global_total = year_metric["global_gdp_total"]
            all_shares.append(year_metric["gdp_share"])
            all_logs.append(year_metric["gdp_log"])
            all_changes.append(year_metric["gdp_share_change"])

        year_countries.sort(key=lambda item: item["gdp_rank"])
        top_n = int(processing_cfg.get("top_n_countries", 10))
        yearly.append(
            {
                "year": year,
                "global_gdp_total": global_total,
                "center": weighted_center(year_countries),
                **build_continent_summary(year_countries),
                "top_countries": year_countries[:top_n],
                "country_count": len(year_countries),
            }
        )

    timeseries = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "indicator": {
            "code": config.get("data", {}).get("indicator_code", "NY.GDP.MKTP.CD"),
            "name": config.get("data", {}).get("indicator_name", "GDP (current US$)"),
        },
        "center_definition": "Weighted visual center using country centroids, circular-mean longitude, and GDP-share-weighted latitude.",
        "years": years,
        "yearly": yearly,
        "countries": sorted(country_summaries, key=lambda item: item["country"]),
        "domains": {
            "gdp_share": {"min": min(all_shares, default=0.0), "max": max(all_shares, default=0.0)},
            "gdp_log": {"min": min(all_logs, default=0.0), "max": max(all_logs, default=0.0)},
            "gdp_share_change": {"min": min(all_changes, default=0.0), "max": max(all_changes, default=0.0)},
        },
    }

    render_config = {
        "version": "2.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": {
            "slug": project_cfg.get("slug", "episode-001-world-gdp-shift"),
            "title": project_cfg.get("title", "Where Is the Center of the World Economy Moving?"),
            "subtitle": project_cfg.get("subtitle", "A Country-Level Dynamic Visualization of Global GDP Shift"),
        },
        "data": {
            "geometry_url": "/data/world_gdp_joined.geojson",
            "timeseries_url": "/data/gdp_timeseries.json",
            "main_metric": processing_cfg.get("main_metric", "gdp_share"),
            "comparison_metric": processing_cfg.get("comparison_metric", "gdp_log"),
            "modes": viz_cfg.get("available_modes", ["gdp_share", "gdp_log", "gdp_share_change"]),
            "years": years,
        },
        "animation": {
            "frame_duration_ms": int(animation_cfg.get("frame_duration_ms", 950)),
            "transition_duration_ms": int(animation_cfg.get("transition_duration_ms", 700)),
            "intro_duration_ms": int(animation_cfg.get("intro_duration_ms", 4000)),
            "autoplay": bool(animation_cfg.get("autoplay", False)),
        },
        "highlights": {
            "top_n": int(processing_cfg.get("top_n_countries", 10)),
            "years": processing_cfg.get("highlight_years", []),
        },
        "output": {
            "fps": int(output_cfg.get("fps", 30)),
            "codec": output_cfg.get("codec", "libx264"),
            "landscape": output_cfg.get("landscape", {"width": 1920, "height": 1080}),
            "vertical": output_cfg.get("vertical", {"width": 1080, "height": 1920}),
        },
        "labels": {
            "gdp_share": "Share of global GDP",
            "gdp_log": "Log-scaled GDP",
            "gdp_share_change": "Change in GDP share",
        },
    }

    paths["timeseries"].write_text(json.dumps(timeseries, ensure_ascii=False), encoding="utf-8")
    paths["render_config"].write_text(json.dumps(render_config, ensure_ascii=False, indent=2), encoding="utf-8")
    paths["viz_geojson"].write_text(paths["joined_geojson"].read_text(encoding="utf-8"), encoding="utf-8")
    paths["viz_timeseries"].write_text(json.dumps(timeseries, ensure_ascii=False), encoding="utf-8")
    paths["viz_render_config"].write_text(json.dumps(render_config, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote GDP render assets for {len(years)} years.")


if __name__ == "__main__":
    main()
