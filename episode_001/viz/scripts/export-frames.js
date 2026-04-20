/**
 * Deterministically export frames from the preview app.
 *
 * Example:
 *   node scripts/export-frames.js --url http://127.0.0.1:4173 --output-dir ../outputs/frames
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:4173',
    outputDir: path.resolve(process.cwd(), '../outputs/frames'),
    format: 'png',
    fps: 30,
    width: 1920,
    height: 1080,
    holdMs: 1500,
    mode: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const next = argv[index + 1]

    if (token === '--url' && next) {
      options.url = next
      index += 1
    } else if (token === '--output-dir' && next) {
      options.outputDir = path.resolve(process.cwd(), next)
      index += 1
    } else if (token === '--format' && next) {
      options.format = next
      index += 1
    } else if (token === '--fps' && next) {
      options.fps = Number(next)
      index += 1
    } else if (token === '--width' && next) {
      options.width = Number(next)
      index += 1
    } else if (token === '--height' && next) {
      options.height = Number(next)
      index += 1
    } else if (token === '--hold-ms' && next) {
      options.holdMs = Number(next)
      index += 1
    } else if (token === '--mode' && next) {
      options.mode = next
      index += 1
    }
  }

  return options
}

function buildExportUrl(baseUrl) {
  const url = new URL(baseUrl)
  url.searchParams.set('export', '1')
  return url.toString()
}

async function clearOldFrames(outputDir, extension) {
  const entries = await fs.readdir(outputDir, { withFileTypes: true }).catch(() => [])
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith('frame_') && entry.name.endsWith(`.${extension}`))
      .map((entry) => fs.unlink(path.join(outputDir, entry.name))),
  )
}

async function waitForExportApi(page) {
  await page.waitForFunction(() => window.__EPISODE_EXPORT__?.ready === true, null, {
    timeout: 30000,
  })
}

async function getExportMeta(page) {
  return page.evaluate(() => ({
    introDurationMs: window.__EPISODE_EXPORT__.introDurationMs,
    frameDurationMs: window.__EPISODE_EXPORT__.frameDurationMs,
    totalTimelineMs: window.__EPISODE_EXPORT__.totalTimelineMs,
    totalYearSteps: window.__EPISODE_EXPORT__.totalYearSteps,
  }))
}

async function setElapsedMs(page, elapsedMs) {
  await page.evaluate(async ({ nextElapsedMs }) => {
    window.__EPISODE_EXPORT__.setElapsedMs(nextElapsedMs)
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
  }, { nextElapsedMs: elapsedMs })
}

async function exportFrames() {
  const options = parseArgs(process.argv.slice(2))
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1,
  })

  await fs.mkdir(options.outputDir, { recursive: true })
  await clearOldFrames(options.outputDir, options.format)

  await page.goto(buildExportUrl(options.url), { waitUntil: 'networkidle' })
  await page.waitForSelector('.app', { timeout: 30000 })
  await waitForExportApi(page)

  if (options.mode) {
    await page.evaluate((candidateMode) => {
      window.__EPISODE_EXPORT__.setMode(candidateMode)
    }, options.mode)
  }

  const meta = await getExportMeta(page)
  const totalDurationMs = meta.totalTimelineMs + Math.max(0, options.holdMs)
  const totalFrames = Math.max(1, Math.ceil((totalDurationMs / 1000) * options.fps))

  for (let index = 0; index < totalFrames; index += 1) {
    const elapsedMs = Math.min(meta.totalTimelineMs, (index / options.fps) * 1000)
    await setElapsedMs(page, elapsedMs)

    const outputFile = path.join(
      options.outputDir,
      `frame_${String(index).padStart(5, '0')}.${options.format}`,
    )
    await page.locator('.app').screenshot({ path: outputFile })

    if (index === 0 || index === totalFrames - 1 || index % options.fps === 0) {
      console.log(`Exported ${index + 1}/${totalFrames} frames`)
    }
  }

  await browser.close()
  console.log(`Frames written to ${options.outputDir}`)
}

exportFrames().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
