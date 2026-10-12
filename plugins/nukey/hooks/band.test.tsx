import { describe, expect, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import { panelAlt, panelReadings, panelRow } from './art'
import { BAND, PEEK, SURFACES, peek, readBand, runCommand, startSession, turnStart, value, world } from './harness'
import { DEMO_SCENES, LABELS } from './scenes'

const nukey = ($: Engine, args = '') => runCommand($, 'nukey', args)
const it = (name: string, body: TestBody) => test(name, { plugins: [PEEK] }, body)
const state = value

describe('the band', () => {
  it('a fresh session rests on every surface', async ($, on) => {
    const w = world(on)
    await startSession($)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'nukey', surface, ...BAND })
      const band = await readBand(ui, w)
      expect(band.label).toBe('Nukey is napping')
      expect(band.detail).toBe('')
      expect(band.isEngine).toBe(false)
      await ui.unmount()
    }
  })

  it('the desktop alt texts: Nukey, the label alone or with its detail, the meter', async ($, on) => {
    const w = world(on)
    await startSession($)
    const ui = await $.ui.mount({ plugin: 'nukey', surface: 'desktop', ...BAND })
    expect((await readBand(ui, w)).alts).toEqual(['Nukey the microwave', 'Nukey is napping', 'Context not measured yet'])
    await turnStart($)
    w.tool = () => ({ result: 'ok', text: 'ok' })
    await $.tool.call({ tool: 'Read', file_path: '/repo/src/a.ts', tool_use_id: 'r1' })
    const band = await readBand(ui, w)
    expect(band.alts[1]).toBe('Reading through the files: a.ts')
    expect(band.alts[0]).toBe('Nukey the microwave')
  })

  it('a short detail sits level with Nukey on the terminal; a long one wraps without the blank row', async ($, on) => {
    const w = world(on)
    await startSession($)
    await turnStart($)
    const ui = await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND })
    const short = 's'.repeat(60)
    await $.tool.call({ tool: 'Bash', command: 'x', description: short, tool_use_id: 'b1' })
    expect((await readBand(ui, w)).column).toEqual([' ', 'Running a command', short])
    await w.clock.advance(1200)
    const long = 'l'.repeat(78)
    await $.tool.call({ tool: 'Bash', command: 'x', description: long, tool_use_id: 'b2' })
    expect((await readBand(ui, w)).column).toEqual(['Running a command', long])
    await w.clock.advance(1200)
    await $.tool.call({ tool: 'TodoWrite', todos: [], tool_use_id: 't1' } as Parameters<Engine['tool']['call']>[0])
    expect((await readBand(ui, w)).column).toEqual([' ', 'Planning the steps', ' '])
  })

  it('passes on under a survey, on other surfaces, and while hidden', async ($, on) => {
    const w = world(on)
    await startSession($)
    const survey = await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND, props: { ...BAND.props, hasSurvey: true } })
    expect((await readBand(survey, w)).isEngine).toBe(true)
    for (const surface of ['vscode', 'mobile'] as const) {
      const other = await $.ui.mount({ plugin: 'nukey', surface, ...BAND })
      expect((await readBand(other, w)).isEngine).toBe(true)
    }
    await nukey($)
    for (const surface of SURFACES) {
      const hidden = await $.ui.mount({ plugin: 'nukey', surface, ...BAND })
      expect((await readBand(hidden, w)).isEngine).toBe(true)
    }
  })
})

