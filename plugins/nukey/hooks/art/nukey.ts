// Nukey the microwave, drawn in its own coordinates (about 48 x 27, origin at the body's top left).
import type { SceneId } from '../../types'
import type { Theme } from '../themes'
import { animate, animateTransform, group, num, tag } from './svg'

export type Look = 'ahead' | 'up' | 'right' | 'closed'
export type Arms = 'still' | 'typing' | 'wave' | 'cheer'
export type Wear = 'none' | 'toque' | 'bandana'

export type Pose = {
  look: Look
  arms: Arms
  bob: number // seconds per bob; ignored when shaking
  shake: boolean
  wear: Wear
}

const BASE: Pose = { look: 'ahead', arms: 'still', bob: 1.6, shake: false, wear: 'none' }
const pose = (changes: Partial<Pose>): Pose => ({ ...BASE, ...changes })

const LOOK_RIGHT = pose({ look: 'right' })
const LOOK_RIGHT_TYPING = pose({ look: 'right', arms: 'typing' })
const LOOK_RIGHT_WAVE = pose({ look: 'right', arms: 'wave' })
const LOOK_AHEAD_WAVE = pose({ arms: 'wave' })

export const POSES: Record<SceneId, Pose> = {
  idle: pose({ look: 'closed', bob: 3.2 }),
  thinking: pose({ look: 'up' }),
  reading: LOOK_RIGHT,
  coding: LOOK_RIGHT_TYPING,
  writing: LOOK_RIGHT_TYPING,
  designing: pose({ look: 'right', wear: 'bandana' }),
  terminal: LOOK_RIGHT_TYPING,
  searching: LOOK_RIGHT,
  web: LOOK_RIGHT,
  delegating: LOOK_RIGHT_WAVE,
  talking: BASE,
  asking: LOOK_AHEAD_WAVE,
  planning: LOOK_RIGHT,
  tool: LOOK_RIGHT_TYPING,
  done: pose({ arms: 'cheer', bob: 0.6 }),
  permission: LOOK_AHEAD_WAVE,
  compacting: LOOK_RIGHT_TYPING,
  error: pose({ look: 'up', shake: true }),
  waiting: LOOK_RIGHT,
  testing: LOOK_RIGHT,
  git: LOOK_RIGHT,
  installing: LOOK_RIGHT,
  skill: pose({ look: 'right', wear: 'toque' }),
  memory: LOOK_RIGHT,
  sharing: LOOK_RIGHT_WAVE,
}

// A key that is equal exactly when two poses draw the same.
export const poseKey = (p: Pose) => `${p.look}/${p.arms}/${p.shake ? 'shake' : p.bob}/${p.wear}`

// Fixed colours that do not follow the theme.
export const SHADOW = '#000'
const TOQUE = '#FFFFFF'
const TOQUE_LINE = '#B9B2A6'
const BANDANA = '#E0645C'
const BANDANA_DOT = '#FFF4EC'
const BANDANA_LINE = '#A8443E'

const EYES: Record<Look, { dx: number; y: number; h: number }> = {
  ahead: { dx: 0, y: 8, h: 5 },
  up: { dx: 0, y: 6, h: 5 },
  right: { dx: 2, y: 8, h: 5 },
  closed: { dx: 0, y: 11, h: 1.5 },
}

const BLINK = { dur: 3.4, keyTimes: [0, 0.92, 0.96, 1] }

function eye(x: number, look: Look, theme: Theme): string {
  const { dx, y, h } = EYES[look]
  const attrs = { x: x + dx, y, width: 3.5, height: h, rx: 1, fill: theme.glow }
  if (look === 'closed') return tag('rect', attrs)
  return tag(
    'rect',
    attrs,
    animate('height', [h, h, 1, h], BLINK),
    animate('y', [y, y, y + 2, y], BLINK),
  )
}

type ArmMotion = { base: number; left?: { values: number[]; dur: number; begin?: number }; right?: { values: number[]; dur: number; begin?: number } }

const ARMS: Record<Arms, ArmMotion> = {
  still: { base: 11 },
  typing: {
    base: 11,
    left: { values: [11, 9, 11], dur: 0.3 },
    right: { values: [11, 9, 11], dur: 0.3, begin: 0.15 },
  },
  wave: { base: 11, right: { values: [11, 3, 11], dur: 0.7 } },
  cheer: {
    base: 4,
    left: { values: [4, 1, 4], dur: 0.5 },
    right: { values: [4, 1, 4], dur: 0.5, begin: 0.25 },
  },
}

function arm(x: number, motion: ArmMotion, side: 'left' | 'right', theme: Theme): string {
  const move = motion[side]
  return tag(
    'rect',
    { x, y: motion.base, width: 6, height: 6, rx: 2, fill: theme.body, stroke: theme.trim, 'stroke-width': 1.5 },
    move ? animate('y', move.values, { dur: move.dur, begin: move.begin }) : '',
  )
}

