# Credits - Episode 001

## Data Sources

### Primary Indicator
- **World Bank Indicators API**
  - Indicator: `NY.GDP.MKTP.CD`
  - Name: GDP (current US$)
  - Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
  - Indicator page: https://data.worldbank.org/indicator/NY.GDP.MKTP.CD

### Country Boundaries
- **Natural Earth Admin 0 Countries**
  - Source family: Natural Earth
  - Download page: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
  - GeoJSON mirror used by the pipeline:
    `https://unpkg.com/three-globe@2.32.0/example/country-polygons/ne_110m_admin_0_countries.geojson`

## Data Processing

- Python pipeline in `/scripts`
- Country-year metric derivation:
  - global GDP total
  - GDP share
  - log GDP
  - GDP rank
  - GDP share change

## Visualization

- **Frontend**: React + Vite
- **Animation / UI motion**: Framer Motion
- **State management**: Zustand
- **Rendering approach**: 2D SVG country choropleth with animated weighted-center marker

## Production Notes

- Episode title:
  `Where Is the Center of the World Economy Moving?`
- Format:
  16:9 main export, 9:16 derivative supported by config
- Open-source goal:
  fully reproducible scripts + reusable country-indicator frontend

## License

This episode pipeline and code are released under the repository license.
