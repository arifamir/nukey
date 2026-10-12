import { describe, expect, test } from 'claude-code/testing'

import type { Gauges } from '../../types'
import { THEMES, THEME_NAMES } from '../themes'
import { drawPanel, panelAlt, panelReadings, panelRow, panelWidth } from './index'

const RED = '#E5534B'
const YELLOW = '#F2C14E'
const NONE: Gauges = { context: null, fiveHour: null, week: null }
const gauges = (context: number | null, fiveHour: number | null = null, week: number | null = null): Gauges => ({
  context,
  fiveHour,
  week,
})

// The panel's power bars and buttons, read back from the SVG.
function parts(svg: string) {
  const bars = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="4.6"[^>]*>/g)].map(m => m[0])
  const big = [...svg.matchAll(/<circle [^>]*cy="23" r="4"[^>]*>/g)].map(m => m[0])
  const small = [...svg.matchAll(/<circle [^>]*cy="43" r="2.8"[^>]*>/g)].map(m => m[0])
  const fill = (tag: string): string => /fill="([^"]+)"/.exec(tag)?.[1] ?? ""
  return { bars: bars.map(fill), big: big.map(fill), small: small.map(fill), barTags: bars, buttonTags: [...big, ...small] }
}

const lit = (fills: string[], colour: string) => fills.filter(f => f === colour || f === RED).length

describe('meter units', () => {
  const TABLE: [number, number, number, number][] = [
    [0, 0, 0, 0],
    [5, 0, 0, 0],
    [6, 1, 0, 0],
    [10, 1, 1, 1],
    [20, 2, 1, 1],
    [25, 2, 1, 2],
    [50, 5, 3, 4],
    [85, 8, 4, 6],
    [90, 8, 5, 6],
    [95, 9, 5, 7],
    [100, 9, 5, 7],
    [140, 9, 5, 7],
    [-5, 0, 0, 0],
  ]

  test('lit units follow the table, in the SVG and the glyph row', () => {
    const theme = THEMES.classic
    for (const [reading, bars, five, seven] of TABLE) {
      const { bars: b, big, small } = parts(drawPanel(gauges(reading, reading, reading), theme))
      expect([lit(b, theme.accent), lit(big, YELLOW), lit(small, YELLOW)]).toEqual([bars, five, seven])
      const [row5, row7] = panelRow(gauges(reading, reading, reading)).split(' ').slice(1)
      expect(panelRow(gauges(reading)).split('').filter(c => c === '▰')).toHaveLength(bars)
      expect(row5!.split('').filter(c => c === '●')).toHaveLength(five)
      expect(row7!.split('').filter(c => c === '●')).toHaveLength(seven)
    }
  })

  test('units light from the left', () => {
    const { bars } = parts(drawPanel(gauges(50), THEMES.classic))
    expect(bars.slice(0, 5).every(f => f === THEMES.classic.accent)).toBe(true)
    expect(bars.slice(5).every(f => f === '#8C9199')).toBe(true)
  })

  test('no context reading leaves every bar unlit', () => {
    const { bars, barTags } = parts(drawPanel(NONE, THEMES.classic))
    expect(bars).toHaveLength(9)
    expect(bars.every(f => f === '#8C9199')).toBe(true)
    expect(barTags.every(t => t.includes('opacity="0.4"'))).toBe(true)
  })
})

describe('the red rule', () => {
  const reds = (fills: string[]) => fills.map((f, i) => (f === RED ? i : -1)).filter(i => i >= 0)

  test('at 90 only the last lit of the last two is red; at 95 both; at 85 none', () => {
    const at = (n: number) => parts(drawPanel(gauges(n, n, n), THEMES.classic))
    expect(reds(at(90).bars)).toEqual([7])
    expect(reds(at(95).bars)).toEqual([7, 8])
    expect(reds(at(85).bars)).toEqual([])
    expect(reds(at(90).big)).toEqual([3, 4])
    expect(reds(at(90).small)).toEqual([5])
    expect(reds(at(86).big)).toEqual([3])
    expect(reds(at(100).small)).toEqual([5, 6])
    expect(reds(at(140).bars)).toEqual([7, 8])
  })

  test('unlit units are never red, and the glyph row has no red', () => {
    expect(reds(parts(drawPanel(gauges(86, 86, 86), THEMES.classic)).bars)).toEqual([7])
    expect(panelRow(gauges(100, 100, 100))).toBe('▰▰▰▰▰▰▰▰▰ ●●●●● ●●●●●●●')
  })
})

