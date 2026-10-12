// The art: Nukey, its props, its terminal rows and the control-panel meter.
// Everything here is pure: same input, same string.
import type { Gauges, SceneId } from '../../types'
import type { Theme } from '../themes'
import { NUKEY_AT, POSES, placedNukey, poseKey } from './nukey'
import { meterAlt, meterReadings, meterRow, meterSvg, meterWidth } from './panel'
import { propBody } from './props'
import { svgDoc } from './svg'
import { nukeyRows, propRows } from './terminal'

export const CANVAS = { width: 128, height: 64, nukeyWidth: 60, propWidth: 68 } as const

// Drawings are pure, so they are kept once made: per pose (Nukey) or scene (prop), and theme.
const nukeyCache = new Map<string, string>()
const propCache = new Map<string, string>()

// Nukey alone, `nukeyWidth` x `height`. Scenes sharing a pose get the very same text.
export function drawNukey(scene: SceneId, theme: Theme): string {
  const pose = POSES[scene]
  const key = `${poseKey(pose)}|${themeKey(theme)}`
  let svg = nukeyCache.get(key)
  if (svg === undefined) {
    svg = svgDoc(0, 0, CANVAS.nukeyWidth, CANVAS.height, placedNukey(pose, theme, NUKEY_AT.x, NUKEY_AT.y))
    nukeyCache.set(key, svg)
  }
  return svg
}

// The prop beside Nukey, `propWidth` x `height`, in scene coordinates (its view box starts at x 60).
export function drawProp(scene: SceneId, theme: Theme): string {
  const key = `${scene}|${scene === 'delegating' ? themeKey(theme) : ''}`
  let svg = propCache.get(key)
  if (svg === undefined) {
    svg = svgDoc(CANVAS.nukeyWidth, 0, CANVAS.propWidth, CANVAS.height, propBody(scene, theme))
    propCache.set(key, svg)
  }
  return svg
}

// A theme is keyed by its colours, so an edited theme object never meets a stale drawing.
const themeKey = (t: Theme) => [t.body, t.trim, t.window, t.glow, t.cheek].join(',')

export function terminalNukey(scene: SceneId, tick: number): readonly [string, string, string] {
  return nukeyRows(scene, tick)
}

export function terminalProp(scene: SceneId, tick: number): readonly [string, string, string] {
  return propRows(scene, tick)
}

export function panelWidth(gauges: Gauges): number {
  return meterWidth(gauges)
}

export function drawPanel(gauges: Gauges, theme: Theme): string {
  return meterSvg(gauges, theme)
}

export function panelRow(gauges: Gauges): string {
  return meterRow(gauges)
}

export function panelAlt(gauges: Gauges): string {
  return meterAlt(gauges)
}

export function panelReadings(gauges: Gauges): readonly { label: string; value: string }[] {
  return meterReadings(gauges)
}
