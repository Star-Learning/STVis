"""
Step 1: Download World Bank GDP indicator data for all countries.
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import yaml


def load_config(config_path: Path) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def fetch_all_pages(session: requests.Session, base_url: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    first_response = session.get(base_url, params={**params, "page": 1}, timeout=60)
    first_response.raise_for_status()
    meta, rows = first_response.json()
    pages = int(meta.get("pages", 1))
    combined = list(rows or [])

    for page in range(2, pages + 1):
        response = session.get(base_url, params={**params, "page": page}, timeout=60)
        response.raise_for_status()
        _, page_rows = response.json()
        combined.extend(page_rows or [])

    return combined, meta


def normalize_record(record: dict[str, Any]) -> dict[str, Any] | None:
    value = record.get("value")
    year = record.get("date")
    iso3 = (record.get("countryiso3code") or "").strip().upper()
    country_info = record.get("country") or {}
    country = (country_info.get("value") or "").strip()

    if value is None or not iso3 or not year or not country:
        return None

    return {
        "iso3": iso3,
        "country": country,
        "year": int(year),
        "gdp_current_usd": float(value),
    }


def build_paths(config: dict[str, Any], config_path: Path) -> dict[str, Path]:
    root = config_path.parent.parent
    data_cfg = config.get("data", {})
    raw_dir = root / data_cfg.get("raw_dir", "data_raw")
    processed_dir = root / data_cfg.get("processed_dir", "data_processed")
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    return {
        "root": root,
        "raw_gdp": raw_dir / data_cfg.get("raw_gdp_file", "world_bank_gdp_raw.json"),
        "raw_countries": raw_dir / data_cfg.get("raw_country_file", "world_bank_countries_raw.json"),
        "manifest": raw_dir / data_cfg.get("raw_download_manifest", "manifest.json"),
        "country_year_csv": processed_dir / data_cfg.get("country_year_file", "gdp_country_year.csv"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Download World Bank GDP indicator data")
    parser.add_argument("--config", default="configs/default.yaml")
    parser.add_argument("--start-year", type=int, default=None)
    parser.add_argument("--end-year", type=int, default=None)
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    data_cfg = config.get("data", {})
    start_year = args.start_year if args.start_year is not None else int(data_cfg.get("start_year", 1960))
    end_year = args.end_year if args.end_year is not None else data_cfg.get("end_year")
    end_year = int(end_year) if end_year not in (None, "") else None
    indicator_code = data_cfg.get("indicator_code", "NY.GDP.MKTP.CD")
    api_base = data_cfg.get("world_bank_api_base", "https://api.worldbank.org/v2").rstrip("/")
    per_page = int(data_cfg.get("world_bank_per_page", 20000))
    paths = build_paths(config, config_path)

    indicator_url = f"{api_base}/country/all/indicator/{indicator_code}"
    country_url = f"{api_base}/country"

    session = requests.Session()
    session.headers.update({"User-Agent": "episode-001-world-gdp-shift/1.0"})

    indicator_rows, indicator_meta = fetch_all_pages(
        session,
        indicator_url,
        {"format": "json", "per_page": per_page},
    )
    country_rows, country_meta = fetch_all_pages(
        session,
        country_url,
        {"format": "json", "per_page": 400},
    )

    filtered_rows = []
    for record in indicator_rows:
        normalized = normalize_record(record)
        if normalized is None:
            continue
        if normalized["year"] < start_year:
            continue
        if end_year is not None and normalized["year"] > end_year:
            continue
        filtered_rows.append(normalized)

    raw_payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": indicator_url,
        "indicator_code": indicator_code,
        "query": {"start_year": start_year, "end_year": end_year, "per_page": per_page},
        "meta": indicator_meta,
        "records": indicator_rows,
    }
    with paths["raw_gdp"].open("w", encoding="utf-8") as handle:
        json.dump(raw_payload, handle, ensure_ascii=False, indent=2)

    with paths["raw_countries"].open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source": country_url,
                "meta": country_meta,
                "records": country_rows,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )

    with paths["country_year_csv"].open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["iso3", "country", "year", "gdp_current_usd"])
        writer.writeheader()
        writer.writerows(sorted(filtered_rows, key=lambda row: (row["year"], row["iso3"])))

    manifest = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "workflow": "world-gdp-shift",
        "downloads": {
            "world_bank_gdp": str(paths["raw_gdp"].relative_to(paths["root"])),
            "world_bank_countries": str(paths["raw_countries"].relative_to(paths["root"])),
            "country_year_csv": str(paths["country_year_csv"].relative_to(paths["root"])),
        },
        "stats": {
            "indicator_records": len(indicator_rows),
            "country_records": len(country_rows),
            "country_year_rows": len(filtered_rows),
            "start_year": start_year,
            "end_year": end_year,
        },
    }
    with paths["manifest"].open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)

    print(f"Downloaded {len(indicator_rows)} indicator rows and wrote {len(filtered_rows)} filtered country-year rows.")


if __name__ == "__main__":
    main()
