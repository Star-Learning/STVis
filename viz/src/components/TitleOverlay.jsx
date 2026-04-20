import React from 'react'
import { motion } from 'framer-motion'

function TitleOverlay({ visible }) {
  return (
    <motion.div
      className="title-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.4, ease: 'easeInOut' }}
    >
      <div className="title-kicker">World GDP Shift</div>
      <h1>{'\u4e16\u754c\u7ecf\u6d4e\u7684\u91cd\u5fc3\uff0c\u6b63\u5728\u5411\u54ea\u91cc\u79fb\u52a8\uff1f'}</h1>
      <p>Watch the relative weight of national economies redraw the map over time.</p>
    </motion.div>
  )
}

export default TitleOverlay
