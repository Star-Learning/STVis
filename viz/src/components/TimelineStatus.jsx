import React from 'react'
import { motion } from 'framer-motion'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function TimelineStatus({ years, displayYear, milestones, visible }) {
  if (!years?.length) {
    return null
  }

  const startYear = years[0]
  const endYear = years[years.length - 1]
  const activeYear = Math.round(displayYear ?? startYear)
  const progress = clamp((activeYear - startYear) / Math.max(endYear - startYear, 1), 0, 1)

  return (
    <motion.section
      className={`panel-card ${visible ? 'visible' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 16 }}
      transition={{ duration: 0.5, delay: 0.03 }}
    >
      <div className="panel-card-label">Timeline Sync</div>
      <div className="timeline-copy">
        The side panel follows the world map continuously from {startYear} to {endYear}.
      </div>

      <div className="timeline-year-pill">{activeYear}</div>

      <div className="timeline-rail">
        <div className="timeline-track" />
        <div className="timeline-progress" style={{ width: `${progress * 100}%` }} />
        <div className="timeline-marker" style={{ left: `${progress * 100}%` }} />

        {milestones.map((year) => {
          const markerProgress = clamp((year - startYear) / Math.max(endYear - startYear, 1), 0, 1)
          return (
            <div
              key={year}
              className={`timeline-milestone ${activeYear === year ? 'active' : ''}`}
              style={{ left: `${markerProgress * 100}%` }}
            >
              <span className="timeline-dot" />
              <span className="timeline-label">{year}</span>
            </div>
          )
        })}
      </div>

    </motion.section>
  )
}

export default TimelineStatus
