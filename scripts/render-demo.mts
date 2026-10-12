// Writes nukey's README images into plugins/nukey/assets/:
//   demo-scenes.svg         a dark band cycling through a few scenes with their label and detail
//   demo-meter.svg          the meter filling up
//   demo-meter-details.svg  the same, with the readings table beside it
//   demo-themes.svg         Nukey in each theme, with its name
// Run from the repository root: npx -y tsx@4.23.15 scripts/render-demo.mts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Gauges, SceneId } from '../plugins/nukey/types/index.d.ts'
import { drawNukey, drawPanel, drawProp, panelReadings, panelWidth } from '../plugins/nukey/hooks/art/index.ts'
import { THEMES, THEME_NAMES } from '../plugins/nukey/hooks/themes.ts'

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'nukey', 'assets')
mkdirSync(assets, { recursive: true })

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const BAND = '#1E1F24'
const BAND_EDGE = '#34363D'
const LABEL = '#F2F2F4'
const DIM = '#9DA1AA'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A whole document drawn at twice its size, so it stays crisp in a README.
function doc(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${BAND}" stroke="${BAND_EDGE}"/>` +
    body +
    '</svg>'
  )
}

const place = (x: number, y: number, svg: string) => `<g transform="translate(${x} ${y})">${svg}</g>`

// A drawing's markup without its own <svg> wrapper, so it shares the document's clock.
const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')

const text = (x: number, y: number, body: string, attrs: string) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" ${attrs}>${esc(body)}</text>`

// Frame `i` of `count`, each shown for `seconds`, looping.
function frame(i: number, count: number, seconds: number, body: string): string {
  const total = count * seconds
  const from = i / count
  const to = (i + 1) / count
  const anim =
    i === 0
      ? `values="1;0" keyTimes="0;${to}"`
      : i === count - 1
        ? `values="0;1" keyTimes="0;${from}"`
        : `values="0;1;0" keyTimes="0;${from};${to}"`
  return `<g opacity="${i === 0 ? 1 : 0}"><animate attributeName="opacity" ${anim} calcMode="discrete" dur="${total}s" repeatCount="indefinite"/>${body}</g>`
}

// --- Scenes ---------------------------------------------------------------

const SCENES: { scene: SceneId; label: string; detail: string }[] = [
  { scene: 'thinking', label: 'Thinking it over', detail: '' },
  { scene: 'reading', label: 'Reading through the files', detail: 'src/kitchen/recipes.ts' },
  { scene: 'coding', label: 'Cooking up some code', detail: 'src/kitchen/timer.ts' },
  { scene: 'testing', label: 'Taste-testing', detail: 'npm test' },
  { scene: 'delegating', label: 'Sending in the helpers', detail: '2 helpers: Explore, Plan' },
  { scene: 'asking', label: 'Needs your input', detail: 'Which oven should I use?' },
  { scene: 'done', label: 'Ding! All done', detail: '' },
]

function sceneReel(): string {
  const theme = THEMES.classic
  const width = 420
  const height = 88
  const seconds = 2.5
  const cycle = SCENES.length * seconds
  const frames = SCENES.map(({ scene, label, detail }, i) => {
    // Nukey and its prop share scene coordinates; the clip keeps props that slide in from the edge inside it.
    let prop = inner(drawProp(scene, theme))
    // A one-time animation (the DING! pop) restarts each time its frame comes round.
    const starts = Array.from({ length: 48 }, (_, n) => `${n * cycle + i * seconds}s`).join(';')
    prop = prop.replaceAll('dur="0.45s" fill="freeze"', `begin="${starts}" dur="0.45s" fill="freeze"`)
    const art = place(12, 12, `<g clip-path="url(#scene)">${inner(drawNukey(scene, theme))}${prop}</g>`)
    const words =
      text(156, detail ? 40 : 48, label, `font-size="14" font-weight="700" fill="${LABEL}"`) +
      (detail ? text(156, 59, detail, `font-size="12" fill="${DIM}"`) : '')
    return frame(i, SCENES.length, seconds, art + words)
  })
  const clip = '<defs><clipPath id="scene"><rect width="128" height="64"/></clipPath></defs>'
  return doc(width, height, clip + frames.join(''))
}

// --- Meter ----------------------------------------------------------------

const READINGS: Gauges[] = [
  { context: 6, fiveHour: 4, week: 2 },
  { context: 18, fiveHour: 12, week: 6 },
  { context: 31, fiveHour: 25, week: 11 },
  { context: 47, fiveHour: 38, week: 17 },
  { context: 62, fiveHour: 51, week: 24 },
  { context: 76, fiveHour: 66, week: 33 },
  { context: 88, fiveHour: 79, week: 41 },
  { context: 97, fiveHour: 91, week: 52 },
]

function meterDemo(details: boolean): string {
  const theme = THEMES.classic
  const panel = panelWidth(READINGS[0]!)
  const width = 12 + panel + (details ? 168 : 12)
  const height = 88
  const frames = READINGS.map((g, i) => {
    let body = place(12, 12, drawPanel(g, theme))
    if (details) {
      const rows = panelReadings(g)
      const top = 44 - (rows.length - 1) * 9.5
      rows.forEach((row, r) => {
        const y = top + r * 19 + 4.5
        body += text(12 + panel + 18, y, row.label, `font-size="12.5" fill="${DIM}"`)
        body += text(width - 18, y, row.value, `font-size="12.5" font-weight="700" fill="${LABEL}" text-anchor="end"`)
      })
    }
    return frame(i, READINGS.length, 1.2, body)
  })
  return doc(width, height, frames.join(''))
}

// --- Themes ---------------------------------------------------------------

function themesDemo(): string {
  const cell = 92
  const width = cell * THEME_NAMES.length + 16
  const height = 104
  const body = THEME_NAMES.map((name, i) => {
    const theme = THEMES[name]
    const x = 8 + cell * i
    return (
      place(x + (cell - 60) / 2, 6, drawNukey('talking', theme)) +
      text(x + cell / 2, 88, theme.label, `font-size="11.5" font-weight="600" fill="${LABEL}" text-anchor="middle"`)
    )
  })
  return doc(width, height, body.join(''))
}

const outputs: [string, string][] = [
  ['demo-scenes.svg', sceneReel()],
  ['demo-meter.svg', meterDemo(false)],
  ['demo-meter-details.svg', meterDemo(true)],
  ['demo-themes.svg', themesDemo()],
]

for (const [name, svg] of outputs) {
  writeFileSync(join(assets, name), svg + '\n')
  console.log(`wrote plugins/nukey/assets/${name} (${svg.length} bytes)`)
}
