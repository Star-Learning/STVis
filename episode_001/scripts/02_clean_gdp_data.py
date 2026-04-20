"""
Step 2: Clean and derive GDP metrics.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml


def load_config(config_path: Path) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def build_paths(config: dict[str, Any], config_path: Path) -> dict[str, Path]:
    root = config_path.parent.parent
    data_cfg = config.get("data", {})
    raw_dir = root / data_cfg.get("raw_dir", "data_raw")
    processed_dir = root / data_cfg.get("processed_dir", "data_processed")
    processed_dir.mkdir(parents=True, exist_ok=True)
    return {
        "root": root,
        "raw_countries": raw_dir / data_cfg.get("raw_country_file", "world_bank_countries_raw.json"),
        "country_year_csv": processed_dir / data_cfg.get("country_year_file", "gdp_country_year.csv"),
        "clean_csv": processed_dir / data_cfg.get("clean_country_year_file", "gdp_country_year_clean.csv"),
    }


def load_valid_country_codes(country_file: Path) -> set[str]:
    with country_file.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    valid = set()
    for record in payload.get("records", []):
        iso3 = (record.get("id") or "").strip().upper()
        region = (record.get("region") or {}).get("value")
        lending_type = (record.get("lendingType") or {}).get("value")
        if not iso3 or len(iso3) != 3:
            continue
        if region == "Aggregates":
            continue
        if lending_type == "Aggregates":
            continue
        valid.add(iso3)
    return valid


def rank_rows(rows: list[dict[str, Any]]) -> None:
    ordered = sorted(rows, key=lambda row: (-row["gdp_current_usd"], row["iso3"]))
    for index, row in enumerate(ordered, start=1):
        row["gdp_rank"] = index


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean GDP data and derive episode metrics")
    parser.add_argument("--config", default="configs/default.yaml")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    paths = build_paths(config, config_path)
    processing_cfg = config.get("processing", {})
    excluded_codes = {code.upper() for code in processing_cfg.get("exclude_country_codes", [])}
    valid_country_codes = load_valid_country_codes(paths["raw_countries"])

    rows = []
    seen = set()
    with paths["country_year_csv"].open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            iso3 = (row.get("iso3") or "").upper()
            if iso3 not in valid_country_codes or iso3 in excluded_codes:
                continue
            key = (iso3, int(row["year"]))
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "iso3": iso3,
                    "country": row["country"].strip(),
                    "year": int(row["year"]),
                    "gdp_current_usd": float(row["gdp_current_usd"]),
                }
            )

    by_year = defaultdict(list)
    by_country = defaultdict(list)
    for row in rows:
        by_year[row["year"]].append(row)
        by_country[row["iso3"]].append(row)

    for year_rows in by_year.values():
        total = sum(item["gdp_current_usd"] for item in year_rows)
        rank_rows(year_rows)
        for item in year_rows:
            item["global_gdp_total"] = total
            item["gdp_share"] = item["gdp_current_usd"] / total if total else 0.0
            item["gdp_log"] = math.log10(item["gdp_current_usd"]) if item["gdp_current_usd"] > 0 else 0.0

    for country_rows in by_country.values():
        ordered = sorted(country_rows, key=lambda row: row["year"])
        previous_share = None
        for item in ordered:
            if previous_share is None:
                item["gdp_share_change"] = 0.0
            else:
                item["gdp_share_change"] = item["gdp_share"] - previous_share
            previous_share = item["gdp_share"]

    ordered_rows = sorted(rows, key=lambda row: (row["year"], row["gdp_rank"], row["iso3"]))

    with paths["clean_csv"].open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "iso3",
                "country",
                "year",
                "gdp_current_usd",
                "global_gdp_total",
                "gdp_share",
                "gdp_log",
                "gdp_rank",
                "gdp_share_change",
            ],
        )
        writer.writeheader()
        for row in ordered_rows:
            writer.writerow(row)

    print(f"Wrote cleaned GDP table with {len(ordered_rows)} rows to {paths['clean_csv']}.")


if __name__ == "__main__":
    main()
