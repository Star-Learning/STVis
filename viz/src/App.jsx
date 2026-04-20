import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HiPause, HiPlay } from 'react-icons/hi'
import WorldMap from './components/WorldMap'
import TitleOverlay from './components/TitleOverlay'
import DateOverlay from './components/DateOverlay'
import Legend from './components/Legend'
import Loading from './components/Loading'
import TopCountriesPanel from './components/TopCountriesPanel'
import StoryCaption from './components/StoryCaption'
import TimelineStatus from './components/TimelineStatus'
import { useStore } from './store'

const CONFIG_URL = '/config/render_config.json'

function App() {
  const [loading, setLoading] = useState(true)
  const [showTitle, setShowTitle] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [hasAutoStarted, setHasAutoStarted] = useState(false)
  const exportParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const isExportMode = exportParams.get('export') === '1'

  const {
    isPlaying,
    setIsPlaying,
    currentFrame,
    setCurrentFrame,
    mode,
    setMode,
    config,
    setConfig,
    geometry,
    setGeometry,
    timeseries,
    setTimeseries,
  } = useStore()

  useEffect(() => {
    async function loadData() {
      try {
        const configResponse = await fetch(CONFIG_URL)
        if (!configResponse.ok) {
          throw new Error(`Unable to load config: ${configResponse.status}`)
        }
        const renderConfig = await configResponse.json()
        setConfig(renderConfig)

        const [geometryResponse, timeseriesResponse] = await Promise.all([
          fetch(renderConfig.data.geometry_url),
          fetch(renderConfig.data.timeseries_url),
        ])

        if (!geometryResponse.ok || !timeseriesResponse.ok) {
          throw new Error('Unable to load GDP geometry or timeseries assets.')
        }

        const [geometryPayload, timeseriesPayload] = await Promise.all([
          geometryResponse.json(),
          timeseriesResponse.json(),
        ])

        setGeometry(geometryPayload)
        setTimeseries(timeseriesPayload)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unknown loading error.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [setConfig, setGeometry, setTimeseries])

  const years = config?.data?.years || timeseries?.years || []
  const animation = config?.animation || {}
  const currentFrameIndex = Math.min(Math.floor(currentFrame), Math.max(years.length - 1, 0))
  const nextFrameIndex = Math.min(currentFrameIndex + 1, Math.max(years.length - 1, 0))
  const transitionProgress = Math.max(0, Math.min(1, currentFrame - currentFrameIndex))
  const currentYear = years[currentFrameIndex] ?? null
  const nextYear = years[nextFrameIndex] ?? currentYear
  const displayYear =
    currentYear !== null && nextYear !== null
      ? currentYear + (nextYear - currentYear) * transitionProgress
      : null
  const currentYearData = useMemo(() => {
    return timeseries?.yearly?.find((entry) => entry.year === currentYear) || null
  }, [currentYear, timeseries])
  const introDurationMs = animation.intro_duration_ms ?? 4000
  const frameDurationMs = animation.frame_duration_ms ?? 950

  const togglePlayback = () => {
    if (years.length === 0) {
      return
    }
    if (currentFrame >= years.length - 1) {
      setCurrentFrame(0)
    }
    setIsPlaying(!isPlaying)
  }

  useEffect(() => {
    if (isExportMode) {
      return undefined
    }
    if (!config || years.length === 0) {
      return
    }
    const timer = window.setTimeout(() => {
      setShowTitle(false)
    }, introDurationMs)
    return () => window.clearTimeout(timer)
  }, [config, years.length, introDurationMs, isExportMode, setShowTitle])

  useEffect(() => {
    if (isExportMode) {
      return
    }
    if (!config || years.length === 0 || !animation.autoplay || showTitle || hasAutoStarted) {
      return
    }
    setIsPlaying(true)
    setHasAutoStarted(true)
  }, [animation.autoplay, config, hasAutoStarted, isExportMode, setIsPlaying, showTitle, years.length])

  useEffect(() => {
    if (isExportMode) {
      return
    }
    if (!isPlaying || years.length === 0) {
      return
    }

    let animationFrameId = 0
    let previousTimestamp = 0
    let didStop = false

    const step = (timestamp) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp
      }

      const delta = timestamp - previousTimestamp
      previousTimestamp = timestamp

      setCurrentFrame((previous) => {
        const next = previous + delta / frameDurationMs
        if (next >= years.length - 1) {
          if (!didStop) {
            didStop = true
            window.setTimeout(() => setIsPlaying(false), 0)
          }
          return years.length - 1
        }
        return next
      })

      animationFrameId = window.requestAnimationFrame(step)
    }

    animationFrameId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animationFrameId)
  }, [frameDurationMs, isExportMode, isPlaying, years.length, setCurrentFrame, setIsPlaying])

  useEffect(() => {
    if (isExportMode) {
      return undefined
    }
    function handleKeydown(event) {
      if (years.length === 0) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        togglePlayback()
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault()
        setIsPlaying(false)
        setCurrentFrame((previous) => Math.min(Math.floor(previous) + 1, years.length - 1))
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        setIsPlaying(false)
        setCurrentFrame((previous) => Math.max(Math.ceil(previous) - 1, 0))
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [currentFrame, isExportMode, isPlaying, setCurrentFrame, setIsPlaying, years.length])

  useEffect(() => {
    if (!isExportMode) {
      return undefined
    }

    const totalTimelineMs = introDurationMs + Math.max(years.length - 1, 0) * frameDurationMs

    window.__EPISODE_EXPORT__ = {
      ready: !loading && !loadError && Boolean(config && geometry && timeseries),
      introDurationMs,
      frameDurationMs,
      totalTimelineMs,
      totalYearSteps: Math.max(years.length - 1, 0),
      setElapsedMs(elapsedMs) {
        const clampedElapsedMs = Math.max(0, Math.min(totalTimelineMs, Number(elapsedMs) || 0))
        setIsPlaying(false)
        setHasAutoStarted(true)

        if (clampedElapsedMs < introDurationMs) {
          setShowTitle(true)
          setCurrentFrame(0)
          return
        }

        setShowTitle(false)
        const timelineMs = clampedElapsedMs - introDurationMs
        const frameValue = Math.min(Math.max(years.length - 1, 0), timelineMs / frameDurationMs)
        setCurrentFrame(frameValue)
      },
      setMode(candidateMode) {
        setMode(candidateMode)
      },
    }

    return () => {
      delete window.__EPISODE_EXPORT__
    }
  }, [
    config,
    frameDurationMs,
    geometry,
    introDurationMs,
    isExportMode,
    loadError,
    loading,
    setCurrentFrame,
    setIsPlaying,
    setMode,
    timeseries,
    years.length,
  ])

  if (loading) {
    return <Loading />
  }

  if (loadError) {
    return (
      <div className="loading">
        <div className="loading-title">Asset Load Failed</div>
        <div className="loading-copy">{loadError}</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="background-orbit background-orbit-left" />
      <div className="background-orbit background-orbit-right" />

      <main className="stage">
        <section className="map-shell">
          <WorldMap
            geometry={geometry}
            mode={mode}
            currentYear={currentYear}
            nextYear={nextYear}
            displayYear={displayYear}
            transitionProgress={transitionProgress}
            timeseries={timeseries}
            renderConfig={config}
          />
        </section>

        <aside className="side-panel">
          <div className="eyebrow">Episode 001</div>
          <h1 className="panel-title">{config?.project?.title}</h1>
          <p className="panel-subtitle">{config?.project?.subtitle}</p>

          <DateOverlay
            currentYear={currentYear}
            nextYear={nextYear}
            displayYear={displayYear}
            transitionProgress={transitionProgress}
            visible={!showTitle}
          />
          <TimelineStatus
            years={years}
            displayYear={displayYear}
            milestones={config?.highlights?.years || []}
            visible={!showTitle}
          />
          <TopCountriesPanel yearData={currentYearData} visible={!showTitle} />
          <StoryCaption yearData={currentYearData} mode={mode} visible={!showTitle} />
        </aside>
      </main>

      <TitleOverlay visible={showTitle} />

      <div className="control-strip">
        <div className="mode-toggle">
          {(config?.data?.modes || []).map((candidate) => (
            <button
              key={candidate}
              className={`mode-btn ${candidate === mode ? 'active' : ''}`}
              onClick={() => setMode(candidate)}
            >
              {config?.labels?.[candidate] || candidate}
            </button>
          ))}
        </div>

        <div className="transport">
          <button className="control-btn" onClick={togglePlayback}>
            {isPlaying ? <HiPause /> : <HiPlay />}
          </button>
          <div className="scrubber-shell">
            <input
              className="year-scrubber"
              type="range"
              min={0}
              max={Math.max(years.length - 1, 0)}
              value={currentFrame}
              onChange={(event) => {
                setIsPlaying(false)
                setCurrentFrame(Number(event.target.value))
              }}
            />
            <div className="scrubber-year">{displayYear ? Math.round(displayYear) : 'N/A'}</div>
          </div>
          <div className="progress-shell">
            <div
              className="progress-fill"
              style={{
                width: years.length > 1 ? `${(currentFrame / (years.length - 1)) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      </div>

      <Legend mode={mode} domains={timeseries?.domains} visible={!showTitle} />

      <AnimatePresence>
        {!showTitle && currentYearData && (
          <motion.div
            className="bottom-note"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            Map highlights now match the Top 8 ranking, and the moving marker is annotated with the current year and dominant continent.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
