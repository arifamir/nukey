// The scene state machine: `step(state, event)` answers the next state and the
// effects the hook layer carries out (draw a scene, arm or cancel a timer, ask
// the engine something). It owns every timing decision; timers come back to it
// as `timer` events. Pure: no `$`, no clock, no module state.
import type { SceneId } from '../types'
import { type Args, classifyTool, isToldByArgs, takesUpDesignWork } from './classify'
import { type BackgroundTask, type Helper, cut, helperLine, lingeringScene, toolDetail } from './detail'
import { DEMO_SCENES, TIMING } from './scenes'
import { settleBlock, streamDetail } from './stream'

export type TimerName = 'hold' | 'think' | 'rest' | 'throttle' | 'tick' | 'demo'

export type Shown = { scene: SceneId; detail: string }
type Request = Shown & { hold: number }
type Call = { tool: string; scene: SceneId; detail: string }
type Block = { tool: string; json: string; scene?: SceneId }
type Dialog = { tool: string; id?: string }

export type MachineState = {
  readonly working: boolean
  readonly designWork: boolean
  readonly typed: boolean // "commands as typed", as the preference stands
  readonly stepTyped: boolean // the same, read once at the start of each model response
  readonly calls: ReadonlyMap<string, Call> // running main-loop calls, in the order they began
  readonly dialog?: Dialog
  readonly lingering: readonly BackgroundTask[]
  readonly helpers: ReadonlyMap<string, Helper> // in the order first noted
  readonly helpersChanged: boolean
  readonly blocks: ReadonlyMap<number, Block> // streaming blocks told by their arguments
  readonly drawn?: Request
  readonly held: readonly Request[]
  readonly unheld?: Request
  readonly frame: number
  readonly demo?: number // the demo scene showing
  readonly timers: Readonly<Record<TimerName, number | undefined>> // armed timers by generation
  readonly nextTimer: number
}

export type Event =
  | { type: 'sessionStart'; stored?: Shown; frame: number; typed: boolean }
  | { type: 'sessionEnd' }
  | { type: 'turnStart' }
  | { type: 'turnEnd'; reason: string; isAborted: boolean }
  | { type: 'stepStart' }
  | { type: 'thinking' }
  | { type: 'text'; text: string }
  | { type: 'toolBlock'; index: number; tool: string }
  | { type: 'input'; index: number; json: string }
  | { type: 'callStart'; id: string; tool: string; args?: Args }
  | { type: 'callEnd'; id: string; tool: string; args?: Args; hasFailed: boolean }
  | { type: 'dialog'; tool: string; id?: string }
  | { type: 'compactStart' }
  | { type: 'compactEnd' }
  | { type: 'stop'; tasks: readonly BackgroundTask[] }
  | { type: 'agents'; agents: readonly { id: string; status: string }[] }
  | { type: 'helper'; id: string; scene?: SceneId; purpose?: string }
  | { type: 'helperGone'; id: string }
  | { type: 'surfaces'; hasTerminal: boolean }
  | { type: 'typed'; typed: boolean }
  | { type: 'demo' }
  | { type: 'timer'; timer: TimerName; id: number }

export type Effect =
  | { kind: 'draw'; scene: SceneId; detail: string }
  | { kind: 'frame'; frame: number }
  | { kind: 'arm'; timer: TimerName; id: number; ms: number; isRepeating: boolean }
  | { kind: 'cancel'; timer: TimerName; id: number }
  | { kind: 'probeSurfaces' } // answer with a `surfaces` event
  | { kind: 'listAgents' } // answer with an `agents` event

export type Step = { state: MachineState; effects: Effect[] }

const NO_TIMERS: Record<TimerName, number | undefined> = {
  hold: undefined,
  think: undefined,
  rest: undefined,
  throttle: undefined,
  tick: undefined,
  demo: undefined,
}

export function initialState(): MachineState {
  return {
    working: false,
    designWork: false,
    typed: false,
    stepTyped: false,
    calls: new Map(),
    lingering: [],
    helpers: new Map(),
    helpersChanged: false,
    blocks: new Map(),
    held: [],
    frame: 0,
    timers: NO_TIMERS,
    nextTimer: 1,
  }
}

