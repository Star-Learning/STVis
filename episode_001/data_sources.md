# Data Sources

## Primary Indicator

### World Bank Indicators API

- Indicator: `NY.GDP.MKTP.CD`
- Name: GDP (current US$)
- Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
- Indicator page: https://data.worldbank.org/indicator/NY.GDP.MKTP.CD
- API example: https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json

### Why this indicator

- global country coverage
- clean country-year structure
- easy ISO3 join with country boundaries
- strong narrative fit for a shifting economic-balance story

## Spatial Companion Data

### Country Boundaries

- Source family: Natural Earth Admin 0 Countries
- Download page: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
- Runtime GeoJSON mirror used in the scripts:
  `https://unpkg.com/three-globe@2.32.0/example/country-polygons/ne_110m_admin_0_countries.geojson`

### Join key

- `ISO3` country code

## Generated Project Assets

The repository stores lightweight generated outputs and reproducible scripts. Large or refreshable upstream data can be re-fetched with the scripts under `scripts/`.
