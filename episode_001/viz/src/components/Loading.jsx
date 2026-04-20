import React from 'react'

function Loading() {
  return (
    <div className="loading">
      <div className="loading-spinner" />
      <div className="loading-title">Loading Economic Atlas</div>
      <div className="loading-copy">Preparing country geometry and GDP timeseries.</div>
    </div>
  )
}

export default Loading