// A working copy of the state that the rules below change in place; `step` hands
// back the copy, never touching the state it was given.
type Draft = {
  -readonly [K in keyof MachineState]: MachineState[K] extends ReadonlyMap<infer Key, infer Value>
    ? Map<Key, Value>
    : MachineState[K] extends Readonly<Record<TimerName, number | undefined>>
      ? Record<TimerName, number | undefined>
      : MachineState[K] extends readonly (infer Item)[]
        ? Item[]
        : MachineState[K]
}

class Run {
  readonly effects: Effect[] = []
  constructor(readonly s: Draft) {}

  // --- timers -------------------------------------------------------------

  arm(timer: TimerName, ms: number, isRepeating = false): void {
    this.cancel(timer)
    const id = this.s.nextTimer
    this.s.nextTimer += 1
    this.s.timers[timer] = id
    this.effects.push({ kind: 'arm', timer, id, ms, isRepeating })
  }

  cancel(timer: TimerName): void {
    const id = this.s.timers[timer]
    if (id === undefined) return
    this.s.timers[timer] = undefined
    this.effects.push({ kind: 'cancel', timer, id })
  }

  isArmed(timer: TimerName): boolean {
    return this.s.timers[timer] !== undefined
  }

  // --- showing a scene, with holds and a queue ----------------------------

  show(scene: SceneId, detail: string, hold = 0): void {
    if (this.s.demo !== undefined) return
    const line = scene === 'delegating' && this.s.helpers.size > 0 ? helperLine([...this.s.helpers.values()]) : detail
    const request: Request = { scene, detail: line, hold }
    if (this.isArmed('hold')) {
      if (hold > 0) {
        this.s.held = [...this.s.held, request].slice(-TIMING.heldQueue)
        this.s.unheld = undefined
      } else {
        this.s.unheld = request
      }
      return
    }
    this.draw(request)
  }

  // Draws at once, past the demo and any hold.
  draw(request: Request): void {
    const { drawn } = this.s
    if (drawn === undefined || drawn.scene !== request.scene || drawn.detail !== request.detail) {
      this.effects.push({ kind: 'draw', scene: request.scene, detail: request.detail })
    }
    this.s.drawn = request
    if (request.hold > 0) this.arm('hold', request.hold)
  }

  holdEnded(): void {
    const [next, ...rest] = this.s.held
    if (next !== undefined) {
      this.s.held = rest
      this.draw(next)
    } else if (this.s.unheld !== undefined) {
      const unheld = this.s.unheld
      this.s.unheld = undefined
      this.draw(unheld)
    }
  }

  // Nothing from before shows after.
  flush(): void {
    this.cancel('hold')
    this.s.held = []
    this.s.unheld = undefined
  }

  // --- what the session is doing now ---------------------------------------

  latestCall(): Call | undefined {
    return [...this.s.calls.values()].at(-1)
  }

  // The running call that began last, or thinking.
  showLive(): void {
    const call = this.latestCall()
    if (call === undefined) this.show('thinking', '')
    else this.show(call.scene, call.detail)
  }

  restore(): void {
    if (this.s.working) this.showLive()
    else this.settle()
  }

  // The scene between turns: helpers at work, background work, or rest.
  settle(): void {
    if (this.s.helpers.size > 0) {
      this.show('delegating', '')
      return
    }
    // Helpers are tracked directly: a subagent the Stop event listed has ended by now.
    const lingering = lingeringScene(this.s.lingering.filter(task => task.type !== 'subagent'))
    if (lingering === undefined) {
      if (this.s.demo === undefined) this.stopTick()
      this.show('idle', '')
    } else {
      this.show(lingering.scene, cut(lingering.detail))
    }
  }

  startTick(): void {
    if (!this.isArmed('tick')) this.arm('tick', TIMING.frame, true)
  }

  stopTick(): void {
    this.cancel('tick')
  }

  // --- helpers -------------------------------------------------------------

  noteHelper(id: string, scene?: SceneId, purpose?: string): void {
    const known = this.s.helpers.get(id)
    const next: Helper = {
      scene: scene ?? known?.scene ?? 'thinking',
      ...(purpose !== undefined ? { purpose } : known?.purpose !== undefined ? { purpose: known.purpose } : {}),
    }
    if (known !== undefined && known.scene === next.scene && known.purpose === next.purpose) return
    this.s.helpers.set(id, next)
    this.helpersChanged()
  }

  forgetHelper(id: string): void {
    if (this.s.helpers.delete(id)) this.helpersChanged()
  }

