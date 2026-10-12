// The control-panel meter: power bars for the context window, two rows of buttons
// for the 5-hour and weekly rate limits.
import type { Gauges } from '../../types'
import type { Theme } from '../themes'
import { svgDoc, tag } from './svg'

const LIT_BUTTON = '#F2C14E'
const HOT = '#E5534B'
const UNLIT = '#8C9199'

export const BAR_COUNT = 9
export const FIVE_HOUR_COUNT = 5
export const WEEK_COUNT = 7

// How many of `units` light for a reading: none for no reading, else the share rounded, halves up.
export function litUnits(reading: number | null, units: number): number {
  if (reading === null || Number.isNaN(reading)) return 0
  const clamped = Math.min(Math.max(reading, 0), 100)
  return Math.floor((clamped * units) / 100 + 0.5)
}

// A lit unit turns red when the reading is above 85 and it is one of the gauge's last two.
export function isHot(reading: number | null, index: number, units: number): boolean {
  return reading !== null && reading > 85 && index >= units - 2 && index < litUnits(reading, units)
}

const hasLimits = (g: Gauges) => g.fiveHour !== null || g.week !== null

export function meterWidth(g: Gauges): number {
  return hasLimits(g) ? 132 : 80
}

const tenth = (n: number) => Math.round(n * 10) / 10

function buttons(reading: number | null, count: number, y: number, r: number, x0: number, dx: number, theme: Theme) {
  if (reading === null) return ''
  const lit = litUnits(reading, count)
  let out = ''
  for (let i = 0; i < count; i++) {
    const on = i < lit
    out += tag('circle', {
      cx: tenth(x0 + dx * i),
      cy: y,
      r,
      fill: on ? (isHot(reading, i, count) ? HOT : LIT_BUTTON) : UNLIT,
      opacity: on ? undefined : 0.6,
      stroke: theme.trim,
      'stroke-width': 0.8,
    })
  }
  return out
}

export function meterSvg(g: Gauges, theme: Theme): string {
  const width = meterWidth(g)
  const lit = litUnits(g.context, BAR_COUNT)
  let bars = ''
  for (let b = 0; b < BAR_COUNT; b++) {
    const height = tenth(8 + 3.6 * b)
    const on = b < lit
    bars += tag('rect', {
      x: tenth(11 + 6.8 * b),
      y: tenth(48 - height),
      width: 4.6,
      height,
      rx: 1.2,
      fill: on ? (isHot(g.context, b, BAR_COUNT) ? HOT : theme.accent) : UNLIT,
      opacity: on ? undefined : 0.4,
    })
  }
  return svgDoc(
    0,
    0,
    width,
    64,
    tag('rect', { x: 3, y: 4, width: 74, height: 52, rx: 6, fill: theme.body, stroke: theme.trim, 'stroke-width': 1.5 }),
    tag('rect', { x: 7, y: 8, width: 66, height: 44, rx: 3, fill: theme.window }),
    bars,
    buttons(g.fiveHour, FIVE_HOUR_COUNT, 23, 4, 90.5, 9.1, theme),
    buttons(g.week, WEEK_COUNT, 43, 2.8, 89.3, 6.3, theme),
  )
}

const glyphs = (lit: number, count: number, on: string, off: string) => on.repeat(lit) + off.repeat(count - lit)

export function meterRow(g: Gauges): string {
  const parts = [glyphs(litUnits(g.context, BAR_COUNT), BAR_COUNT, '▰', '▱')]
  if (g.fiveHour !== null) parts.push(glyphs(litUnits(g.fiveHour, FIVE_HOUR_COUNT), FIVE_HOUR_COUNT, '●', '○'))
  if (g.week !== null) parts.push(glyphs(litUnits(g.week, WEEK_COUNT), WEEK_COUNT, '●', '○'))
  return parts.join(' ')
}

export function meterAlt(g: Gauges): string {
  const parts = [g.context === null ? 'Context not measured yet' : `Context ${g.context}% full`]
  if (g.fiveHour !== null) parts.push(`5-hour limit ${g.fiveHour}% used`)
  if (g.week !== null) parts.push(`weekly limit ${g.week}% used`)
  return parts.join(', ')
}

export function meterReadings(g: Gauges): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (g.context !== null) rows.push({ label: 'Context window', value: `${g.context}%` })
  if (g.fiveHour !== null) rows.push({ label: '5-hour limit', value: `${g.fiveHour}%` })
  if (g.week !== null) rows.push({ label: 'Weekly limit', value: `${g.week}%` })
  return rows
}
