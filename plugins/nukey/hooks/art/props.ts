// The 25 kitchen props, drawn in whole-scene coordinates (x 60 to 128, y 0 to 64).
// Their colours are fixed (mid tones with outlines) so they read on light and dark
// backgrounds alike; only the delegating helpers follow the theme.
import type { SceneId } from '../../types'
import type { Theme } from '../themes'
import { HELPER_POSE, placedNukey } from './nukey'
import { type Attrs, animate, animateTransform, group, list, num, tag } from './svg'

const C = {
  ink: '#4A4F5A',
  grey: '#8C9199',
  line: '#A8A29A',
  pale: '#C9CED6',
  frost: '#E8EEF4',
  paper: '#FFFDF7',
  paperEdge: '#8C7B6B',
  white: '#FFFFFF',
  red: '#E5534B',
  redDark: '#A8443E',
  orange: '#F0883E',
  yellow: '#F2C14E',
  gold: '#C9962E',
  green: '#3FA34D',
  greenDark: '#2E7D3A',
  mint: '#5DBB63',
  blue: '#4FA3E0',
  purple: '#9B7BD8',
  wood: '#B07A4A',
  woodDark: '#7A5233',
  slate: '#3A3F47',
  slateEdge: '#6B7280',
} as const

const FONT = "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Helvetica Neue', Arial, sans-serif"

const rect = (x: number, y: number, width: number, height: number, attrs: Attrs = {}, ...kids: string[]) =>
  tag('rect', { x, y, width, height, ...attrs }, ...kids)
const circle = (cx: number, cy: number, r: number, attrs: Attrs = {}, ...kids: string[]) =>
  tag('circle', { cx, cy, r, ...attrs }, ...kids)
const ellipse = (cx: number, cy: number, rx: number, ry: number, attrs: Attrs = {}, ...kids: string[]) =>
  tag('ellipse', { cx, cy, rx, ry, ...attrs }, ...kids)
const path = (d: string, attrs: Attrs = {}, ...kids: string[]) => tag('path', { d, ...attrs }, ...kids)
const text = (x: number, y: number, body: string, attrs: Attrs = {}, ...kids: string[]) =>
  tag('text', { x, y, 'font-family': FONT, 'font-weight': 700, ...attrs }, body, ...kids)
const at = (x: number, y: number, ...kids: string[]) => group({ transform: `translate(${num(x)} ${num(y)})` }, ...kids)

// Holds `off` outside [from, to] of a loop and `on` inside it (discrete steps).
function step(attr: string, from: number, to: number, off: number | string, on: number | string, dur: number) {
  return to >= 1
    ? animate(attr, [off, on], { dur, keyTimes: [0, from], discrete: true })
    : animate(attr, [off, on, off], { dur, keyTimes: [0, from, to], discrete: true })
}

// A width that grows from 0 to `w` during [from, to], holds, and clears at `clear`.
const grow = (w: number, from: number, to: number, dur: number, clear = 0.92) =>
  animate('width', [0, 0, w, w, 0], { dur, keyTimes: [0, from, to, clear, 1] })

// A four-point twinkle centred at (x, y), pulsing in size.
function sparkle(x: number, y: number, size: number, begin: number, dur = 1.2, color: string = C.yellow) {
  const d = 'M0 -5Q0.9 -0.9 5 0Q0.9 0.9 0 5Q-0.9 0.9 -5 0Q-0.9 -0.9 0 -5Z'
  return at(
    x,
    y,
    group(
      {},
      animateTransform('scale', [num(size * 0.55), num(size), num(size * 0.55)], { dur, begin, spline: true }),
      path(d, { fill: color, stroke: C.gold, 'stroke-width': 0.6 }),
    ),
  )
}

// ---------------------------------------------------------------------------

function idle(): string {
  const zs = [
    { x: 70, y: 54, size: 9, begin: 0 },
    { x: 80, y: 44, size: 12, begin: 0.5 },
    { x: 92, y: 32, size: 15, begin: 1 },
  ]
  return (
    group(
      {},
      animateTransform('rotate', ['-8 112 18', '6 112 18', '-8 112 18'], { dur: 4, spline: true }),
      path('M112 8A10 10 0 0 0 112 28A12.5 12.5 0 0 1 112 8Z', {
        fill: '#F5D06A',
        stroke: C.gold,
        'stroke-width': 1,
        'stroke-linejoin': 'round',
        transform: 'rotate(-25 112 18)',
      }),
    ) +
    sparkle(122, 34, 0.45, 0.3, 1.8) +
    sparkle(100, 10, 0.4, 1.1, 1.8) +
    zs
      .map(z =>
        group(
          {},
          animateTransform('translate', ['0 0', '3 -4', '0 0'], { dur: 3, begin: z.begin, spline: true }),
          text(
            z.x,
            z.y,
            'z',
            { 'font-size': z.size, fill: C.grey, opacity: 0.55 },
            animate('opacity', [0.55, 1, 0.55], { dur: 3, begin: z.begin }),
          ),
        ),
      )
      .join('')
  )
}

