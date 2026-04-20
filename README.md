# Episode 001: Where Is the Center of the World Economy Moving?

**《世界经济的重心，正在向哪里移动？》**

![Preview](outputs/thumbnails/preview.gif)

**A 66-second cinematic visualization of how global economic weight shifted from 1960 to 2024, told through country-level GDP share choropleth maps and a moving weighted-center marker.**

---

## What this is

Episode 001 is the first entry in an open-source spatiotemporal visualization series. It tells the story of how the relative economic weight of countries has changed over six decades — and how the visual "center of gravity" of the world economy appears to drift across the map.

This repository contains the complete pipeline: data acquisition scripts, preprocessing code, React-based visualization app, and video export tooling.

---

## The video

| Property | Value |
|---|---|
| Duration | 66 seconds |
| Resolution | 2560×1440 (original), 1920×1080 (downscale) |
| Year range | 1960–2024 |
| Frame rate | 30 fps |
| Data source | World Bank GDP (current US$) |

---

## Quick start

```bash
# 1. Install viz dependencies
cd viz && npm install && cd ..

# 2. Download and process data
python scripts/01_download_world_bank_gdp.py
python scripts/02_clean_gdp_data.py
python scripts/03_join_with_boundaries.py
python scripts/04_generate_render_assets.py

# 3. Build and export video
python scripts/05_export_video.py
```

Or just run the dev server to explore the visualization interactively:

```bash
bash run.sh
```

---

## Data

- **Primary indicator:** World Bank GDP (current US$) — `NY.GDP.MKTP.CD`
- **Spatial data:** Natural Earth 110m country boundaries
- **Derived metrics:**
  - `gdp_share` — share of global GDP (primary visual channel)
  - `gdp_log` — log-scaled GDP (balanced coloring)
  - `gdp_share_change` — year-over-year change

---

## Tech stack

| Layer | Technology |
|---|---|
| Visualization | React + Vite |
| Animation | Framer Motion |
| State | Zustand |
| Icons | React Icons |
| Frame export | Playwright |
| Video assembly | FFmpeg |
| Data processing | Python 3 + pandas + geopandas |

---

## Repository structure

```
episode_001/
├─ scripts/          # Data pipeline (download → clean → join → export)
├─ viz/              # React visualization app
│   ├─ src/          # Components, store, styles
│   ├─ public/data/  # Generated geometry + timeseries bundles
│   └─ scripts/      # Playwright frame exporter
├─ docs/             # Storyboard, narration, credits
├─ configs/          # Pipeline config
└─ outputs/          # Generated video + frames (not committed)
```

---

## License

MIT
