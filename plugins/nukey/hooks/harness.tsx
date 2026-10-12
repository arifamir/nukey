// What the engine-level tests share: the engine beneath the plugin, answered from
// memory, and readers for the band. Imported by *.test.tsx files only.
import type { AgentInfo, On, RenderSurface, SessionUsage, ToolCallResult, TurnStepChunk } from 'claude-code'
import { type Engine, type MockClock, mock } from 'claude-code/testing'

export const SURFACES = ['terminal', 'desktop'] as const

export const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 140, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const

export type World = {
  clock: MockClock
  store: Record<string, unknown>
  storeWrites: [string, unknown][]
  // What the next model response streams; a `pause` waits for `release()`.
  chunks: (TurnStepChunk | 'pause')[]
  release: () => void
  // Answers a tool call; a pending promise keeps the call running.
  tool: (e: { tool: string; agentId?: string; [key: string]: unknown }) => ToolCallResult | Promise<ToolCallResult>
  agents: AgentInfo[]
  surfaces: RenderSurface[]
  usage: SessionUsage
  spawned: string
}

type Given = Partial<Pick<World, 'store' | 'surfaces' | 'usage' | 'agents'>> & {
  // Engine answers the test gives itself instead.
  skip?: readonly ('command.register' | 'store.set')[]
}

