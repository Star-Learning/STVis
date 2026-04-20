import React, { useMemo } from 'react'

const VIEWBOX_WIDTH = 1400
const VIEWBOX_HEIGHT = 788

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function hexToRgb(hex) {
  const cleaned = hex.replace('#', '')
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixColor(start, end, t) {
  const a = hexToRgb(start)
  const b = hexToRgb(end)
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

function interpolatePalette(stops, t) {
  const scaled = clamp01(t) * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(scaled))
  const localT = scaled - index
  return mixColor(stops[index], stops[index + 1], localT)
}

function projectPoint([lon, lat]) {
  return [
    ((lon + 180) / 360) * VIEWBOX_WIDTH,
    ((90 - lat) / 180) * VIEWBOX_HEIGHT,
  ]
}

function ringToPath(ring) {
  return (
    ring
      .map((point, index) => {
        const [x, y] = projectPoint(point)
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ') + ' Z'
  )
}

function geometryToPath(geometry) {
  if (!geometry) {
    return ''
  }
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ringToPath(ring)).join(' ')
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => polygon.map((ring) => ringToPath(ring)).join(' '))
      .join(' ')
  }
  return ''
}

function metricValue(metric, mode) {
  if (!metric) {
    return null
  }
  if (mode === 'gdp_log') {
    return metric.gdp_log
  }
  if (mode === 'gdp_share_change') {
    return metric.gdp_share_change
  }
  return metric.gdp_share
}

function colorForMetric(value, domain, mode) {
  if (value === null || value === undefined || !domain) {
    return '#081018'
  }

  if (mode === 'gdp_share_change') {
    const extreme = Math.max(Math.abs(domain.min), Math.abs(domain.max)) || 1
    const normalized = clamp01((value + extreme) / (extreme * 2))
    return interpolatePalette(['#1d4e89', '#0f1727', '#d97706'], normalized)
  }

  const normalized = clamp01((value - domain.min) / ((domain.max - domain.min) || 1))
  const softened = mode === 'gdp_share' ? Math.sqrt(normalized) : normalized
  const stops =
    mode === 'gdp_log'
      ? ['#071118', '#1e5f74', '#7bc4c4', '#f8e6b3']
      : ['#08111d', '#0f4c5c', '#d08b4b', '#fef3cf']
  return interpolatePalette(stops, softened)
}

function formatMetric(metric, mode) {
  if (!metric) {
    return 'No data'
  }
  if (mode === 'gdp_share') {
    return `${(metric.gdp_share * 100).toFixed(2)}% of world GDP`
  }
  if (mode === 'gdp_log') {
    return `log10 GDP ${metric.gdp_log.toFixed(2)}`
  }
  return `${(metric.gdp_share_change * 100).toFixed(2)} pp vs previous year`
}

function interpolateMetric(metric, nextMetric, progress) {
  if (!metric && !nextMetric) {
    return null
  }
  if (!metric) {
    return nextMetric
  }
  if (!nextMetric) {
    return metric
  }

  return {
    ...metric,
    gdp_current_usd:
      metric.gdp_current_usd + (nextMetric.gdp_current_usd - metric.gdp_current_usd) * progress,
    global_gdp_total:
      metric.global_gdp_total + (nextMetric.global_gdp_total - metric.global_gdp_total) * progress,
    gdp_share: metric.gdp_share + (nextMetric.gdp_share - metric.gdp_share) * progress,
    gdp_log: metric.gdp_log + (nextMetric.gdp_log - metric.gdp_log) * progress,
    gdp_rank: Math.round(metric.gdp_rank + (nextMetric.gdp_rank - metric.gdp_rank) * progress),
    gdp_share_change:
      metric.gdp_share_change + (nextMetric.gdp_share_change - metric.gdp_share_change) * progress,
  }
}

function interpolateAngle(start, end, progress) {
  let delta = end - start
  if (Math.abs(delta) > 180) {
    delta -= Math.sign(delta) * 360
  }
  const result = start + delta * progress
  return ((result + 540) % 360) - 180
}

function getLabelLayout(centroid, rank) {
  const [x] = centroid
  const anchor = x > VIEWBOX_WIDTH * 0.7 ? 'end' : 'start'
  const dx = anchor === 'end' ? -14 : 14
  const dyPattern = [-14, 0, 14, -8, 8]
  const dy = dyPattern[(rank - 1) % dyPattern.length]
  return { anchor, dx, dy }
}

