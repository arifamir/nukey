import { describe, expect, test } from 'claude-code/testing'

import type { SceneId } from '../../types'
import { THEMES, THEME_NAMES } from '../themes'
import { CANVAS, drawNukey, drawProp, terminalNukey, terminalProp } from './index'
import { drawScene } from './scene'

const SCENES: SceneId[] = [
  'idle', 'thinking', 'reading', 'coding', 'writing', 'designing', 'terminal', 'searching', 'web',
  'delegating', 'talking', 'asking', 'planning', 'tool', 'done', 'permission', 'compacting', 'error',
  'waiting', 'testing', 'git', 'installing', 'skill', 'memory', 'sharing',
]

const width = (row: string) => Array.from(row).length
const classic = THEMES.classic

describe('terminal Nukey', () => {
  test('every row of every scene is 9 characters wide', () => {
    for (const scene of SCENES) {
      for (const tick of [0, 1, 2, 59]) {
        const rows = terminalNukey(scene, tick)
        expect(rows).toHaveLength(3)
        for (const row of rows) expect(width(row)).toBe(9)
      }
    }
  })

  test('the frame and the face per scene', () => {
    const faces: Partial<Record<SceneId, string>> = {
      idle: '- -',
      compacting: '- -',
      done: '^ ^',
      error: 'x x',
      thinking: '° °',
    }
    for (const scene of SCENES) {
      const [top, middle, bottom] = terminalNukey(scene, 0)
      expect(top).toBe('┌─────┬─┐')
      expect(bottom).toBe('└┬───┬┴─┘')
      expect(middle).toBe(`│ ${faces[scene] ?? '◕ ◕'} │▪│`)
    }
  })

  test('the spec examples', () => {
    expect(terminalNukey('reading', 0)[1]).toBe('│ ◕ ◕ │▪│')
    expect(terminalNukey('idle', 0)[1]).toBe('│ - - │▪│')
    expect(terminalNukey('done', 1)[1]).toBe('│ ^ ^ │▪│')
    expect(terminalNukey('error', 0)[1]).toBe('│ x x │▪│')
    expect(terminalNukey('coding', 1)[1].endsWith('▫│')).toBe(true)
    expect(terminalNukey('idle', 1)[1].endsWith('▪│')).toBe(true)
  })

  test('the dial light blinks while working and stays lit at rest and on done', () => {
    for (const scene of SCENES) {
      for (let tick = 0; tick < 6; tick++) {
        const light = terminalNukey(scene, tick)[1].at(-2)
        const lit = scene === 'idle' || scene === 'done' || tick % 2 === 0
        expect(light).toBe(lit ? '▪' : '▫')
      }
    }
  })
})

describe('terminal props', () => {
  // Frame count and width per scene, kept from the reference so the layout never jumps.
  const SHAPE: Record<SceneId, [number, number]> = {
    idle: [3, 4], thinking: [3, 8], reading: [3, 7], coding: [2, 7], writing: [3, 6], designing: [4, 5],
    terminal: [2, 7], searching: [3, 7], web: [4, 7], delegating: [2, 10], talking: [3, 6], asking: [2, 3],
    planning: [4, 7], tool: [2, 3], done: [2, 7], permission: [2, 8], compacting: [3, 7], error: [2, 4],
    waiting: [4, 5], testing: [4, 4], git: [3, 7], installing: [3, 5], skill: [2, 3], memory: [3, 5],
    sharing: [3, 5],
  }

  test('every scene has frames of three rows, all one width', () => {
    for (const scene of SCENES) {
      const [count, cols] = SHAPE[scene]
      const frames = new Set<string>()
      for (let tick = 0; tick < 12; tick++) {
        const rows = terminalProp(scene, tick)
        expect(rows).toHaveLength(3)
        for (const row of rows) expect(width(row)).toBe(cols)
        frames.add(rows.join('\n'))
      }
      expect(frames.size).toBe(count)
    }
  })

  test('the frame is the counter modulo the frame count, continuous across the wrap at 60', () => {
    for (const scene of SCENES) {
      const [count] = SHAPE[scene]
      expect(terminalProp(scene, 60)).toEqual(terminalProp(scene, 0))
      expect(terminalProp(scene, count)).toEqual(terminalProp(scene, 0))
      expect(terminalProp(scene, 59 + 1)).toEqual(terminalProp(scene, 0))
    }
  })

  test('done says DING! in its middle row in both frames, with corners on the second', () => {
    expect(terminalProp('done', 0)[1]).toBe(' DING! ')
    expect(terminalProp('done', 1)[1]).toBe(' DING! ')
    expect(terminalProp('done', 0)[0].trim()).toBe('')
    expect(terminalProp('done', 1)[0].trim()).not.toBe('')
  })
})