describe('panel SVG', () => {
  test('is 80 wide without rate limits and 132 with either', () => {
    expect(panelWidth(NONE)).toBe(80)
    expect(panelWidth(gauges(50))).toBe(80)
    expect(panelWidth(gauges(null, 3))).toBe(132)
    expect(panelWidth(gauges(null, null, 3))).toBe(132)
    expect(drawPanel(gauges(50), THEMES.classic)).toContain('width="80" height="64" viewBox="0 0 80 64"')
    expect(drawPanel(gauges(50, 1, 1), THEMES.classic)).toContain('width="132" height="64" viewBox="0 0 132 64"')
    expect(drawPanel(NONE, THEMES.classic)).toContain('shape-rendering="geometricPrecision"')
  })

  test('leaves the buttons out without rate limits, and draws only the row that has a reading', () => {
    expect(drawPanel(gauges(50), THEMES.classic)).not.toContain('<circle')
    const onlyFive = parts(drawPanel(gauges(50, 40), THEMES.classic))
    expect([onlyFive.big.length, onlyFive.small.length]).toEqual([5, 0])
    const onlyWeek = parts(drawPanel(gauges(50, null, 40), THEMES.classic))
    expect([onlyWeek.big.length, onlyWeek.small.length]).toEqual([0, 7])
  })

  test('bars and buttons sit where the spec puts them', () => {
    const svg = drawPanel(gauges(100, 100, 100), THEMES.classic)
    const xs = [11, 17.8, 24.6, 31.4, 38.2, 45, 51.8, 58.6, 65.4]
    const ys = [40, 36.4, 32.8, 29.2, 25.6, 22, 18.4, 14.8, 11.2]
    const hs = [8, 11.6, 15.2, 18.8, 22.4, 26, 29.6, 33.2, 36.8]
    xs.forEach((x, b) =>
      expect(svg).toContain(`<rect x="${x}" y="${ys[b]}" width="4.6" height="${hs[b]}" rx="1.2"`),
    )
    for (const cx of [90.5, 99.6, 108.7, 117.8, 126.9]) expect(svg).toContain(`cx="${cx}" cy="23" r="4"`)
    for (const cx of [89.3, 95.6, 101.9, 108.2, 114.5, 120.8, 127.1]) expect(svg).toContain(`cx="${cx}" cy="43" r="2.8"`)
  })

  test('takes its colours from the theme', () => {
    for (const theme of THEME_NAMES.map(n => THEMES[n])) {
      const svg = drawPanel(gauges(50, 50, 50), theme)
      expect(svg).toContain(
        `<rect x="3" y="4" width="74" height="52" rx="6" fill="${theme.body}" stroke="${theme.trim}" stroke-width="1.5"/>`,
      )
      expect(svg).toContain(`<rect x="7" y="8" width="66" height="44" rx="3" fill="${theme.window}"/>`)
      expect(svg).toContain(`fill="${theme.accent}"`)
      const { buttonTags } = parts(svg)
      expect(buttonTags.every(t => t.includes(`stroke="${theme.trim}" stroke-width="0.8"`))).toBe(true)
    }
  })

  test('unlit buttons are grey at 0.6', () => {
    const { buttonTags } = parts(drawPanel(gauges(0, 0, 0), THEMES.classic))
    expect(buttonTags.every(t => t.includes('fill="#8C9199" opacity="0.6"'))).toBe(true)
  })
})

describe('glyph row, alt text and readings', () => {
  test('the glyph row examples', () => {
    expect(panelRow(gauges(0))).toBe('▱▱▱▱▱▱▱▱▱')
    expect(panelRow(NONE)).toBe('▱▱▱▱▱▱▱▱▱')
    expect(panelRow(gauges(50))).toBe('▰▰▰▰▰▱▱▱▱')
    expect(panelRow(gauges(100, 20, 100))).toBe('▰▰▰▰▰▰▰▰▰ ●○○○○ ●●●●●●●')
    expect(panelRow(gauges(140, -5, null))).toBe('▰▰▰▰▰▰▰▰▰ ○○○○○')
    expect(panelRow(gauges(10, null, 50))).toBe('▰▱▱▱▱▱▱▱▱ ●●●●○○○')
  })

  test('the alt text', () => {
    expect(panelAlt(NONE)).toBe('Context not measured yet')
    expect(panelAlt(gauges(42, 10, 3))).toBe('Context 42% full, 5-hour limit 10% used, weekly limit 3% used')
    expect(panelAlt(gauges(null, null, 7))).toBe('Context not measured yet, weekly limit 7% used')
    expect(panelAlt(gauges(0))).toBe('Context 0% full')
  })

  test('the readings, in order, only those that exist', () => {
    expect(panelReadings(NONE)).toEqual([])
    expect(panelReadings(gauges(42, 10, 3))).toEqual([
      { label: 'Context window', value: '42%' },
      { label: '5-hour limit', value: '10%' },
      { label: 'Weekly limit', value: '3%' },
    ])
    expect(panelReadings(gauges(null, 0, null))).toEqual([{ label: '5-hour limit', value: '0%' }])
  })
})