function thinking(): string {
  const puffs: [number, number, number][] = [
    [86, 25, 9],
    [98, 18, 11],
    [111, 22, 9],
    [116, 31, 7],
    [104, 34, 9],
    [90, 34, 8],
    [79, 31, 7],
  ]
  const outline = puffs.map(([x, y, r]) => circle(x, y, r, { fill: C.white, stroke: C.grey, 'stroke-width': 2.2 }))
  const fill = puffs.map(([x, y, r]) => circle(x, y, r, { fill: C.white }))
  const dur = 2.6
  const popcorn = group(
    {},
    animateTransform('scale', ['0', '0', '1.35', '1', '1', '0'], { dur, keyTimes: [0, 0.5, 0.58, 0.66, 0.92, 1] }),
    ...(
      [
        [-3.6, 1, 3.6],
        [3.6, 1, 3.6],
        [0, -2.8, 4],
        [0, 2.8, 3.2],
      ] as const
    ).map(([x, y, r]) => circle(x, y, r, { fill: '#FFF3CF', stroke: '#D9A441', 'stroke-width': 1 })),
    ...(
      [
        [-3.6, 1, 3.1],
        [3.6, 1, 3.1],
        [0, -2.8, 3.5],
      ] as const
    ).map(([x, y, r]) => circle(x, y, r, { fill: '#FFF3CF' })),
    ellipse(0, 5.2, 2.2, 1.2, { fill: '#E8A93A' }),
  )
  const kernel = group(
    {},
    animateTransform('rotate', ['0', '-14', '14', '-14', '14', '0', '0'], {
      dur,
      keyTimes: [0, 0.2, 0.28, 0.36, 0.44, 0.5, 1],
    }),
    path('M0 -5.6Q4.8 -1.3 3.2 3.7Q0 6.1 -3.2 3.7Q-4.8 -1.3 0 -5.6Z', {
      fill: '#E8A93A',
      stroke: '#B5781F',
      'stroke-width': 0.9,
    }),
    ellipse(-1.1, -1.3, 1, 1.8, { fill: '#FFE3A3' }),
    step('opacity', 0.5, 0.97, 1, 0, dur),
  )
  const burst = group(
    { opacity: 0 },
    step('opacity', 0.5, 0.64, 0, 1, dur),
    path('M-9 -6L-6.5 -4.2M9 -6L6.5 -4.2M-10 2H-7.5M10 2H7.5M0 -11V-8.5', {
      stroke: C.orange,
      'stroke-width': 1.4,
      'stroke-linecap': 'round',
    }),
  )
  return (
    circle(66, 53, 1.8, { fill: C.white, stroke: C.grey, 'stroke-width': 1.4 }) +
    circle(71.5, 45.5, 3, { fill: C.white, stroke: C.grey, 'stroke-width': 1.6 }) +
    outline.join('') +
    fill.join('') +
    at(98, 26, kernel, popcorn, burst)
  )
}

function reading(): string {
  const lines = [30, 24, 31, 19]
  return (
    rect(68, 9, 52, 46, { rx: 3, fill: C.paper, stroke: C.paperEdge, 'stroke-width': 1.2 }) +
    path('M68.6 16V12Q68.6 9.6 71 9.6H117Q119.4 9.6 119.4 12V16Z', { fill: C.red }) +
    [74, 84, 94, 104, 114].map(x => rect(x - 2, 11.3, 3.4, 3.4, { fill: C.white, opacity: 0.55 })).join('') +
    rect(74, 20, 28, 2.6, { rx: 1.3, fill: '#6B5E52' }) +
    lines
      .map(
        (w, i) =>
          circle(76, 29 + 6.5 * i, 1.3, { fill: C.red }) + rect(80, 28 + 6.5 * i, w, 2, { rx: 1, fill: C.line }),
      )
      .join('') +
    rect(72.5, 26, 43, 6, { rx: 2, fill: C.yellow, opacity: 0.5 }, animate('y', [26, 45.5, 26], { dur: 3, spline: true }))
  )
}

function coding(): string {
  const rows = [
    { x: 73, w: 22, color: '#C792EA' },
    { x: 77, w: 27, color: '#82AAFF' },
    { x: 81, w: 18, color: '#C3E88D' },
    { x: 77, w: 30, color: '#FFCB6B' },
    { x: 73, w: 13, color: '#F07178' },
  ]
  const dur = 3.6
  return (
    path('M86 50L81 58M102 50L107 58', { stroke: C.grey, 'stroke-width': 2.6, 'stroke-linecap': 'round' }) +
    rect(65, 8, 58, 43, { rx: 5, fill: C.slate, stroke: C.slateEdge, 'stroke-width': 1 }) +
    rect(68.5, 11.5, 51, 36, { rx: 2, fill: '#1D2027' }) +
    [
      [73, '#E5534B'],
      [77.5, '#F2C14E'],
      [82, '#5DBB63'],
    ]
      .map(([x, fill]) => circle(x as number, 15.5, 1.4, { fill: fill as string }))
      .join('') +
    text(115.5, 17.6, '&lt;/&gt;', { 'font-size': 6, fill: C.grey, 'text-anchor': 'end' }) +
    rows
      .map((r, i) => {
        const from = 0.04 + i * 0.15
        return rect(r.x, 21.5 + 5 * i, 0, 2.6, { rx: 1.3, fill: r.color }, grow(r.w, from, from + 0.12, dur))
      })
      .join('') +
    rect(73, 21, 1.6, 3.6, { fill: C.white }, animate('opacity', [1, 0, 1], { dur: 0.8, discrete: true, keyTimes: [0, 0.5, 1] }), cursorPath(rows, dur))
  )
}

// The coding cursor follows the end of the line being typed.
function cursorPath(rows: { x: number; w: number }[], dur: number): string {
  const keyTimes: number[] = [0]
  const xs: number[] = [rows[0]!.x]
  const ys: number[] = [21]
  rows.forEach((r, i) => {
    const from = 0.04 + i * 0.15
    keyTimes.push(from, from + 0.12)
    xs.push(r.x, r.x + r.w + 1)
    ys.push(21 + 5 * i, 21 + 5 * i)
  })
  keyTimes.push(0.92, 1)
  xs.push(xs[xs.length - 1]!, rows[0]!.x)
  ys.push(ys[ys.length - 1]!, 21)
  return (
    tag('animate', { attributeName: 'x', values: list(xs), keyTimes: list(keyTimes), dur: `${dur}s`, repeatCount: 'indefinite' }) +
    tag('animate', {
      attributeName: 'y',
      values: list(ys),
      keyTimes: list(keyTimes),
      dur: `${dur}s`,
      repeatCount: 'indefinite',
      calcMode: 'discrete',
    })
  )
}