// A tall pleated chef's hat sitting on the body's top edge.
function toque(): string {
  const line = { fill: TOQUE, stroke: TOQUE_LINE, 'stroke-width': 1 }
  return group(
    {},
    // The puffs: outlined first, then filled again without outline so the inner edges vanish.
    tag('circle', { cx: 16, cy: -9.5, r: 5.5, ...line }),
    tag('circle', { cx: 32, cy: -9.5, r: 5.5, ...line }),
    tag('circle', { cx: 24, cy: -13, r: 6.5, ...line }),
    tag('rect', { x: 13, y: -9, width: 22, height: 9, fill: TOQUE }),
    tag('circle', { cx: 16, cy: -9.5, r: 4.9, fill: TOQUE }),
    tag('circle', { cx: 32, cy: -9.5, r: 4.9, fill: TOQUE }),
    tag('circle', { cx: 24, cy: -13, r: 5.9, fill: TOQUE }),
    // The band, with pleats.
    tag('rect', { x: 12.5, y: -5, width: 23, height: 6, rx: 1.2, ...line }),
    tag('path', { d: 'M18 -4.2V0.2M24 -4.2V0.2M30 -4.2V0.2', stroke: TOQUE_LINE, 'stroke-width': 0.7, fill: 'none' }),
  )
}

// A polka-dot pastry bandana over the top of the body, knotted at the right with two tails.
function bandana(): string {
  return group(
    {},
    tag('path', {
      d: 'M43 -0.5L49.5 -4.5L48.5 1.5ZM43 0.5L48.5 4.5L44 5.5Z',
      fill: BANDANA,
      stroke: BANDANA_LINE,
      'stroke-width': 0.8,
      'stroke-linejoin': 'round',
    }),
    tag('path', {
      d: 'M3.5 3.6V1.5Q3.5 -5.5 11 -6H37Q44.5 -5.5 44.5 1.5V3.6Q24 1.6 3.5 3.6Z',
      fill: BANDANA,
      stroke: BANDANA_LINE,
      'stroke-width': 0.9,
      'stroke-linejoin': 'round',
    }),
    tag('circle', { cx: 43.5, cy: 0, r: 2, fill: BANDANA, stroke: BANDANA_LINE, 'stroke-width': 0.8 }),
    ...[
      [9, -2.5],
      [16, -4],
      [23, -2],
      [30, -4],
      [37, -2.5],
      [12.5, 1],
      [19.5, 0.6],
      [26.5, 0.6],
      [33.5, 1],
    ].map(([cx, cy]) => tag('circle', { cx, cy, r: 1.05, fill: BANDANA_DOT })),
  )
}

const WEAR: Record<Wear, () => string> = { none: () => '', toque, bandana }

// Nukey's drawing in its own coordinates. `delay` starts the bob later (helpers bob out of step).
export function nukeyBody(p: Pose, theme: Theme, delay = 0): string {
  const motion = p.shake
    ? animateTransform('translate', ['0 0', '-1.6 0', '1.6 0', '0 0'], { dur: 0.28 })
    : animateTransform('translate', ['0 0', '0 -1.6', '0 0'], { dur: p.bob, begin: delay })
  const arms = ARMS[p.arms]
  return (
    tag('ellipse', { cx: 24, cy: 28, rx: 19, ry: 1.8, fill: SHADOW, opacity: 0.14 }) +
    group(
      {},
      motion,
      arm(0, arms, 'left', theme),
      arm(42, arms, 'right', theme),
      tag('rect', { x: 10, y: 22, width: 5, height: 4, rx: 1, fill: theme.trim }),
      tag('rect', { x: 33, y: 22, width: 5, height: 4, rx: 1, fill: theme.trim }),
      tag('rect', { x: 4, y: 0, width: 40, height: 23, rx: 4, fill: theme.body, stroke: theme.trim, 'stroke-width': 1.5 }),
      tag('rect', { x: 8, y: 4, width: 23, height: 16, rx: 2.5, fill: theme.window }),
      eye(12.5, p.look, theme),
      eye(22, p.look, theme),
      tag('ellipse', { cx: 11.5, cy: 16.5, rx: 1.8, ry: 1.1, fill: theme.cheek, opacity: 0.8 }),
      tag('ellipse', { cx: 28, cy: 16.5, rx: 1.8, ry: 1.1, fill: theme.cheek, opacity: 0.8 }),
      tag('line', { x1: 33.5, y1: 3, x2: 33.5, y2: 20, stroke: theme.trim, 'stroke-width': 1, opacity: 0.35 }),
      tag('circle', { cx: 37.5, cy: 7.5, r: 2.8, fill: theme.body, stroke: theme.trim, 'stroke-width': 1.3 }),
      tag('line', {
        x1: 37.5,
        y1: 7.5,
        x2: 37.5,
        y2: 5.4,
        stroke: theme.trim,
        'stroke-width': 1.1,
        'stroke-linecap': 'round',
      }),
      ...[13, 16.5, 20].map(y => tag('rect', { x: 35, y, width: 5, height: 1.8, rx: 0.9, fill: theme.trim, opacity: 0.55 })),
      WEAR[p.wear](),
    )
  )
}

// Where the main Nukey stands in scene coordinates.
export const NUKEY_AT = { x: 10, y: 29 } as const

// Nukey placed in scene coordinates.
export function placedNukey(p: Pose, theme: Theme, x: number, y: number, scale = 1, delay = 0): string {
  const transform = scale === 1 ? `translate(${num(x)} ${num(y)})` : `translate(${num(x)} ${num(y)}) scale(${num(scale)})`
  return group({ transform }, nukeyBody(p, theme, delay))
}

// The pose the delegating prop's helpers wear.
export const HELPER_POSE: Pose = pose({ bob: 0.7 })