export function world(on: On, given: Given = {}): World {
  let release: () => void = () => undefined
  const w: World = {
    clock: mock.clock(on, { now: 1_000_000 }),
    store: { ...given.store },
    storeWrites: [],
    chunks: [],
    release: () => release(),
    tool: () => ({ result: 'ok', text: 'ok' }),
    agents: given.agents ?? [],
    surfaces: given.surfaces ?? ['terminal'],
    usage: given.usage ?? { startedAt: 0, context: { window: 200_000 }, rateLimits: [] },
    spawned: 'h1',
  }
  on('store.get', ($, e) => ({ value: w.store[e.key] }))
  if (!given.skip?.includes('store.set')) {
    on('store.set', ($, e) => {
      w.store[e.key] = e.value
      w.storeWrites.push([e.key, e.value])
      return { value: undefined }
    })
  }
  if (!given.skip?.includes('command.register')) on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.usage', () => ({ value: w.usage }))
  on('session.surfaces', () => ({ value: w.surfaces }))
  on('agent.list', () => ({ value: w.agents }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.spawn', () => ({ model: 'm', agentId: w.spawned }))
  on('classic.Stop', () => ({}))
  on('classic.PermissionRequest', () => ({}))
  on('classic.SubagentStart', () => ({}))
  on('tool.call', ($, e) => w.tool(e as { tool: string }))
  on('turn.step', async function* ($, e) {
    for (const chunk of w.chunks) {
      if (chunk === 'pause') await new Promise<void>(resolve => (release = resolve))
      else yield chunk
    }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return w
}

export const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const

export async function startSession($: Engine): Promise<void> {
  await $.session.start(START)
}

export const turnStart = ($: Engine, turnId = 't1') => $.turn.start({ text: 'go', turnId })

export const turnEnd = ($: Engine, reason: 'answer' | 'aborted' | 'error' = 'answer', agentId?: string) =>
  $.turn.complete({
    turnId: 't1',
    reason,
    isAborted: reason === 'aborted',
    answer: '',
    durationMs: 0,
    ...(agentId !== undefined ? { agentId } : {}),
  } as Parameters<Engine['turn']['complete']>[0])

// Streams one model response through the plugin, chunk by chunk.
export async function streamStep($: Engine, w: World, chunks: World['chunks']): Promise<TurnStepChunk[]> {
  w.chunks = chunks
  const seen: TurnStepChunk[] = []
  for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })) seen.push(chunk)
  return seen
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

export function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  const children = (node as Node | undefined)?.children
  return Array.isArray(children) ? children.map(textOf).join('') : ''
}

// Walks a drawn tree, depth first.
export function walk(node: unknown, visit: (node: Node) => void): void {
  if (node === null || typeof node !== 'object') return
  visit(node as Node)
  for (const child of (node as Node).children ?? []) walk(child, visit)
}

export type Band = {
  label: string
  detail: string
  // The rows of the label column on the terminal, blank row included.
  column: string[]
  alts: string[]
  sources: string[]
  colors: string[]
  texts: string[]
  isEngine: boolean
}

type Mounted = { drawn: () => Promise<unknown> }

// Reads the band as drawn now, after letting pending work settle.
export async function readBand(ui: Mounted, w: World): Promise<Band> {
  await w.clock.settle()
  const tree = await ui.drawn()
  const band: Band = { label: '', detail: '', column: [], alts: [], sources: [], colors: [], texts: [], isEngine: false }
  walk(tree, node => {
    if (node.type === 'Svg') {
      band.alts.push(String(node.props?.alt))
      band.sources.push(String(node.props?.source))
    }
    if (node.type === 'Text') {
      band.texts.push(textOf(node))
      if (typeof node.props?.color === 'string') band.colors.push(node.props.color)
    }
    if (node.type === 'Box' && node.props?.key === 'scene') {
      for (const child of node.children ?? []) {
        const text = textOf(child)
        band.column.push(text)
        const props = (child as Node).props ?? {}
        if (props.bold === true) band.label = text
        else if (props.dimColor === true) band.detail = text.trim()
      }
    }
  })
  band.isEngine = band.texts.length === 1 && band.texts[0] === 'engine'
  return band
}

// Lets a call run until the test settles it: resolves with what `finish` is given.
export function pending(): { result: Promise<ToolCallResult>; finish: (result?: ToolCallResult) => void } {
  let finish: (result?: ToolCallResult) => void = () => undefined
  const result = new Promise<ToolCallResult>(resolve => {
    finish = (answer = { result: 'ok', text: 'ok' }) => resolve(answer)
  })
  return { result, finish }
}

// A second plugin that reads Nukey's shared values back for the test, as any
// plugin may: `/peek <key>` answers the value as JSON and its version.
export const PEEK = {
  name: 'peek',
  register: (on: On) => {
    on('session.start', async ($, e, next) => {
      await $.command.register({ name: 'peek', description: 'Reads a value of Nukey.' })
      return next(e)
    })
    on('command.run', { command: 'peek' }, async ($, e) => {
      const reads: Record<string, () => Promise<{ value?: unknown; version: number }>> = {
        scene: () => $.state.get({ plugin: 'nukey', key: 'scene' }),
        hidden: () => $.state.get({ plugin: 'nukey', key: 'hidden' }),
        frame: () => $.state.get({ plugin: 'nukey', key: 'frame' }),
        gauges: () => $.state.get({ plugin: 'nukey', key: 'gauges' }),
        meter: () => $.state.get({ plugin: 'nukey', key: 'meter' }),
        details: () => $.state.get({ plugin: 'nukey', key: 'details' }),
        typed: () => $.state.get({ plugin: 'nukey', key: 'typed' }),
        theme: () => $.state.get({ plugin: 'nukey', key: 'theme' }),
      }
      const read = await (reads[e.args] ?? reads.scene)?.()
      return { text: JSON.stringify({ value: read?.value ?? null, version: read?.version ?? 0 }) }
    })
  },
}

export type Key = 'scene' | 'hidden' | 'frame' | 'gauges' | 'meter' | 'details' | 'typed' | 'theme'

// Runs a slash command as the person typing it would.
export const runCommand = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

// Raises a compaction of the main conversation, or of a helper's with `agentId`.
export const compact = ($: Engine, more: { trigger?: 'manual' | 'auto' | 'precompute'; agentId?: string } = {}) =>
  $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'so far', toolUses: [] }], ...more })

export async function peek($: Engine, key: Key): Promise<{ value: unknown; version: number }> {
  const answer = await runCommand($, 'peek', key)
  return JSON.parse(answer.text ?? '{}') as { value: unknown; version: number }
}

export const value = async ($: Engine, key: Key): Promise<unknown> => (await peek($, key)).value