describe('Nukey SVG', () => {
  const POSE_GROUPS: SceneId[][] = [
    ['reading', 'searching', 'web', 'planning', 'waiting', 'testing', 'git', 'installing', 'memory'],
    ['coding', 'writing', 'terminal', 'tool', 'compacting'],
    ['delegating', 'sharing'],
    ['designing'],
    ['skill'],
    ['talking'],
    ['asking', 'permission'],
    ['done'],
    ['thinking'],
    ['error'],
    ['idle'],
  ]

  test('is 60 by 64 with geometric precision', () => {
    const svg = drawNukey('idle', classic)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('width="60" height="64" viewBox="0 0 60 64"')
    expect(svg).toContain('shape-rendering="geometricPrecision"')
    expect(CANVAS).toEqual({ width: 128, height: 64, nukeyWidth: 60, propWidth: 68 })
  })

  test('is identical across scenes that share a pose and differs between poses', () => {
    for (const theme of THEME_NAMES.map(n => THEMES[n])) {
      const seen = new Set<string>()
      for (const group of POSE_GROUPS) {
        const first = drawNukey(group[0]!, theme)
        for (const scene of group) expect(drawNukey(scene, theme)).toBe(first)
        seen.add(first)
      }
      expect(seen.size).toBe(POSE_GROUPS.length)
    }
  })

  test('stands at (10, 29) and its body, window and face follow the numbers', () => {
    const svg = drawNukey('talking', classic)
    expect(svg).toContain('<g transform="translate(10 29)">')
    expect(svg).toContain('<ellipse cx="24" cy="28" rx="19" ry="1.8" fill="#000" opacity="0.14"/>')
    expect(svg).toContain(`<rect x="4" y="0" width="40" height="23" rx="4" fill="${classic.body}" stroke="${classic.trim}" stroke-width="1.5"/>`)
    expect(svg).toContain(`<rect x="8" y="4" width="23" height="16" rx="2.5" fill="${classic.window}"/>`)
    expect(svg).toContain('values="0 0;0 -1.6;0 0" dur="1.6s"')
  })

  test('eyes look where the pose says, and blink unless closed', () => {
    expect(drawNukey('talking', classic)).toContain('<rect x="12.5" y="8" width="3.5" height="5"')
    expect(drawNukey('thinking', classic)).toContain('<rect x="12.5" y="6" width="3.5" height="5"')
    expect(drawNukey('reading', classic)).toContain('<rect x="24" y="8" width="3.5" height="5"')
    const closed = drawNukey('idle', classic)
    expect(closed).toContain('<rect x="12.5" y="11" width="3.5" height="1.5" rx="1" fill="#F8F4EA"/>')
    expect(closed).not.toContain('keyTimes="0;0.92;0.96;1"')
    expect(drawNukey('reading', classic)).toContain('values="5;5;1;5" dur="3.4s" repeatCount="indefinite" keyTimes="0;0.92;0.96;1"')
  })

  test('arms, bob and shake per pose', () => {
    expect(drawNukey('coding', classic)).toContain('values="11;9;11" dur="0.3s" repeatCount="indefinite" begin="0.15s"')
    expect(drawNukey('asking', classic)).toContain('values="11;3;11" dur="0.7s"')
    expect(drawNukey('done', classic)).toContain('values="4;1;4" dur="0.5s" repeatCount="indefinite" begin="0.25s"')
    expect(drawNukey('done', classic)).toContain('dur="0.6s"')
    expect(drawNukey('idle', classic)).toContain('values="0 0;0 -1.6;0 0" dur="3.2s"')
    const error = drawNukey('error', classic)
    expect(error).toContain('values="0 0;-1.6 0;1.6 0;0 0" dur="0.28s"')
    expect(error).not.toContain('0 -1.6')
  })

  test('wear: a chef toque for skill, a pastry bandana for designing, nothing elsewhere', () => {
    const toque = drawNukey('skill', classic)
    const bandana = drawNukey('designing', classic)
    expect(toque).toContain('cy="-13"') // the toque's top puff, above the body
    expect(bandana).toContain('#E0645C')
    expect(drawNukey('reading', classic)).not.toContain('#E0645C')
    expect(drawNukey('reading', classic)).not.toContain('cy="-13"')
  })

  test('takes every colour from the theme', () => {
    for (const theme of THEME_NAMES.map(n => THEMES[n])) {
      const svg = drawNukey('reading', theme)
      for (const colour of [theme.body, theme.trim, theme.window, theme.glow, theme.cheek]) {
        expect(svg).toContain(`"${colour}"`)
      }
    }
  })
})