function pencil(): string {
  return group(
    { transform: 'rotate(-40)' },
    tag('polygon', { points: '0,0 5.5,-2.3 5.5,2.3', fill: '#EBCB9E' }),
    tag('polygon', { points: '0,0 2,-0.85 2,0.85', fill: C.ink }),
    rect(5.5, -2.3, 15, 4.6, { fill: C.yellow, stroke: '#B58A1E', 'stroke-width': 0.6 }),
    rect(20.5, -2.3, 2, 4.6, { fill: C.pale }),
    rect(22.5, -2.3, 3.5, 4.6, { rx: 1.2, fill: '#F4A6B7' }),
  )
}

function writing(): string {
  const x0 = 77
  const ys = [24, 31, 38, 45]
  const ws = [28, 23, 29, 17]
  const dur = 4
  const starts = ys.map((_, i) => 0.04 + 0.2 * i)
  const keyTimes = [0]
  const moves = [`${x0} ${ys[0]! - 0.8}`]
  ys.forEach((y, i) => {
    keyTimes.push(starts[i]!, starts[i]! + 0.16)
    moves.push(`${x0} ${y - 0.8}`, `${x0 + ws[i]!} ${y - 0.8}`)
  })
  keyTimes.push(1)
  moves.push(moves[0]!)
  return (
    rect(72, 11, 41, 45, { rx: 2, fill: C.paper, stroke: C.paperEdge, 'stroke-width': 1.2 }) +
    rect(72, 8, 41, 8, { rx: 2, fill: C.red, stroke: C.redDark, 'stroke-width': 1 }) +
    [78, 86, 94, 102, 110].map(x => circle(x - 0.5, 12, 1.3, { fill: C.redDark })).join('') +
    ys
      .map((y, i) =>
        rect(x0, y - 0.8, 0, 1.6, { rx: 0.8, fill: '#5E6470' }, grow(ws[i]!, starts[i]!, starts[i]! + 0.16, dur, 0.94)),
      )
      .join('') +
    group({}, tag('animateTransform', { attributeName: 'transform', type: 'translate', values: moves.join(';'), keyTimes: list(keyTimes), dur: `${dur}s`, repeatCount: 'indefinite' }), pencil())
  )
}

