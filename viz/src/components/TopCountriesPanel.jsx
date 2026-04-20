import React from 'react'
import { motion } from 'framer-motion'

function TopCountriesPanel({ yearData, visible }) {
  const topCountries = yearData?.top_countries?.slice(0, 8) || []

  return (
    <motion.section
      className={`panel-card ranking-card ${visible ? 'visible' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 16 }}
      transition={{ duration: 0.5, delay: 0.05 }}
    >
      <div className="panel-card-label">Top 8 Economies</div>
      <div className="ranking-list">
        {topCountries.map((country) => (
          <div className="ranking-row" key={`${yearData.year}-${country.iso3}`}>
            <div className="ranking-rank">{country.gdp_rank}</div>
            <div className="ranking-meta">
              <div className="ranking-country">{country.country}</div>
              <div className="ranking-iso">{country.iso3}</div>
            </div>
            <div className="ranking-value">{(country.gdp_share * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

export default TopCountriesPanel