describe('props', () => {
  test('every scene has an animated 68 x 64 prop in scene coordinates', () => {
    for (const scene of SCENES) {
      const svg = drawProp(scene, classic)
      expect(svg).toContain('width="68" height="64" viewBox="60 0 68 64"')
      expect(svg).toMatch(/<animate(Transform|Motion)?\b/)
      expect(svg.length).toBeLessThan(131072)
    }
  })

  test('every prop is different', () => {
    const seen = new Set(SCENES.map(scene => drawProp(scene, classic)))
    expect(seen.size).toBe(SCENES.length)
  })

  test('the delegating helpers are half-size Nukeys in the theme, bobbing out of step', () => {
    for (const theme of THEME_NAMES.map(n => THEMES[n])) {
      const svg = drawProp('delegating', theme)
      expect(svg).toContain('translate(66 40) scale(0.5)')
      expect(svg).toContain('translate(96 40) scale(0.5)')
      expect(svg).toContain('translate(81 18) scale(0.5)')
      expect(svg).toContain('dur="0.7s" repeatCount="indefinite" begin="0.35s"')
      expect(svg).toContain('dur="0.7s" repeatCount="indefinite" begin="0.2s"')
      for (const colour of [theme.body, theme.trim, theme.window, theme.glow, theme.cheek]) {
        expect(svg).toContain(`"${colour}"`)
      }
    }
  })

  test('other props do not follow the theme', () => {
    for (const scene of SCENES.filter(s => s !== 'delegating')) {
      expect(drawProp(scene, THEMES.bubblegum)).toBe(drawProp(scene, THEMES.classic))
    }
  })

  test('done is a green DING! badge that pops in once, with sparkles', () => {
    const svg = drawProp('done', classic)
    expect(svg).toContain('>DING!</text>')
    expect(svg).toContain('#3FA34D')
    expect(svg).toContain('values="0.6;1.25;1" keyTimes="0;0.6;1" dur="0.45s" fill="freeze"')
  })

  test('the permission sign reads OK?', () => {
    expect(drawProp('permission', classic)).toContain('>OK?</text>')
  })

  test('a combined scene drawing holds both halves', () => {
    const svg = drawScene('reading', classic)
    expect(svg).toContain('viewBox="0 0 128 64"')
    expect(svg).toContain('translate(10 29)')
  })
})