  // Redraws the helper display at most once per throttle window, plus once at its end.
  helpersChanged(): void {
    if (this.isArmed('throttle')) {
      this.s.helpersChanged = true
      return
    }
    this.redrawHelpers()
    this.arm('throttle', TIMING.helperThrottle)
  }

  throttleEnded(): void {
    if (!this.s.helpersChanged) return
    this.s.helpersChanged = false
    this.redrawHelpers()
    this.arm('throttle', TIMING.helperThrottle)
  }

  redrawHelpers(): void {
    if (!this.s.working) {
      // While done or error is up after a turn, the helpers wait for the rest timer.
      if (!this.isArmed('rest')) this.settle()
      return
    }
    if (this.s.drawn?.scene !== 'delegating') return
    if (this.s.helpers.size > 0) this.show('delegating', '')
    else this.showLive()
  }

  // --- the demo -------------------------------------------------------------

  startDemo(): void {
    this.cancel('demo')
    this.s.demo = undefined
    this.flush()
    this.s.demo = 0
    this.draw({ scene: DEMO_SCENES[0] ?? 'thinking', detail: 'demo', hold: 0 })
    this.arm('demo', TIMING.demoScene, true)
    if (!this.isArmed('tick')) this.effects.push({ kind: 'probeSurfaces' })
  }

  demoTick(): void {
    const at = (this.s.demo ?? 0) + 1
    const scene = DEMO_SCENES[at]
    if (scene !== undefined) {
      this.s.demo = at
      this.draw({ scene, detail: 'demo', hold: 0 })
      return
    }
    this.cancel('demo')
    this.s.demo = undefined
    this.restore()
  }
}

const draft = (state: MachineState): Draft => ({
  ...state,
  calls: new Map(state.calls),
  helpers: new Map(state.helpers),
  blocks: new Map(state.blocks),
  lingering: [...state.lingering],
  held: [...state.held],
  timers: { ...state.timers },
})