describe('/nukey', () => {
  it('is registered at session start with its hint', async ($, on) => {
    const registered: unknown[] = []
    on('command.register', ($, e) => {
      registered.push(e)
      return { value: { command: e.name } }
    })
    world(on, { skip: ['command.register'] })
    await startSession($)
    expect(registered[0]).toMatchObject({ name: 'nukey', argumentHint: '[demo|meter|details|commands|theme [name]]' })
  })

  it('bare, it hides and shows Nukey', async ($, on) => {
    const w = world(on)
    await startSession($)
    const ui = await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND })
    const hide = await nukey($)
    expect(hide.text).toContain('/nukey again to bring it back')
    expect(await state($, 'hidden')).toBe(true)
    expect((await readBand(ui, w)).isEngine).toBe(true)
    const show = await nukey($, '  ')
    expect(show.text).toBe('Nukey is back above the prompt.')
    expect(await state($, 'hidden')).toBe(false)
    expect((await readBand(ui, w)).label).toBe('Nukey is napping')
  })

  it('an unknown argument lists the arguments and toggles nothing', async ($, on) => {
    world(on)
    await startSession($)
    for (const args of ['themes', 'dance', 'theme-park']) {
      const answer = await nukey($, args)
      expect(answer.text).toContain(`"${args}"`)
      expect(answer.text).toContain('demo, meter, details, commands, theme')
    }
    expect(await state($, 'hidden')).toBeNull()
  })

  it('arguments match in any letter case', async ($, on) => {
    world(on)
    await startSession($)
    expect((await nukey($, 'METER')).text).toContain('Meter off')
    expect((await nukey($, 'Meter')).text).toContain('Meter on')
    expect((await nukey($, ' Theme Bubblegum ')).text).toContain('Bubblegum')
    expect(await state($, 'theme')).toBe('bubblegum')
  })

  it('meter hides and shows the control panel on both surfaces', async ($, on) => {
    const w = world(on)
    await startSession($)
    const reply = await nukey($, 'meter')
    expect(reply.text).toContain('/nukey meter to switch it on again')
    for (const surface of SURFACES) {
      const band = await readBand(await $.ui.mount({ plugin: 'nukey', surface, ...BAND }), w)
      expect(band.alts).not.toContain('Context not measured yet')
      expect(band.texts).not.toContain(panelRow({ context: null, fiveHour: null, week: null }))
    }
    const back = await nukey($, 'meter')
    expect(back.text).toContain('power bars rise with the context')
    const terminal = await readBand(await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND }), w)
    expect(terminal.texts).toContain(panelRow({ context: null, fiveHour: null, week: null }))
    const desktop = await readBand(await $.ui.mount({ plugin: 'nukey', surface: 'desktop', ...BAND }), w)
    expect(desktop.alts).toContain('Context not measured yet')
  })

  it('details turns the meter back on and shows the readings; again, hides only them', async ($, on) => {
    const w = world(on, { usage: { startedAt: 0, context: { window: 1, percent: 62 }, rateLimits: [] } })
    await startSession($)
    await nukey($, 'meter')
    const reply = await nukey($, 'details')
    expect(reply.text).toContain('/nukey details to hide them')
    expect(await state($, 'meter')).toBe(true)
    expect(await state($, 'details')).toBe(true)
    const rows = panelReadings({ context: 62, fiveHour: null, week: null })
    for (const surface of SURFACES) {
      const band = await readBand(await $.ui.mount({ plugin: 'nukey', surface, ...BAND }), w)
      for (const row of rows) {
        expect(band.texts).toContain(row.label)
        expect(band.texts).toContain(row.value)
      }
    }
    const off = await nukey($, 'details')
    expect(off.text).toContain('the meter itself stays')
    expect(await state($, 'meter')).toBe(true)
    const desktop = await readBand(await $.ui.mount({ plugin: 'nukey', surface: 'desktop', ...BAND }), w)
    expect(desktop.alts).toContain(panelAlt({ context: 62, fiveHour: null, week: null }))
    for (const row of rows) expect(desktop.texts).not.toContain(row.label)
  })

  it('commands switches the detail between the description and the command', async ($, on) => {
    const w = world(on)
    await startSession($)
    await turnStart($)
    const ui = await $.ui.mount({ plugin: 'nukey', surface: 'desktop', ...BAND })
    const call = { tool: 'Bash', command: 'git status --short', description: 'Show working tree status' } as const
    await $.tool.call({ ...call, tool_use_id: 'a' })
    expect((await readBand(ui, w)).detail).toBe('Show working tree status')
    expect((await nukey($, 'commands')).text).toContain('exactly as typed')
    await w.clock.advance(1200)
    await $.tool.call({ ...call, tool_use_id: 'b' })
    expect((await readBand(ui, w)).detail).toBe('git status --short')
    expect((await nukey($, 'commands')).text).toContain('what each shell command is for again')
    await w.clock.advance(1200)
    await $.tool.call({ ...call, tool_use_id: 'c' })
    expect((await readBand(ui, w)).detail).toBe('Show working tree status')
  })

  it('demo plays the scenes in order, real work underneath, then the live scene', async ($, on) => {
    const w = world(on)
    await startSession($)
    await nukey($) // hidden: the demo shows Nukey again
    await turnStart($)
    const reply = await nukey($, 'demo')
    expect(reply.text).toContain(`${DEMO_SCENES.length} scenes, 3 seconds apiece`)
    expect(reply.text).toContain('24 scenes')
    expect(await state($, 'hidden')).toBe(false)
    const ui = await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND })
    const seen: string[] = []
    for (const [at] of DEMO_SCENES.entries()) {
      const band = await readBand(ui, w)
      seen.push(band.label)
      expect(band.detail).toBe('demo')
      if (at === 3) await $.tool.call({ tool: 'Grep', pattern: 'x', tool_use_id: 'g' } as unknown as Parameters<Engine['tool']['call']>[0])
      await w.clock.advance(3000)
    }
    expect(seen).toEqual(DEMO_SCENES.map(scene => LABELS[scene]))
    expect((await readBand(ui, w)).label).toBe('Thinking it over')
  })

  it('the frame ticks during a demo between turns on the terminal', async ($, on) => {
    const w = world(on)
    await startSession($)
    await nukey($, 'demo')
    await w.clock.advance(1800)
    expect(await state($, 'frame')).toBe(3)
    await w.clock.advance(3000 * DEMO_SCENES.length)
    const frame = await state($, 'frame')
    await w.clock.advance(6000)
    expect(await state($, 'frame')).toBe(frame)
    expect(await state($, 'scene')).toEqual({ scene: 'idle', detail: '' })
  })
})