// A looping line of icing: a prolate cycloid along the cake's top, as a path and its length.
function icingSwirl(): { d: string; length: number } {
  const a = 1.05
  const b = 2.7
  const turns = 6
  const points: [number, number][] = []
  const steps = 240
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * 2 * Math.PI
    points.push([74 + a * t - b * Math.sin(t), 33 - b * (1 - Math.cos(t))])
  }
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1])
  }
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`).join('')
  return { d, length: Math.ceil(length) }
}

function designing(): string {
  const { d, length } = icingSwirl()
  const dur = 5
  const bag = group(
    {},
    tag('animateMotion', {
      path: d,
      dur: `${dur}s`,
      repeatCount: 'indefinite',
      keyPoints: '0;1;1',
      keyTimes: '0;0.75;1',
      calcMode: 'linear',
    }),
    group(
      { transform: 'rotate(24)' },
      path('M-1.8 -3.5L-7.5 -18Q0 -22.5 7.5 -18L1.8 -3.5Z', {
        fill: C.white,
        stroke: C.grey,
        'stroke-width': 1,
        'stroke-linejoin': 'round',
      }),
      path('M-1.6 -5L-5 -15Q0 -17 5 -15L1.6 -5Z', { fill: '#F7B9CD', opacity: 0.8 }),
      rect(-2.6, -22.5, 5.2, 2.6, { rx: 1, fill: '#E87DA0' }),
      tag('polygon', { points: '-1.8,-3.5 1.8,-3.5 0.6,0 -0.6,0', fill: C.pale, stroke: C.ink, 'stroke-width': 0.5 }),
    ),
  )
  return (
    ellipse(94, 55.5, 28, 3, { fill: C.frost, stroke: C.grey, 'stroke-width': 1 }) +
    rect(72, 36, 44, 18, { rx: 2, fill: '#F6D7A7', stroke: C.wood, 'stroke-width': 1 }) +
    rect(72.5, 45, 43, 2.6, { fill: C.red, opacity: 0.85 }) +
    rect(71, 33, 46, 6, { rx: 3, fill: '#FFF0F5', stroke: '#E87DA0', 'stroke-width': 1 }) +
    [
      [78, 39.5, 2, 2.6],
      [89, 40, 1.7, 3.2],
      [101, 39.5, 2, 2.6],
      [111, 39.8, 1.6, 2.4],
    ]
      .map(([x, y, rx, ry]) => ellipse(x!, y!, rx!, ry!, { fill: '#FFF0F5' }))
      .join('') +
    path(d, {
      fill: 'none',
      stroke: '#E87DA0',
      'stroke-width': 1.7,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-dasharray': length,
      'stroke-dashoffset': length,
    }, animate('stroke-dashoffset', [length, 0, 0], { dur, keyTimes: [0, 0.75, 1] })) +
    group(
      { opacity: 0 },
      step('opacity', 0.78, 0.98, 0, 1, dur),
      path('M94 25Q95 20 98.5 18.5', { fill: 'none', stroke: C.greenDark, 'stroke-width': 1, 'stroke-linecap': 'round' }),
      circle(94, 26, 2.8, { fill: C.red, stroke: C.redDark, 'stroke-width': 0.7 }),
      circle(93, 25, 0.8, { fill: C.white, opacity: 0.8 }),
    ) +
    bag
  )
}

function terminal(): string {
  return (
    rect(65, 11, 58, 42, { rx: 5, fill: C.slate, stroke: C.slateEdge, 'stroke-width': 1 }) +
    rect(69, 15, 50, 23, { rx: 2, fill: '#0F1A14' }) +
    text(72, 25.6, '&gt;', { 'font-size': 8, fill: '#5CD67A', 'font-family': 'ui-monospace, Menlo, monospace' }) +
    rect(79, 21.4, 22, 2.2, { rx: 1.1, fill: C.grey }) +
    rect(103, 20, 3, 5, { fill: '#5CD67A' }, animate('opacity', [1, 0], { dur: 0.9, keyTimes: [0, 0.5], discrete: true })) +
    rect(72, 29.5, 44, 4.5, { rx: 2.25, fill: '#24382B' }) +
    rect(72, 29.5, 0, 4.5, { rx: 2.25, fill: '#5CD67A' }, animate('width', [0, 44, 44], { dur: 2.6, keyTimes: [0, 0.85, 1] })) +
    [79, 109]
      .map(x =>
        group(
          {},
          circle(x, 45.5, 4, { fill: C.pale, stroke: C.grey, 'stroke-width': 1 }),
          tag('line', { x1: x, y1: 45.5, x2: x, y2: 42.3, stroke: C.ink, 'stroke-width': 1.3, 'stroke-linecap': 'round' }, x === 79 ? animateTransform('rotate', ['-40 79 45.5', '40 79 45.5', '-40 79 45.5'], { dur: 2.6, spline: true }) : ''),
        ),
      )
      .join('') +
    rect(88, 44, 12, 3, { rx: 1.5, fill: '#24382B' }) +
    circle(94, 45.5, 1.1, { fill: '#5CD67A' }, animate('opacity', [1, 0.3, 1], { dur: 1.3 }))
  )
}

function searching(): string {
  const jar = (cx: number, base: number, color: string) =>
    group(
      {},
      rect(cx - 4.5, base - 13, 9, 13, { rx: 2, fill: '#F4F6F8', stroke: C.grey, 'stroke-width': 0.9 }),
      rect(cx - 3.5, base - 8.5, 7, 7.5, { rx: 1.2, fill: color }),
      rect(cx - 5, base - 15.5, 10, 3.2, { rx: 1, fill: C.ink }),
    )
  const shelf = (y: number) => rect(64, y, 60, 3.2, { rx: 1, fill: C.wood, stroke: C.woodDark, 'stroke-width': 0.8 })
  return (
    rect(65, 10, 3, 49, { rx: 1, fill: C.wood, stroke: C.woodDark, 'stroke-width': 0.8 }) +
    rect(120, 10, 3, 49, { rx: 1, fill: C.wood, stroke: C.woodDark, 'stroke-width': 0.8 }) +
    [
      [75, '#D9534F'],
      [87, C.yellow],
      [99, '#6DBA5A'],
      [111, '#A0603A'],
    ]
      .map(([x, c]) => jar(x as number, 33, c as string))
      .join('') +
    [
      [75, C.orange],
      [87, '#EADFC4'],
      [99, C.purple],
      [111, '#C0392B'],
    ]
      .map(([x, c]) => jar(x as number, 55, c as string))
      .join('') +
    shelf(33) +
    shelf(55) +
    group(
      {},
      animateTransform('translate', ['0 0', '22 -2', '30 18', '6 20', '0 0'], { dur: 4, spline: true }),
      tag('line', { x1: 86, y1: 32, x2: 93, y2: 39, stroke: C.woodDark, 'stroke-width': 3.6, 'stroke-linecap': 'round' }),
      circle(80, 26, 8, { fill: '#DDEFFF', 'fill-opacity': 0.35, stroke: '#5A6270', 'stroke-width': 2.6 }),
      path('M75.5 23A5.5 5.5 0 0 1 80 20.5', { fill: 'none', stroke: C.white, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.9 }),
    )
  )
}

function web(): string {
  return (
    path('M89 48L85 57H105L101 48Z', { fill: C.pale, stroke: C.slateEdge, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }) +
    rect(66, 8, 56, 41, { rx: 4, fill: C.slate, stroke: C.slateEdge, 'stroke-width': 1 }) +
    rect(69.5, 11.5, 49, 34, { rx: 1.5, fill: C.white }) +
    rect(72, 13.8, 44, 5.4, { rx: 2.7, fill: '#E3E7EC' }) +
    circle(75.2, 16.5, 1.7, { fill: 'none', stroke: C.blue, 'stroke-width': 0.8 }) +
    rect(79, 15.8, 22, 1.4, { rx: 0.7, fill: '#B5BCC5' }) +
    rect(69.5, 20.4, 0, 1.6, { fill: C.blue }, animate('width', [0, 49, 49], { dur: 1.8, keyTimes: [0, 0.8, 1] })) +
    rect(72, 24, 18, 14, { rx: 1, fill: '#BFE3F7' }) +
    path('M72 38L78 30.5L82.5 35L85.5 32L90 38Z', { fill: '#6DBA5A' }) +
    circle(86, 27.5, 1.8, { fill: C.yellow }) +
    [25, 29, 33, 37].map((y, i) => rect(93, y, [22, 18, 21, 14][i]!, 1.8, { rx: 0.9, fill: '#C4C9D0' })).join('') +
    rect(72, 41, 30, 1.8, { rx: 0.9, fill: '#C4C9D0' }) +
    at(
      100,
      30,
      group(
        {},
        animateTransform('translate', ['0 0', '-14 -4', '-6 8', '8 4', '0 0'], { dur: 3, spline: true }),
        path('M0 0V9.5L2.5 7.2L4.4 11L6.1 10.2L4.2 6.5L7.6 6.3Z', {
          fill: C.white,
          stroke: '#2B2F38',
          'stroke-width': 0.9,
          'stroke-linejoin': 'round',
        }),
      ),
    )
  )
}

const HELPERS = [
  { x: 66, y: 40, delay: 0 },
  { x: 96, y: 40, delay: 0.35 },
  { x: 81, y: 18, delay: 0.2 },
]

function delegating(theme: Theme): string {
  return HELPERS.map(h => placedNukey(HELPER_POSE, theme, h.x, h.y, 0.5, h.delay)).join('')
}

const BUBBLE = 'M77 10H113Q122 10 122 19V32Q122 41 113 41H84L65 51L74 41H77Q68 41 68 32V19Q68 10 77 10Z'

const bubble = () =>
  path(BUBBLE, { fill: C.white, stroke: C.grey, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })

function talking(): string {
  const dur = 3.2
  return (
    bubble() +
    [38, 30, 21]
      .map((w, i) => {
        const from = 0.05 + 0.25 * i
        return rect(76, 18 + 7 * i, 0, 2.8, { rx: 1.4, fill: '#9AA0A8' }, grow(w, from, from + 0.18, dur))
      })
      .join('')
  )
}

function asking(): string {
  return (
    bubble() +
    at(
      95,
      25.5,
      group(
        {},
        animateTransform('scale', ['1', '1.2', '1'], { dur: 1.4, spline: true }),
        text(0, 8.6, '?', { 'font-size': 24, fill: C.orange, 'text-anchor': 'middle', stroke: '#C2621F', 'stroke-width': 0.6 }),
      ),
    )
  )
}

function planning(): string {
  const dur = 4
  const rows = [21, 30, 39, 48]
  const widths = [20, 15, 22, 13]
  const dots = [C.red, C.yellow, C.mint, C.orange]
  return (
    rect(72, 9, 44, 49, { rx: 3, fill: '#C08A5A', stroke: '#8A5A36', 'stroke-width': 1 }) +
    rect(75.5, 14, 37, 41, { rx: 1.5, fill: C.paper }) +
    rect(86, 6, 16, 7, { rx: 2, fill: C.pale, stroke: C.slateEdge, 'stroke-width': 0.9 }) +
    rows
      .map((y, i) => {
        const from = 0.12 + 0.18 * i
        return (
          rect(78.5, y - 3, 6, 6, { rx: 1.2, fill: C.white, stroke: C.grey, 'stroke-width': 1 }) +
          rect(87.5, y - 1, widths[i]!, 2, { rx: 1, fill: C.line }) +
          circle(87.5 + widths[i]! + 3.5, y, 1.4, { fill: dots[i]! }) +
          path(`M79.6 ${num(y - 0.2)}L81.3 ${num(y + 1.7)}L85.6 ${num(y - 3.4)}`, {
            fill: 'none',
            stroke: C.green,
            'stroke-width': 2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            opacity: 0,
          }, step('opacity', from, 0.94, 0, 1, dur))
        )
      })
      .join('')
  )
}

function tool(): string {
  const wires = [0, 0.15, 0.3, 0.45]
  return (
    group(
      {},
      animateTransform('rotate', ['-8 84 56', '8 84 56', '-8 84 56'], { dur: 1.2, spline: true }),
      rect(82, 38, 4, 18, { rx: 2, fill: C.red, stroke: C.redDark, 'stroke-width': 0.8 }),
      ...wires.map(begin =>
        ellipse(84, 24, 9, 14.5, { fill: 'none', stroke: '#8C9199', 'stroke-width': 1.3 }, animate('rx', [9, 1, 9], { dur: 0.6, begin })),
      ),
      tag('line', { x1: 84, y1: 9.5, x2: 84, y2: 38.5, stroke: '#8C9199', 'stroke-width': 1.3 }),
    ) +
    [
      'M70 18Q67 24 70 30',
      'M98 18Q101 24 98 30',
    ]
      .map((d, i) => path(d, { fill: 'none', stroke: C.grey, 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0.6 }, animate('opacity', [0.1, 0.7, 0.1], { dur: 0.6, begin: i * 0.3 })))
      .join('') +
    group(
      {},
      animateTransform('rotate', ['10 111 56', '4 111 56', '10 111 56'], { dur: 1.6, spline: true }),
      rect(109.2, 35, 3.6, 21, { rx: 1.6, fill: C.woodDark }),
      rect(110, 27, 2, 9, { fill: '#9AA0A8' }),
      rect(104, 10, 14, 18, { rx: 2.6, fill: C.pale, stroke: C.slateEdge, 'stroke-width': 0.9 }),
      path('M107.5 13.5V24.5M111 13.5V24.5M114.5 13.5V24.5', { stroke: '#8C9199', 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
    )
  )
}

function done(): string {
  // The badge pops in once and then stays.
  const pop = tag('animateTransform', {
    attributeName: 'transform',
    type: 'scale',
    values: '0.6;1.25;1',
    keyTimes: '0;0.6;1',
    dur: '0.45s',
    fill: 'freeze',
  })
  return (
    sparkle(71, 13, 1, 0, 1.2) +
    sparkle(119, 15, 0.8, 0.4, 1.2) +
    sparkle(116, 53, 0.9, 0.8, 1.2) +
    at(
      94,
      33,
      group(
        {},
        pop,
        rect(-23, -10, 46, 20, { rx: 10, fill: C.green, stroke: C.greenDark, 'stroke-width': 1.2 }),
        text(0, 4, 'DING!', { 'font-size': 11, fill: C.white, 'text-anchor': 'middle', 'letter-spacing': 0.4 }),
      ),
    )
  )
}

function permission(): string {
  return (
    circle(94, 6, 2, { fill: C.slateEdge }) +
    group(
      {},
      animateTransform('rotate', ['-9 94 6', '9 94 6', '-9 94 6'], { dur: 1.8, spline: true }),
      path('M81 23.5L94 6L107 23.5', { fill: 'none', stroke: C.paperEdge, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
      rect(75, 21, 38, 23, { rx: 3, fill: C.yellow, stroke: '#B58A1E', 'stroke-width': 1.4 }),
      circle(81, 23.8, 1.2, { fill: '#B58A1E' }),
      circle(107, 23.8, 1.2, { fill: '#B58A1E' }),
      text(94, 37.5, 'OK?', { 'font-size': 12, fill: '#4A3A12', 'text-anchor': 'middle' }),
    )
  )
}

function compacting(): string {
  const bubbles = [
    [77, 3, 0],
    [90, 2.2, 0.45],
    [104, 3.4, 0.9],
    [114, 2, 1.3],
    [84, 2.6, 1.7],
  ] as const
  return (
    ellipse(94, 48, 29, 8.5, { fill: C.frost, stroke: C.grey, 'stroke-width': 1.2 }) +
    ellipse(94, 48, 19, 5, { fill: 'none', stroke: C.pale, 'stroke-width': 1 }) +
    ellipse(101, 49, 6, 2, { fill: '#C8A27A' }, animate('opacity', [0.8, 0.8, 0, 0], { dur: 2.2, keyTimes: [0, 0.2, 0.7, 1] })) +
    group(
      {},
      animateTransform('translate', ['-10 0', '10 0', '-10 0'], { dur: 1, spline: true }),
      rect(82, 34, 24, 10, { rx: 2.5, fill: C.yellow, stroke: '#B58A1E', 'stroke-width': 1 }),
      rect(82, 30, 24, 5.5, { rx: 2, fill: '#4CB860', stroke: C.greenDark, 'stroke-width': 1 }),
      ...[
        [86, 38.5],
        [92, 40.5],
        [98, 38],
        [103, 40.5],
      ].map(([x, y]) => circle(x!, y!, 0.9, { fill: '#D9A441' })),
    ) +
    bubbles
      .map(([x, r, begin]) =>
        circle(x, 36, r, { fill: C.white, 'fill-opacity': 0.55, stroke: '#7FB8E0', 'stroke-width': 1, opacity: 0 },
          animate('cy', [36, 6], { dur: 2.2, begin }),
          animate('opacity', [0, 1, 0], { dur: 2.2, begin }),
        ),
      )
      .join('')
  )
}

function error(): string {
  const puffs = [
    [88, 0],
    [98, 0.8],
    [106, 1.6],
  ] as const
  return (
    puffs
      .map(([x, begin]) =>
        circle(x, 18, 2, { fill: '#9AA0A8', opacity: 0 },
          animate('cy', [18, 2], { dur: 2.4, begin }),
          animate('r', [2, 6], { dur: 2.4, begin }),
          animate('opacity', [0, 0.85, 0], { dur: 2.4, begin }),
        ),
      )
      .join('') +
    path('M78 56V37Q70.5 35 71.5 28Q72.5 19.5 82 20.5Q94 13 106 20.5Q115.5 19.5 116.5 28Q117.5 35 110 37V56Z', {
      fill: '#9A6638',
      stroke: '#5A3A22',
      'stroke-width': 1.2,
      'stroke-linejoin': 'round',
    }) +
    path('M81.5 53V35.5Q75.5 33.5 76 28.5Q77 23.5 84 24Q94 18 104 24Q111 23.5 112 28.5Q112.5 33.5 106.5 35.5V53Z', {
      fill: '#4A3020',
    }) +
    ellipse(86, 46, 3.5, 2.2, { fill: '#2B1B12' }) +
    ellipse(104, 30, 3, 2, { fill: '#2B1B12' }) +
    path('M86 32.5L90 36.5M90 32.5L86 36.5M98 32.5L102 36.5M102 32.5L98 36.5', {
      stroke: '#F3D9B1',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
    }) +
    path('M87 44Q90 41.5 93 44Q96 46.5 99 44Q100.5 43 101.5 43.5', {
      fill: 'none',
      stroke: '#F3D9B1',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
    }) +
    at(117, 49, group({},
      animateTransform('scale', ['1', '1.18', '1'], { dur: 0.8, spline: true }),
      circle(0, 0, 6, { fill: C.red, stroke: C.redDark, 'stroke-width': 1 }),
      rect(-0.9, -3.8, 1.8, 4.6, { rx: 0.9, fill: C.white }),
      circle(0, 2.6, 1, { fill: C.white }),
    ))
  )
}

function waiting(): string {
  const dur = 4
  const flow = { dur, keyTimes: [0, 0.78, 1] }
  return group(
    {},
    animateTransform('rotate', ['0 94 32', '0 94 32', '180 94 32'], { dur, keyTimes: [0, 0.8, 1] }),
    rect(82.5, 12, 2.2, 40, { fill: C.wood }),
    rect(103.3, 12, 2.2, 40, { fill: C.wood }),
    path('M85 13H103C103 22 97 27 95.2 32C97 37 103 42 103 51H85C85 42 91 37 92.8 32C91 27 85 22 85 13Z', {
      fill: '#EAF4FB',
      'fill-opacity': 0.75,
      stroke: '#8CB4D0',
      'stroke-width': 1.2,
    }),
    tag('polygon', { points: '86.8,16 101.2,16 94,30', fill: C.yellow },
      animate('points', ['86.8,16 101.2,16 94,30', '93.6,29.2 94.4,29.2 94,30', '93.6,29.2 94.4,29.2 94,30'], flow),
    ),
    tag('polygon', { points: '86,50 91,50 97,50 102,50', fill: C.yellow },
      animate('points', ['86,50 91,50 97,50 102,50', '86,50 90,41.5 98,41.5 102,50', '86,50 90,41.5 98,41.5 102,50'], flow),
    ),
    tag('line', { x1: 94, y1: 30, x2: 94, y2: 50, stroke: '#E0A93A', 'stroke-width': 0.9, 'stroke-dasharray': '1.5 1.5' },
      animate('stroke-dashoffset', [0, -3], { dur: 0.3 }),
      step('opacity', 0.78, 0.99, 1, 0, dur),
    ),
    rect(80, 9, 28, 4, { rx: 1.5, fill: C.wood, stroke: C.woodDark, 'stroke-width': 0.8 }),
    rect(80, 51, 28, 4, { rx: 1.5, fill: C.wood, stroke: C.woodDark, 'stroke-width': 0.8 }),
  )
}

function testing(): string {
  const dur = 3.6
  const grey = { wrap: '#A9AEB5', top: '#D5D9DE' }
  const green = { wrap: C.mint, top: '#BDEBC2' }
  return [75, 94, 113]
    .map((cx, i) => {
      const from = 0.15 + 0.22 * i
      const swap = (a: string, b: string) => animate('fill', [a, b, a], { dur, keyTimes: [0, from, 0.92], discrete: true })
      return (
        path(`M${cx - 7} 43H${cx + 7}L${cx + 5} 55H${cx - 5}Z`, { fill: grey.wrap, stroke: C.ink, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, swap(grey.wrap, green.wrap)) +
        path(`M${cx - 3.5} 44.5L${cx - 2.6} 54M${cx} 44.5V54M${cx + 3.5} 44.5L${cx + 2.6} 54`, { stroke: C.white, 'stroke-width': 0.8, opacity: 0.6 }) +
        path(`M${cx - 8} 43.5Q${cx - 8.5} 36.5 ${cx - 3} 35.5Q${cx} 29.5 ${cx + 3} 35.5Q${cx + 8.5} 36.5 ${cx + 8} 43.5Z`, { fill: grey.top, stroke: C.ink, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, swap(grey.top, green.top)) +
        group(
          { opacity: 0 },
          step('opacity', from, 0.92, 0, 1, dur),
          circle(cx, 22, 5, { fill: C.green, stroke: C.greenDark, 'stroke-width': 0.9 }),
          path(`M${cx - 2.4} 22.2L${cx - 0.6} 24L${cx + 2.6} 20.3`, { fill: 'none', stroke: C.white, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        )
      )
    })
    .join('')
}

function plate(y: number, stripe: string): string {
  return (
    rect(72, y, 40, 4.2, { rx: 2.1, fill: C.white, stroke: C.grey, 'stroke-width': 1.1 }) +
    rect(75, y + 1.6, 34, 1, { rx: 0.5, fill: stripe }) +
    circle(92, y + 2.1, 1.5, { fill: stripe, stroke: C.white, 'stroke-width': 0.6 })
  )
}

function git(): string {
  const dur = 2.8
  return (
    ellipse(92, 56.5, 23, 1.8, { fill: '#000', opacity: 0.12 }) +
    [51, 46.5, 42, 37.5].map(y => plate(y, C.blue)).join('') +
    group(
      { opacity: 0 },
      tag('animateTransform', { attributeName: 'transform', type: 'translate', values: '30 -18;0 0;0 0;0 0', keyTimes: '0;0.45;0.85;1', dur: `${dur}s`, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '0.3 0 0.4 1;0 0 1 1;0 0 1 1' }),
      animate('opacity', [0, 1, 1, 0], { dur, keyTimes: [0, 0.15, 0.85, 1] }),
      plate(33, C.purple),
    )
  )
}

function installing(): string {
  const dur = 3
  const drop = (from: number, to: number, kid: string) =>
    group(
      { opacity: 0 },
      tag('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 -26;0 -26;0 6;0 6', keyTimes: list([0, from, to, 1]), dur: `${dur}s`, repeatCount: 'indefinite' }),
      step('opacity', from, to, 0, 1, dur),
      kid,
    )
  return (
    tag('polygon', { points: '75,24 113,24 112,56 76,56', fill: '#8E6640' }) +
    group({ transform: 'rotate(22 104 22)' },
      rect(99, 6, 8, 26, { rx: 4, fill: '#E3B26E', stroke: '#A8763A', 'stroke-width': 0.9 }),
      path('M100.5 11L105.5 13M100.5 17L105.5 19', { stroke: '#A8763A', 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    ) +
    circle(80, 24, 4, { fill: '#6DBA5A', stroke: C.greenDark, 'stroke-width': 0.8 }) +
    circle(85, 22.5, 3.6, { fill: '#5DAE4D', stroke: C.greenDark, 'stroke-width': 0.8 }) +
    drop(0.05, 0.38, group({},
      circle(90, 25, 4.4, { fill: C.red, stroke: C.redDark, 'stroke-width': 0.8 }),
      path('M90 20.8Q92.5 18 94.5 19.5Q92.5 21.5 90 20.8Z', { fill: C.mint }),
    )) +
    drop(0.45, 0.78, group({},
      path('M93 21L99 21L96 35Z', { fill: C.orange, stroke: '#C2621F', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }),
      path('M94 21L93 17M96 21V16.5M98 21L99 17', { stroke: C.green, 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
    )) +
    tag('polygon', { points: '72,28 116,28 113,57 75,57', fill: '#C99A63', stroke: '#8A6238', 'stroke-width': 1, 'stroke-linejoin': 'round' }) +
    path('M72.4 28H115.6L115.2 32H72.8Z', { fill: '#B58552' }) +
    path('M86 41Q94 45 102 41', { fill: 'none', stroke: '#8A6238', 'stroke-width': 1.2, 'stroke-linecap': 'round' })
  )
}

function star(r: number, inner: number): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${num(radius * Math.cos(angle))},${num(radius * Math.sin(angle))}`)
  }
  return points.join(' ')
}

