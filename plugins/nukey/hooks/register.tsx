// The hook layer: feeds engine events and clock ticks into the scene machine,
// carries out its effects, keeps `$.state` in sync and draws the band with the art.
import type { BoxProps, ElementConstructor, EngineInterface, Register, RenderElement, TextProps, Timer, TurnStepChunk } from 'claude-code'
import type { SceneId } from '../types'
import { drawNukey, drawPanel, drawProp, panelAlt, panelReadings, panelRow, panelWidth, terminalNukey, terminalProp } from './art'
import { type Args, classifyTool, isHandback } from './classify'
import { COMMAND, parseArgs, reply, themeNamed } from './command'
import type { BackgroundTask } from './detail'
import { type Effect, type Event, type MachineState, type TimerName, initialState, step } from './machine'
import { type Measurement, NO_GAUGES, readGauges, sameGauges } from './meter'
import { DEMO_SCENES, LABELS, SHORT_DETAIL, TIMING, isSceneId } from './scenes'
import { DEFAULT_THEME, THEMES, nextTheme } from './themes'

const SCENE = { plugin: 'nukey', key: 'scene' } as const
const HIDDEN = { plugin: 'nukey', key: 'hidden' } as const
const FRAME = { plugin: 'nukey', key: 'frame' } as const
const GAUGES = { plugin: 'nukey', key: 'gauges' } as const
const METER = { plugin: 'nukey', key: 'meter' } as const
const DETAILS = { plugin: 'nukey', key: 'details' } as const
const TYPED = { plugin: 'nukey', key: 'typed' } as const
const THEME = { plugin: 'nukey', key: 'theme' } as const

const NUKEY_ALT = 'Nukey the microwave'

// What the running module knows about the session; lost on a reload, as it should be.
let machine: MachineState = initialState()
const timers = new Map<TimerName, { id: number; timer: Timer }>()
let writes: Promise<unknown> = Promise.resolve()
let anonymousCalls = 0

// Writes run one after another, in the order asked, never holding up the caller.
function queueWrite(write: () => Promise<unknown>): void {
  writes = writes.then(write).catch(() => undefined)
}

// Steps the machine and carries out its effects. Resolves the engine questions it
// asked (surfaces), for a hook that wants them answered before it passes on.
function dispatch($: EngineInterface, event: Event): Promise<void> {
  const { state, effects } = step(machine, event)
  machine = state
  const asked: Promise<void>[] = []
  for (const effect of effects) {
    const answer = perform($, effect)
    if (answer !== undefined) asked.push(answer)
  }
  return Promise.all(asked).then(() => undefined)
}

function perform($: EngineInterface, effect: Effect): Promise<void> | undefined {
  switch (effect.kind) {
    case 'draw': {
      const shown = { scene: effect.scene, detail: effect.detail }
      queueWrite(() => $.state.set(SCENE, shown))
      return undefined
    }
    case 'frame': {
      const { frame } = effect
      queueWrite(() => $.state.set(FRAME, frame))
      return undefined
    }
    case 'arm': {
      const { timer: name, id, ms, isRepeating } = effect
      timers.get(name)?.timer.cancel()
      const fire = () => void dispatch($, { type: 'timer', timer: name, id })
      timers.set(name, { id, timer: isRepeating ? $.clock.every(ms, fire) : $.clock.after(ms, fire) })
      return undefined
    }
    case 'cancel': {
      const armed = timers.get(effect.timer)
      if (armed?.id === effect.id) {
        armed.timer.cancel()
        timers.delete(effect.timer)
      }
      return undefined
    }
    case 'probeSurfaces':
      return $.session.surfaces().then(
        surfaces => void dispatch($, { type: 'surfaces', hasTerminal: surfaces.includes('terminal') }),
        () => undefined,
      )
    case 'listAgents':
      void $.agent.list().then(
        agents => dispatch($, { type: 'agents', agents: agents.map(agent => ({ id: agent.id, status: agent.status })) }),
        () => undefined,
      )
      return undefined
  }
}

async function updateGauges($: EngineInterface, measured: Measurement): Promise<void> {
  const gauges = readGauges(measured)
  const { value: stored = NO_GAUGES } = await $.state.get(GAUGES)
  if (!sameGauges(stored, gauges)) await $.state.set(GAUGES, gauges)
}

const argsOf = (e: object): Args => e as Args

