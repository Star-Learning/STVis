import React from 'react'
import { motion } from 'framer-motion'

function StoryCaption({ yearData, mode, visible }) {
  if (!yearData) {
    return null
  }

  const leader = yearData.top_countries?.[0]
  const dominantContinent = yearData.dominant_continent
  const share = leader ? `${(leader.gdp_share * 100).toFixed(1)}%` : ''

  const copyByMode = {
    gdp_share: `${leader?.country || 'The leading economy'} holds ${share} of global GDP in ${yearData.year}.`,
    gdp_log: 'Log scale softens the dominance of very large economies so more country trajectories stay legible.',
    gdp_share_change: 'This view emphasizes yearly gains and losses in global GDP share instead of absolute size.',
  }

  return (
    <motion.section
      className={`panel-card ${visible ? 'visible' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 16 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="panel-card-label">Story Cue</div>
      <p className="story-copy">{copyByMode[mode]}</p>
      <div className="center-readout">
        Current balance leans toward
        <span>{dominantContinent || 'N/A'}</span>
      </div>
    </motion.section>
  )
}

export default StoryCaption