function skill(): string {
  return (
    tag('polygon', { points: '83,3 91,3 99,25 91,25', fill: C.blue, stroke: '#2F78B0', 'stroke-width': 0.8 }) +
    tag('polygon', { points: '105,3 97,3 89,25 97,25', fill: C.red, stroke: C.redDark, 'stroke-width': 0.8 }) +
    at(94, 37, group({},
      animateTransform('scale', ['1', '1.1', '1'], { dur: 1.4, spline: true }),
      circle(0, 0, 14, { fill: C.yellow, stroke: C.gold, 'stroke-width': 1.5 }),
      circle(0, 0, 10.5, { fill: 'none', stroke: '#E0A93A', 'stroke-width': 1 }),
      tag('polygon', { points: star(7.8, 3.3), fill: C.white, stroke: C.gold, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }),
    )) +
    sparkle(72, 22, 0.8, 0, 1.4) +
    sparkle(117, 47, 0.9, 0.7, 1.4) +
    sparkle(116, 16, 0.55, 0.35, 1.4)
  )
}

function memory(): string {
  const dur = 3.6
  const keyTimes = [0, 0.22, 0.9, 1]
  return (
    rect(78, 4, 34, 54, { rx: 4, fill: C.frost, stroke: C.grey, 'stroke-width': 1.2 }) +
    tag('line', { x1: 78, y1: 21, x2: 112, y2: 21, stroke: C.grey, 'stroke-width': 1.1 }) +
    rect(81, 9, 2.4, 8, { rx: 1.2, fill: C.grey }) +
    rect(81, 25, 2.4, 13, { rx: 1.2, fill: C.grey }) +
    rect(80, 57.5, 4, 2.5, { fill: C.ink }) +
    rect(106, 57.5, 4, 2.5, { fill: C.ink }) +
    rect(96, 8, 9, 9, { fill: '#BFE3F7', transform: 'rotate(6 100.5 12.5)' }) +
    circle(100.5, 8.5, 1.6, { fill: C.mint }) +
    group(
      { opacity: 0 },
      tag('animateTransform', { attributeName: 'transform', type: 'translate', values: '30 -4;0 0;0 0;0 0', keyTimes: list(keyTimes), dur: `${dur}s`, repeatCount: 'indefinite' }),
      animate('opacity', [0, 1, 1, 0], { dur, keyTimes }),
      group({ transform: 'rotate(-6 101 37)' },
        rect(91, 27, 20, 20, { fill: '#FFE58A', stroke: '#C9A43A', 'stroke-width': 0.9 }),
        ...[33, 37.5, 42].map((y, i) => {
          const from = 0.45 + 0.12 * i
          return rect(94, y, 0, 1.6, { rx: 0.8, fill: '#8C7B6B' }, grow([14, 11, 13][i]!, from, from + 0.1, dur, 0.9))
        }),
      ),
    ) +
    group(
      { opacity: 0 },
      tag('animateTransform', { attributeName: 'transform', type: 'translate', values: '0 -18;0 -18;0 0;0 0', keyTimes: '0;0.24;0.36;1', dur: `${dur}s`, repeatCount: 'indefinite' }),
      animate('opacity', [0, 0, 1, 1, 0], { dur, keyTimes: [0, 0.24, 0.28, 0.9, 1] }),
      circle(100, 27, 3.4, { fill: C.red, stroke: C.redDark, 'stroke-width': 0.9 }),
      circle(99, 26, 1, { fill: C.white, opacity: 0.8 }),
    )
  )
}

