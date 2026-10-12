// The meter's readings, from what the session measured. Pure: no `$`.
import type { Gauges } from '../types'

export const NO_GAUGES: Gauges = { context: null, fiveHour: null, week: null }

// What a measurement carries that the meter reads (`$.session.usage()` and `session.measure`).
export type Measurement = {
  context?: { percent?: number }
  rateLimits?: readonly { kind: string; percentUsed: number }[]
}

// Whole percents, halves rounded up.
const whole = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.floor(value + 0.5) : null

export function readGauges(measured: Measurement): Gauges {
  const limit = (kind: string) => measured.rateLimits?.find(rate => rate.kind === kind)?.percentUsed
  return {
    context: whole(measured.context?.percent),
    fiveHour: whole(limit('five_hour')),
    week: whole(limit('seven_day')),
  }
}

export const sameGauges = (a: Gauges, b: Gauges): boolean =>
  a.context === b.context && a.fiveHour === b.fiveHour && a.week === b.week