function WorldMap({
  geometry,
  mode,
  currentYear,
  nextYear,
  displayYear,
  transitionProgress,
  timeseries,
  renderConfig,
}) {
  const domains = timeseries?.domains || {}
  const currentYearData = timeseries?.yearly?.find((entry) => entry.year === currentYear) || null
  const nextYearData = timeseries?.yearly?.find((entry) => entry.year === nextYear) || currentYearData
  const highlightCount = renderConfig?.highlights?.top_n || 8
  const highlightedCountries = currentYearData?.top_countries?.slice(0, highlightCount) || []
  const highlightMap = useMemo(
    () => new Map(highlightedCountries.map((item) => [item.iso3, item])),
    [highlightedCountries],
  )

  const paths = useMemo(() => {
    const features = geometry?.features || []
    return features.map((feature) => {
      const properties = feature.properties || {}
      const metric = properties.metrics?.[String(currentYear)] || null
      const nextMetric = properties.metrics?.[String(nextYear)] || metric
      const interpolatedMetric = interpolateMetric(metric, nextMetric, transitionProgress)
      const value = metricValue(interpolatedMetric, mode)
      return {
        id: properties.iso3,
        name: properties.country,
        centroid: projectPoint([properties.centroid_lon || 0, properties.centroid_lat || 0]),
        highlightRank: highlightMap.get(properties.iso3)?.gdp_rank ?? null,
        fill: colorForMetric(value, domains[mode], mode),
        path: geometryToPath(feature.geometry),
        metric: interpolatedMetric,
      }
    })
  }, [currentYear, domains, geometry, highlightMap, mode, nextYear, transitionProgress])

  const centerPoint = currentYearData?.center
    ? {
        lon: interpolateAngle(
          currentYearData.center.lon,
          nextYearData?.center?.lon ?? currentYearData.center.lon,
          transitionProgress,
        ),
        lat:
          currentYearData.center.lat +
          ((nextYearData?.center?.lat ?? currentYearData.center.lat) - currentYearData.center.lat) *
            transitionProgress,
      }
    : null
  const centerScreenPoint = centerPoint ? projectPoint([centerPoint.lon, centerPoint.lat]) : null
  const leadCountry = currentYearData?.top_countries?.[0] || null
  const dominantContinent = currentYearData?.dominant_continent || 'Unknown'
  const leadContinents = currentYearData?.continent_shares?.slice(0, 3) || []
  const roundedDisplayYear = Math.round(displayYear ?? currentYear ?? 0)

  return (
    <div className="world-map-card">
      <div className="world-map-header">
        <div>
          <div className="map-kicker">Global Choropleth</div>
          <div className="map-title">Country-level GDP movement</div>
        </div>
        <div className="map-meta">{paths.filter((item) => item.metric).length} countries with data</div>
      </div>

      <div className="map-summary-row">
        <div className="map-summary-card">
          <span className="map-summary-label">Balance Continent</span>
          <strong>{dominantContinent}</strong>
          <div className="map-summary-subtle">
            {leadContinents
              .map((item) => `${item.continent} ${(item.gdp_share * 100).toFixed(1)}%`)
              .join(' · ')}
          </div>
        </div>
        <div className="map-summary-card">
          <span className="map-summary-label">Lead Economy</span>
          <strong>{leadCountry ? `${leadCountry.country} · ${(leadCountry.gdp_share * 100).toFixed(1)}%` : 'N/A'}</strong>
        </div>
      </div>

      <svg className="world-map" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
        <defs>
          <linearGradient id="oceanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#081321" />
            <stop offset="48%" stopColor="#0f2031" />
            <stop offset="100%" stopColor="#14293c" />
          </linearGradient>
          <filter id="centerGlow">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="url(#oceanGlow)" rx="26" />

        {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
          <line
            key={`lat-${ratio}`}
            x1="0"
            x2={VIEWBOX_WIDTH}
            y1={VIEWBOX_HEIGHT * ratio}
            y2={VIEWBOX_HEIGHT * ratio}
            className="graticule"
          />
        ))}
        {[0.166, 0.333, 0.5, 0.666, 0.833].map((ratio) => (
          <line
            key={`lon-${ratio}`}
            y1="0"
            y2={VIEWBOX_HEIGHT}
            x1={VIEWBOX_WIDTH * ratio}
            x2={VIEWBOX_WIDTH * ratio}
            className="graticule"
          />
        ))}

        {paths.map((item) => (
          <path
            key={item.id}
            d={item.path}
            fill={item.fill}
            className={`country-shape ${item.highlightRank ? 'is-top-country' : ''}`}
          >
            <title>
              {`${item.name} (${item.id})\n${formatMetric(item.metric, mode)}${
                item.highlightRank
                  ? `\nTop ${highlightCount} · Rank #${item.highlightRank}`
                  : item.metric
                    ? `\nRank #${item.metric.gdp_rank}`
                    : ''
              }`}
            </title>
          </path>
        ))}

        {paths
          .filter((item) => item.highlightRank)
          .map((item) => {
            const labelLayout = getLabelLayout(item.centroid, item.highlightRank)
            return (
              <g key={`${item.id}-rank`} transform={`translate(${item.centroid[0]}, ${item.centroid[1]})`}>
                <circle r="8" className="country-dot" />
                <text className="country-rank-label" textAnchor="middle" dominantBaseline="central">
                  {item.highlightRank}
                </text>
                <line
                  className="country-connector"
                  x1="0"
                  y1="0"
                  x2={labelLayout.dx * 0.75}
                  y2={labelLayout.dy * 0.75}
                />
                <text
                  className="country-name-label"
                  x={labelLayout.dx}
                  y={labelLayout.dy}
                  textAnchor={labelLayout.anchor}
                  dominantBaseline="central"
                >
                  {item.name}
                </text>
              </g>
            )
          })}

        {centerScreenPoint && (
          <g transform={`translate(${centerScreenPoint[0]}, ${centerScreenPoint[1]})`} filter="url(#centerGlow)">
            <circle r="18" className="center-halo" />
            <circle r="6" className="center-core" />
            <circle r="38" className="center-ring" />
            <g transform="translate(14,-54)" className="center-callout">
              <rect x="0" y="0" width="142" height="42" rx="12" />
              <text x="12" y="16" className="center-callout-year">
                {roundedDisplayYear}
              </text>
              <text x="12" y="30" className="center-callout-continent">
                {dominantContinent}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

export default WorldMap