function sharing(): string {
  const dur = 2.4
  const shine = (x: number, y: number, s: number) =>
    group({ opacity: 0 }, animate('opacity', [0, 0, 1, 1, 0, 0], { dur, keyTimes: [0, 0.3, 0.45, 0.75, 0.9, 1] }), sparkle(x, y, s, 0, 0.8))
  return (
    shine(85, 43, 0.9) +
    shine(97, 37, 1.1) +
    shine(107, 44, 0.75) +
    ellipse(94, 52, 27, 4, { fill: C.pale, stroke: C.grey, 'stroke-width': 1.2 }) +
    group(
      {},
      animateTransform('translate', ['0 0', '0 0', '-3 -17', '-3 -17', '0 0', '0 0'], { dur, keyTimes: [0, 0.2, 0.42, 0.72, 0.92, 1], spline: true }),
      path('M70 50Q70 25 94 25Q118 25 118 50Z', { fill: '#D5DAE1', stroke: C.grey, 'stroke-width': 1.2 }),
      path('M76 44Q76.5 33 86 30', { fill: 'none', stroke: C.white, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.85 }),
      rect(67, 48.5, 54, 3.5, { rx: 1.75, fill: '#B8BEC6', stroke: C.grey, 'stroke-width': 1 }),
      circle(94, 22.5, 3, { fill: '#B8BEC6', stroke: C.grey, 'stroke-width': 1 }),
    )
  )
}

const PROPS: Record<SceneId, (theme: Theme) => string> = {
  idle,
  thinking,
  reading,
  coding,
  writing,
  designing,
  terminal,
  searching,
  web,
  delegating,
  talking,
  asking,
  planning,
  tool,
  done,
  permission,
  compacting,
  error,
  waiting,
  testing,
  git,
  installing,
  skill,
  memory,
  sharing,
}

// The prop's markup in scene coordinates (no enclosing <svg>).
export function propBody(scene: SceneId, theme: Theme): string {
  return PROPS[scene](theme)
}