describe('themes', () => {
  it('theme bubblegum colours both surfaces and is kept in the store', async ($, on) => {
    const w = world(on)
    await startSession($)
    const reply = await nukey($, 'theme bubblegum')
    expect(reply.text).toContain('Bubblegum')
    expect(w.store.theme).toBe('bubblegum')
    const desktop = await readBand(await $.ui.mount({ plugin: 'nukey', surface: 'desktop', ...BAND }), w)
    expect(desktop.sources[0]).toContain('#FFC6DA')
    const terminal = await readBand(await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND }), w)
    expect(terminal.colors).toContain('#FF8FB7')
    expect(terminal.colors).not.toContain('claude')
  })

  it('an unknown theme changes nothing', async ($, on) => {
    const w = world(on)
    await startSession($)
    const reply = await nukey($, 'theme toaster')
    expect(reply.text).toContain('no theme "toaster"')
    expect(reply.text).toContain('classic (Classic cream)')
    expect(await state($, 'theme')).toBeNull()
    expect(w.storeWrites).toEqual([])
  })

  it('theme alone cycles, five times round to where it began', async ($, on) => {
    const w = world(on)
    await startSession($)
    await nukey($, 'theme bubblegum')
    expect((await nukey($, 'theme')).text).toContain('Classic cream')
    expect(await state($, 'theme')).toBe('classic')
    const visited: unknown[] = []
    for (let n = 0; n < 5; n += 1) {
      await nukey($, 'theme')
      visited.push(await state($, 'theme'))
    }
    expect(visited).toEqual(['retro', 'steel', 'midnight', 'bubblegum', 'classic'])
    expect(w.store.theme).toBe('classic')
  })

  it('a theme name in capitals is lower-cased', async ($, on) => {
    world(on)
    await startSession($)
    expect((await nukey($, 'theme RETRO')).text).toContain('Retro mint')
    expect(await state($, 'theme')).toBe('retro')
  })

  it('a failure to store still applies the theme', async ($, on) => {
    on('store.set', () => ({ deny: 'read-only' }))
    world(on, { skip: ['store.set'] })
    await startSession($)
    expect((await nukey($, 'theme steel')).text).toContain('Stainless steel')
    expect(await state($, 'theme')).toBe('steel')
  })

  it('the stored theme loads at session start', async ($, on) => {
    const w = world(on, { store: { theme: 'midnight' } })
    await startSession($)
    expect(await state($, 'theme')).toBe('midnight')
    const terminal = await readBand(await $.ui.mount({ plugin: 'nukey', surface: 'terminal', ...BAND }), w)
    expect(terminal.colors).toContain('#FFB454')
  })

  it('an invalid stored theme leaves the theme as it was', async ($, on) => {
    const w = world(on, { store: { theme: 'retro' } })
    await startSession($)
    w.store.theme = 'toaster'
    await startSession($)
    expect(await state($, 'theme')).toBe('retro')
    w.store.theme = 'constructor'
    await startSession($)
    expect(await state($, 'theme')).toBe('retro')
  })
})

describe('the meter', () => {
  const measure = ($: Engine, percent: number | undefined, limits: [string, number][]) =>
    $.session.measure({
      context: { window: 200_000, ...(percent !== undefined ? { percent } : {}) },
      rateLimits: limits.map(([kind, percentUsed]) => ({ kind, percentUsed })),
      changed: ['context'],
    })

  it('readings from a measurement show on both surfaces', async ($, on) => {
    const w = world(on)
    await startSession($)
    await nukey($, 'details')
    await measure($, 62, [
      ['five_hour', 57],
      ['seven_day', 41],
    ])
    expect(await state($, 'gauges')).toEqual({ context: 62, fiveHour: 57, week: 41 })
    const rows = panelReadings({ context: 62, fiveHour: 57, week: 41 })
    for (const surface of SURFACES) {
      const band = await readBand(await $.ui.mount({ plugin: 'nukey', surface, ...BAND }), w)
      for (const row of rows) expect(band.texts).toContain(row.value)
      if (surface === 'terminal') expect(band.texts).toContain(panelRow({ context: 62, fiveHour: 57, week: 41 }))
      else expect(band.alts).toContain(panelAlt({ context: 62, fiveHour: 57, week: 41 }))
    }
  })

  it('readings from the usage at session start', async ($, on) => {
    world(on, {
      usage: { startedAt: 0, context: { window: 1, percent: 12.5 }, rateLimits: [{ kind: 'seven_day', percentUsed: 3.5 }] },
    })
    await startSession($)
    expect(await state($, 'gauges')).toEqual({ context: 13, fiveHour: null, week: 4 })
  })

  it('whole percents, halves up; an equal measurement writes nothing', async ($, on) => {
    world(on)
    await startSession($)
    await measure($, 40.4, [['five_hour', 57.4]])
    expect(await state($, 'gauges')).toEqual({ context: 40, fiveHour: 57, week: null })
    const { version } = await peek($, 'gauges')
    await measure($, 40.2, [['five_hour', 56.6]])
    expect((await peek($, 'gauges')).version).toBe(version)
    await measure($, 40.2, [['five_hour', 57.5]])
    expect(await state($, 'gauges')).toEqual({ context: 40, fiveHour: 58, week: null })
  })
})
