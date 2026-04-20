# STVis — Spatiotemporal Visualization Series

A multi-episode open-source project that tells stories through interactive spatiotemporal visualizations. Each episode explores a different phenomenon — shifting economic power, climate change, migration patterns — using cinematic animations and data-driven narratives.

---

## Episodes

### Episode 001: Where Is the Center of the World Economy Moving?

**《世界经济的重心，正在向哪里移动？》**

![Preview](episode_001/outputs/thumbnails/preview.gif)

A 66-second cinematic visualization tracing how global economic weight shifted from 1960 to 2024, told through country-level GDP share choropleth maps and a moving weighted-center marker.

| Property | Value |
|---|---|
| Duration | 66 seconds |
| Year range | 1960–2024 |
| Data source | World Bank GDP (current US$) |
| Repository | [episode_001/](episode_001/) |

**Key story:** The visual "center of gravity" of the world economy appears to drift eastward — from the Atlantic toward Asia — as developing nations grow faster than legacy industrial powers.

---

## Project philosophy

- **Data-driven storytelling** — every episode is built around a narrative hook, not just a dataset
- **Reproducible pipelines** — raw data → processed → visualized, fully scripted
- **Open visualization** — React + Framer Motion frontend, designed for cinematic export via Playwright + FFmpeg

## Tech stack

React · Vite · Framer Motion · Zustand · Playwright · FFmpeg · Python (pandas, geopandas)

## License

MIT
