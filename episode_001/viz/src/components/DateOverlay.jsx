import React from 'react'
import { motion } from 'framer-motion'

function DateOverlay({ currentYear, nextYear, displayYear, transitionProgress, visible }) {
  if (!currentYear) {
    return null
  }

  const animatedYear = Math.max(currentYear, Math.min(nextYear || currentYear, Math.round(displayYear || currentYear)))
  const transitionLabel =
    nextYear && nextYear !== currentYear && transitionProgress > 0.02
      ? `toward ${nextYear}`
      : 'annual transition'

  return (
    <motion.div
      className={`date-card ${visible ? 'visible' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
      transition={{ duration: 0.5 }}
    >
      <div>
        <div className="date-label">Year</div>
        <div className="date-transition">{transitionLabel}</div>
      </div>
      <div className="date-value">{animatedYear}</div>
    </motion.div>
  )
}

export default DateOverlay
