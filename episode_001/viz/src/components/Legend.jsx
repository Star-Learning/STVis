import React from 'react'
import { motion } from 'framer-motion'

function formatLegendValue(mode, value) {
  if (mode === 'gdp_share') {
    return `${(value * 100).toFixed(1)}%`
  }
  if (mode === 'gdp_share_change') {
    return `${(value * 100).toFixed(2)} pp`
  }
  return value.toFixed(1)
}

function Legend({ mode, domains, visible }) {
  const domain = domains?.[mode]
  if (!domain) {
    return null
  }

  const gradients = {
    gdp_share: 'linear-gradient(90deg, #08111d 0%, #0f4c5c 40%, #d08b4b 75%, #fef3cf 100%)',
    gdp_log: 'linear-gradient(90deg, #071118 0%, #1e5f74 35%, #7bc4c4 70%, #f8e6b3 100%)',
    gdp_share_change: 'linear-gradient(90deg, #1d4e89 0%, #0e1523 50%, #d97706 100%)',
  }

  return (
    <motion.div
      className={`legend ${visible ? 'visible' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
      transition={{ duration: 0.45 }}
    >
      <div className="legend-title">
        {mode === 'gdp_share' && 'Share of global GDP'}
        {mode === 'gdp_log' && 'Log-scaled GDP'}
        {mode === 'gdp_share_change' && 'Annual share change'}
      </div>
      <div className="legend-gradient" style={{ background: gradients[mode] }} />
      <div className="legend-labels">
        <span>{formatLegendValue(mode, domain.min)}</span>
        <span>{formatLegendValue(mode, domain.max)}</span>
      </div>
    </motion.div>
  )
}

export default Legend