function chunkEvent(chunk: TurnStepChunk): Event | undefined {
  switch (chunk.kind) {
    case 'thinking':
      return { type: 'thinking' }
    case 'text':
      return { type: 'text', text: chunk.text }
    case 'tool':
      return { type: 'toolBlock', index: chunk.index, tool: chunk.name }
    case 'input':
      return { type: 'input', index: chunk.index, json: chunk.json }
    default:
      return undefined
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ ...COMMAND, immediate: true })
    const { value: stored } = await $.state.get(SCENE)
    const { value: frame = 0 } = await $.state.get(FRAME)
    const { value: typed = false } = await $.state.get(TYPED)
    void dispatch($, {
      type: 'sessionStart',
      ...(stored !== undefined && isSceneId(stored.scene) ? { stored } : {}),
      frame,
      typed,
    })
    try {
      const theme = themeNamed(await $.store.get('theme'))
      if (theme !== undefined) await $.state.set(THEME, theme)
    } catch {
      // No stored theme to load: the current one stays.
    }
    void $.session.usage().then(
      usage => updateGauges($, usage),
      () => undefined,
    )
    return next(e)
  })

  on('command.run', { command: 'nukey' }, async ($, e) => {
    const ask = parseArgs(e.args)
    switch (ask.kind) {
      case 'toggle': {
        const { value: hidden = false } = await $.state.get(HIDDEN)
        await $.state.set(HIDDEN, !hidden)
        return { text: hidden ? reply.shown() : reply.hidden() }
      }
      case 'demo': {
        await $.state.set(HIDDEN, false)
        await dispatch($, { type: 'demo' })
        return { text: reply.demo(DEMO_SCENES.length, TIMING.demoScene / 1000) }
      }
      case 'meter': {
        const { value: meter = true } = await $.state.get(METER)
        await $.state.set(METER, !meter)
        return { text: reply.meter(!meter) }
      }
      case 'details': {
        const { value: details = false } = await $.state.get(DETAILS)
        await $.state.set(DETAILS, !details)
        if (!details) await $.state.set(METER, true)
        return { text: reply.details(!details) }
      }
      case 'commands': {
        const { value: typed = false } = await $.state.get(TYPED)
        await $.state.set(TYPED, !typed)
        await dispatch($, { type: 'typed', typed: !typed })
        return { text: reply.commands(!typed) }
      }
      case 'theme': {
        const { value: current = DEFAULT_THEME } = await $.state.get(THEME)
        const theme = ask.name === undefined ? nextTheme(themeNamed(current) ?? DEFAULT_THEME) : themeNamed(ask.name)
        if (theme === undefined) return { text: reply.noTheme(ask.name ?? '') }
        await $.state.set(THEME, theme)
        try {
          await $.store.set('theme', theme)
        } catch {
          // Not kept for later sessions; it still applies to this one.
        }
        return { text: reply.theme(theme) }
      }
      case 'unknown':
        return { text: reply.unknown(ask.text) }
    }
  })

  on('session.measure', async ($, e, next) => {
    try {
      await updateGauges($, e)
    } catch {
      // The meter keeps its readings.
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await dispatch($, { type: 'turnStart' })
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      void dispatch($, { type: 'helper', id: e.agentId })
      return yield* next(e)
    }
    void dispatch($, { type: 'stepStart' })
    for await (const chunk of next(e)) {
      const event = chunkEvent(chunk)
      if (event !== undefined) {
        try {
          void dispatch($, event)
        } catch {
          // The scene never holds up or breaks the stream.
        }
      }
      yield chunk
    }
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const args = argsOf(e)
    if (e.agentId !== undefined) {
      const scene = isHandback(tool) ? undefined : classifyTool(tool, args)
      void dispatch($, { type: 'helper', id: e.agentId, ...(scene !== undefined ? { scene } : {}) })
      return next(e)
    }
    anonymousCalls += 1
    const id = typeof e.tool_use_id === 'string' && e.tool_use_id !== '' ? e.tool_use_id : `nukey-${anonymousCalls}`
    void dispatch($, { type: 'callStart', id, tool, args })
    let result
    try {
      result = await next(e)
    } catch (error) {
      void dispatch($, { type: 'callEnd', id, tool, args, hasFailed: true })
      throw error
    }
    void dispatch($, { type: 'callEnd', id, tool, args, hasFailed: result.deny === undefined && result.isError === true })
    return result
  }).catch(($, e, next) => next(e))

  on('classic.PermissionRequest', ($, e, next) => {
    if (e.agent_id === undefined) {
      const id: unknown = (e as { tool_use_id?: unknown }).tool_use_id
      void dispatch($, { type: 'dialog', tool: e.tool_name, ...(typeof id === 'string' ? { id } : {}) })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    void dispatch($, { type: 'compactStart' })
    try {
      return await next(e)
    } finally {
      void dispatch($, { type: 'compactEnd' })
    }
  }).catch(($, e, next) => next(e))

  on('classic.SubagentStart', ($, e, next) => {
    void dispatch($, { type: 'helper', id: e.agent_id })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result.agentId !== undefined) {
      const purpose = e.description === '' ? e.subagentType : e.description
      void dispatch($, { type: 'helper', id: result.agentId, purpose })
    }
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', ($, e, next) => {
    if (e.agentId !== undefined) void dispatch($, { type: 'helperGone', id: e.agentId })
    else void dispatch($, { type: 'turnEnd', reason: e.reason, isAborted: e.isAborted })
    return next(e)
  })

  on('session.end', ($, e, next) => {
    void dispatch($, { type: 'sessionEnd' })
    return next(e)
  })

  on('classic.Stop', ($, e, next) => {
    const tasks: BackgroundTask[] = (e.background_tasks ?? []).map(task => ({
      type: task.type,
      description: task.description,
      ...(task.command !== undefined ? { command: task.command } : {}),
    }))
    void dispatch($, { type: 'stop', tasks })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    const { value: hidden = false } = await $.state.get(HIDDEN)
    if (hidden) return next(e)

    const { value: shown } = await $.state.get(SCENE)
    const { value: frame = 0 } = await $.state.get(FRAME)
    const { value: gauges = NO_GAUGES } = await $.state.get(GAUGES)
    const { value: isMeterOn = true } = await $.state.get(METER)
    const { value: isDetailsOn = false } = await $.state.get(DETAILS)
    const { value: themeName } = await $.state.get(THEME)
    const scene: SceneId = shown !== undefined && isSceneId(shown.scene) ? shown.scene : 'idle'
    const detail = shown !== undefined && isSceneId(shown.scene) ? shown.detail.replace(/\s/g, ' ') : ''
    const theme = THEMES[themeNamed(themeName) ?? DEFAULT_THEME]
    const label = LABELS[scene]
    const isShort = detail.length <= SHORT_DETAIL
    const readings = panelReadings(gauges)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" gap={2} width="100%">
          <Box key="nukey" flexDirection="column" flexShrink={0}>
            {terminalNukey(scene, frame).map(row => (
              <Text color={theme.terminal}>{row}</Text>
            ))}
          </Box>
          <Box key="prop" flexDirection="column" flexShrink={0}>
            {terminalProp(scene, frame).map(row => (
              <Text dimColor>{row === '' ? ' ' : row}</Text>
            ))}
          </Box>
          <Box key="scene" flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
            {isShort ? <Text> </Text> : null}
            <Text bold wrap="truncate-end">
              {label}
            </Text>
            <Text dimColor wrap={isShort ? 'truncate-end' : 'wrap'}>
              {detail === '' ? ' ' : detail}
            </Text>
          </Box>
          {isMeterOn ? (
            <Box key="meter" flexDirection="column" flexShrink={0}>
              <Text> </Text>
              <Text color={theme.terminal}>{panelRow(gauges)}</Text>
            </Box>
          ) : null}
          {isMeterOn && isDetailsOn ? readingsTable({ Box, Text }, readings) : null}
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={2} alignItems="center" width="100%">
        <Box key="art" flexDirection="row" flexShrink={0}>
          <Svg source={drawNukey(scene, theme)} alt={NUKEY_ALT} width={60} height={64} isInteractive />
          <Svg source={drawProp(scene, theme)} alt={detail === '' ? label : `${label}: ${detail}`} width={68} height={64} isInteractive />
        </Box>
        <Box key="scene" flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          <Text bold wrap="truncate-end">
            {label}
          </Text>
          {detail === '' ? null : (
            <Text dimColor wrap={isShort ? 'truncate-end' : 'wrap'}>
              {detail}
            </Text>
          )}
        </Box>
        {isMeterOn ? (
          <Box key="meter" flexShrink={0}>
            <Svg source={drawPanel(gauges, theme)} alt={panelAlt(gauges)} width={panelWidth(gauges)} height={64} />
          </Box>
        ) : null}
        {isMeterOn && isDetailsOn ? readingsTable({ Box, Text }, readings) : null}
      </Box>
    )
  })
}

type Table = { Box: ElementConstructor<BoxProps>; Text: ElementConstructor<TextProps> }

// Labels dimmed in one column, values bold and right-aligned in the next.
function readingsTable({ Box, Text }: Table, readings: readonly { label: string; value: string }[]): RenderElement {
  return (
    <Box key="readings" flexDirection="row" gap={2} flexShrink={0}>
      <Box flexDirection="column">
        {readings.map(row => (
          <Text dimColor>{row.label}</Text>
        ))}
      </Box>
      <Box flexDirection="column" alignItems="flex-end">
        {readings.map(row => (
          <Text bold>{row.value}</Text>
        ))}
      </Box>
    </Box>
  )
}