export function step(state: MachineState, event: Event): Step {
  const run = new Run(draft(state))
  const { s } = run
  switch (event.type) {
    case 'sessionStart': {
      s.frame = event.frame
      s.typed = event.typed
      s.stepTyped = event.typed
      if (event.stored !== undefined) s.drawn = { ...event.stored, hold: 0 }
      // A scene that was on its way to rest when the module (re)loaded rests now.
      if (event.stored?.scene === 'done' || event.stored?.scene === 'error') run.show('idle', '')
      break
    }

    case 'sessionEnd': {
      for (const timer of ['think', 'rest', 'tick', 'demo', 'throttle'] as const) run.cancel(timer)
      s.demo = undefined
      run.flush()
      s.working = false
      s.designWork = false
      s.calls.clear()
      s.dialog = undefined
      s.lingering = []
      s.helpers.clear()
      s.helpersChanged = false
      s.blocks.clear()
      run.draw({ scene: 'idle', detail: '', hold: 0 })
      break
    }

    case 'turnStart': {
      run.cancel('think')
      run.cancel('rest')
      s.working = true
      s.designWork = false
      s.calls.clear()
      s.dialog = undefined
      run.flush()
      run.show('thinking', '')
      if (!run.isArmed('tick')) run.effects.push({ kind: 'probeSurfaces' })
      break
    }

    case 'surfaces': {
      // The terminal needs the frame tick; the desktop drawings animate on their own.
      if (event.hasTerminal && (s.working || s.demo !== undefined)) run.startTick()
      break
    }

    case 'turnEnd': {
      run.cancel('think')
      run.cancel('rest')
      s.working = false
      s.calls.clear()
      s.dialog = undefined
      s.blocks.clear()
      run.flush()
      if (event.isAborted || event.reason === 'aborted') {
        run.settle()
        break
      }
      run.show(event.reason === 'answer' ? 'done' : 'error', '')
      run.arm('rest', TIMING.rest)
      break
    }

    case 'stepStart': {
      s.blocks.clear()
      s.stepTyped = s.typed
      if (!s.working) {
        // A module reload mid-turn has no turn.start: the step says the turn runs.
        s.working = true
        if (!run.isArmed('tick')) run.effects.push({ kind: 'probeSurfaces' })
      }
      break
    }

    case 'thinking': {
      if (!run.isArmed('think') && s.calls.size === 0) run.show('thinking', '')
      break
    }

    case 'text': {
      if (event.text.trim() === '') break
      run.cancel('think')
      run.show('talking', '')
      break
    }

    case 'toolBlock': {
      run.cancel('think')
      if (isToldByArgs(event.tool)) s.blocks.set(event.index, { tool: event.tool, json: '' })
      else run.show(classifyTool(event.tool), '')
      break
    }

    case 'input': {
      const block = s.blocks.get(event.index)
      if (block === undefined) break
      const json = block.json + event.json
      const scene = block.scene ?? settleBlock(block.tool, json, s.designWork)
      s.blocks.set(event.index, { ...block, json, ...(scene !== undefined ? { scene } : {}) })
      if (scene === undefined) break
      const detail = streamDetail(json, s.stepTyped)
      if (detail !== undefined) {
        run.show(scene, detail)
        s.blocks.delete(event.index)
      } else if (block.scene === undefined) {
        run.show(scene, '')
      }
      break
    }

    case 'callStart': {
      if (takesUpDesignWork(event.tool, event.args)) s.designWork = true
      const scene = classifyTool(event.tool, event.args, s.designWork)
      const detail = toolDetail(event.tool, event.args, s.typed)
      s.calls.delete(event.id)
      s.calls.set(event.id, { tool: event.tool, scene, detail })
      run.cancel('think')
      run.show(scene, detail, TIMING.callHold)
      break
    }

    case 'callEnd': {
      const call = s.calls.get(event.id) ?? {
        tool: event.tool,
        scene: classifyTool(event.tool, event.args, s.designWork),
        detail: toolDetail(event.tool, event.args, s.typed),
      }
      s.calls.delete(event.id)
      const { dialog } = s
      // A dialog is matched to its call by id when it carried one, else by tool name.
      const hadDialog = dialog !== undefined && (dialog.id !== undefined ? dialog.id === event.id : dialog.tool === event.tool)
      if (hadDialog) s.dialog = undefined
      if (!s.working) break // a late return after the turn ended changes nothing
      if (event.hasFailed) run.show('error', call.detail, TIMING.errorHold)
      if (s.dialog !== undefined) break // another dialog keeps the scene
      if (s.calls.size > 0) {
        run.showLive()
        break
      }
      if (hadDialog && !event.hasFailed) run.show(call.scene, call.detail)
      run.arm('think', TIMING.backToThinking)
      break
    }

    case 'dialog': {
      s.dialog = { tool: event.tool, ...(event.id !== undefined ? { id: event.id } : {}) }
      if (classifyTool(event.tool) === 'asking' || event.tool === 'ExitPlanMode') run.show('asking', '')
      else run.show('permission', event.tool)
      break
    }

    case 'compactStart': {
      run.show('compacting', '', TIMING.callHold)
      break
    }

    case 'compactEnd': {
      run.restore()
      break
    }

    case 'stop': {
      s.lingering = [...event.tasks]
      if (s.helpers.size > 0) run.effects.push({ kind: 'listAgents' })
      if (!s.working && !run.isArmed('rest')) run.settle()
      break
    }

    case 'agents': {
      if (s.helpers.size === 0) break
      const isWorkflowLingering = s.lingering.some(task => task.type === 'workflow')
      const listed = new Map(event.agents.map(agent => [agent.id, agent.status]))
      for (const id of [...s.helpers.keys()]) {
        const status = listed.get(id)
        if (status !== undefined ? status !== 'running' : !isWorkflowLingering) run.forgetHelper(id)
      }
      break
    }

    case 'helper': {
      run.noteHelper(event.id, event.scene, event.purpose)
      break
    }

    case 'helperGone': {
      run.forgetHelper(event.id)
      break
    }

    case 'typed': {
      s.typed = event.typed
      break
    }

    case 'demo': {
      run.startDemo()
      break
    }

    case 'timer': {
      if (s.timers[event.timer] !== event.id) break // cancelled or replaced meanwhile
      if (event.timer !== 'tick' && event.timer !== 'demo') s.timers[event.timer] = undefined
      switch (event.timer) {
        case 'hold':
          run.holdEnded()
          break
        case 'think':
          if (s.working && s.calls.size === 0) run.show('thinking', '')
          break
        case 'rest':
          if (!s.working) run.settle()
          break
        case 'throttle':
          run.throttleEnded()
          break
        case 'tick':
          s.frame = (s.frame + 1) % TIMING.frames
          run.effects.push({ kind: 'frame', frame: s.frame })
          break
        case 'demo':
          run.demoTick()
          break
      }
      break
    }
  }
  return { state: s, effects: run.effects }
}
