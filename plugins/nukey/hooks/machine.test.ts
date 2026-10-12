import { describe, expect, test } from 'claude-code/testing'
import type { SceneId } from '../types'
import { type Event, type MachineState, type Shown, type TimerName, initialState, step } from './machine'
import { DEMO_SCENES } from './scenes'

// Drives the pure machine on a clock of its own: timers armed by its effects fire
// as the time is advanced, in the order they come due.
class Sim {
  state: MachineState = initialState()
  now = 0
  shown: Shown = { scene: 'idle', detail: '' }
  draws: (Shown & { at: number })[] = []
  probes = 0
  agentLists = 0
  readonly timers = new Map<TimerName, { id: number; due: number; every?: number }>()

  send(event: Event): this {
    const { state, effects } = step(this.state, event)
    this.state = state
    for (const effect of effects) {
      switch (effect.kind) {
        case 'draw':
          this.shown = { scene: effect.scene, detail: effect.detail }
          this.draws.push({ ...this.shown, at: this.now })
          break
        case 'arm':
          this.timers.set(effect.timer, {
            id: effect.id,
            due: this.now + effect.ms,
            ...(effect.isRepeating ? { every: effect.ms } : {}),
          })
          break
        case 'cancel':
          if (this.timers.get(effect.timer)?.id === effect.id) this.timers.delete(effect.timer)
          break
        case 'probeSurfaces':
          this.probes += 1
          break
        case 'listAgents':
          this.agentLists += 1
          break
        case 'frame':
          break
      }
    }
    return this
  }

  advance(ms: number): this {
    const end = this.now + ms
    for (;;) {
      let next: [TimerName, { id: number; due: number; every?: number }] | undefined
      for (const entry of this.timers) if (entry[1].due <= end && (next === undefined || entry[1].due < next[1].due)) next = entry
      if (next === undefined) break
      const [name, timer] = next
      this.now = timer.due
      if (timer.every !== undefined) this.timers.set(name, { ...timer, due: timer.due + timer.every })
      else this.timers.delete(name)
      this.send({ type: 'timer', timer: name, id: timer.id })
    }
    this.now = end
    return this
  }

  get scene(): SceneId {
    return this.shown.scene
  }

  // A main-loop call that starts and returns at once.
  call(id: string, tool: string, args: Record<string, unknown> = {}, hasFailed = false): this {
    this.send({ type: 'callStart', id, tool, args })
    return this.send({ type: 'callEnd', id, tool, args, hasFailed })
  }
}

const turn = () => new Sim().send({ type: 'turnStart' })

describe('holds and the queue', () => {
  test('a call that returns at once still shows for 1200 ms', () => {
    const sim = turn().call('r', 'Read', { file_path: '/a/b.ts' })
    sim.send({ type: 'text', text: 'Here it is' })
    expect(sim.shown).toEqual({ scene: 'reading', detail: 'b.ts' })
    sim.advance(1199)
    expect(sim.scene).toBe('reading')
    sim.advance(1)
    expect(sim.scene).toBe('talking')
  })

  test('a failed call shows the error with its detail for 2500 ms', () => {
    const sim = turn().call('b', 'Bash', { command: 'make', description: 'Build it' }, true)
    sim.advance(1200)
    expect(sim.shown).toEqual({ scene: 'error', detail: 'Build it' })
    sim.send({ type: 'text', text: 'It failed.' })
    sim.advance(2499)
    expect(sim.scene).toBe('error')
    sim.advance(1)
    expect(sim.scene).toBe('talking')
  })

  test('only the 3 most recent held requests show, in order, then the latest unheld one', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: '1', tool: 'Read', args: { file_path: 'a' } })
    sim.send({ type: 'text', text: 'one' }) // unheld, then discarded by the held ones
    for (const [id, tool] of [['2', 'Grep'], ['3', 'WebFetch'], ['4', 'TodoWrite'], ['5', 'Skill']] as const) {
      sim.send({ type: 'callStart', id, tool })
    }
    sim.send({ type: 'thinking' }) // a call is running: no thinking
    sim.send({ type: 'text', text: 'last words' })
    const seen: SceneId[] = []
    for (let at = 0; at < 6; at += 1) {
      seen.push(sim.scene)
      sim.advance(1200)
    }
    expect(seen).toEqual(['reading', 'web', 'planning', 'skill', 'talking', 'talking'])
  })

  test('nothing from before a turn shows after it starts', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: '1', tool: 'Read' })
    sim.send({ type: 'callStart', id: '2', tool: 'Grep' })
    sim.send({ type: 'turnStart' })
    expect(sim.scene).toBe('thinking')
    sim.advance(5000)
    expect(sim.scene).toBe('thinking')
  })
})

describe('calls in a turn', () => {
  test('a long call stays after a short one plays out', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'agent', tool: 'Agent', args: { description: 'Review the diff' } })
    sim.call('read', 'Read', { file_path: 'x.ts' })
    sim.advance(1200)
    expect(sim.scene).toBe('reading')
    sim.advance(1200)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: 'Review the diff' })
    sim.advance(600)
    expect(sim.scene).toBe('delegating')
    sim.advance(10_000)
    expect(sim.scene).toBe('delegating')
  })

  test('5000 ms after the last call returned, thinking; a new call first cancels that', () => {
    const sim = turn().call('r', 'Read')
    sim.send({ type: 'thinking' }) // the timer is pending: the tool's scene stays
    sim.advance(4999)
    expect(sim.scene).toBe('reading')
    sim.advance(1)
    expect(sim.scene).toBe('thinking')

    const other = turn().call('r', 'Read')
    other.advance(3000)
    other.send({ type: 'callStart', id: 'g', tool: 'Grep' })
    other.advance(2500)
    expect(other.scene).toBe('searching')
  })

  test('a text chunk cancels the return to thinking; whitespace changes nothing', () => {
    const sim = turn().call('r', 'Read')
    sim.advance(1200)
    sim.send({ type: 'text', text: ' \n ' })
    expect(sim.scene).toBe('reading')
    sim.send({ type: 'text', text: 'Done reading.' })
    expect(sim.scene).toBe('talking')
    sim.advance(10_000)
    expect(sim.scene).toBe('talking')
  })

  test('an interrupted turn rests, and a late failed return changes nothing', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'b', tool: 'Bash', args: { command: 'sleep 100' } })
    sim.send({ type: 'turnEnd', reason: 'aborted', isAborted: true })
    sim.send({ type: 'callEnd', id: 'b', tool: 'Bash', args: { command: 'sleep 100' }, hasFailed: true })
    sim.advance(5000)
    expect(sim.scene).toBe('idle')
    expect(sim.draws.some(draw => draw.scene === 'error')).toBe(false)
  })

  test('design work taken up in a turn lasts for that turn only', () => {
    const sim = turn()
    sim.call('s', 'Skill', { skill: 'artifact-design' })
    sim.send({ type: 'callStart', id: 'w', tool: 'Write', args: { file_path: '/s/tide-table.html' } })
    sim.advance(1200)
    expect(sim.shown).toEqual({ scene: 'designing', detail: 'tide-table.html' })
    sim.send({ type: 'turnStart' })
    sim.send({ type: 'callStart', id: 'w2', tool: 'Write', args: { file_path: '/s/index.html' } })
    expect(sim.shown).toEqual({ scene: 'coding', detail: 'index.html' })
  })

  test('the commands-as-typed preference picks the detail', () => {
    const sim = turn().send({ type: 'typed', typed: true })
    sim.send({ type: 'callStart', id: 'b', tool: 'Bash', args: { command: 'git status', description: 'Show status' } })
    expect(sim.shown.detail).toBe('git status')
  })
})

describe('dialogs', () => {
  test('permission, then the call scene again, then thinking', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'b', tool: 'Bash', args: { command: 'rm -rf build' } })
    sim.send({ type: 'dialog', tool: 'Bash' })
    sim.advance(1200)
    expect(sim.shown).toEqual({ scene: 'permission', detail: 'Bash' })
    sim.advance(60_000)
    expect(sim.scene).toBe('permission')
    sim.send({ type: 'callEnd', id: 'b', tool: 'Bash', args: { command: 'rm -rf build' }, hasFailed: false })
    expect(sim.shown).toEqual({ scene: 'terminal', detail: 'rm -rf build' })
    sim.advance(5000)
    expect(sim.scene).toBe('thinking')
  })

  test('questions and plans ask', () => {
    expect(turn().send({ type: 'dialog', tool: 'AskUserQuestion' }).shown).toEqual({ scene: 'asking', detail: '' })
    expect(turn().send({ type: 'dialog', tool: 'ExitPlanMode' }).shown).toEqual({ scene: 'asking', detail: '' })
  })

  test('a dialog for one tool keeps the scene when another returns', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'b', tool: 'Bash' })
    sim.send({ type: 'callStart', id: 'r', tool: 'Read' })
    sim.advance(2400)
    sim.send({ type: 'dialog', tool: 'Bash' })
    sim.send({ type: 'callEnd', id: 'r', tool: 'Read', hasFailed: false })
    sim.advance(10_000)
    expect(sim.scene).toBe('permission')
  })

  test('a dialog that carries the call id is matched by id, not by name', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'b1', tool: 'Bash', args: { command: 'ls' } })
    sim.send({ type: 'callStart', id: 'b2', tool: 'Bash', args: { command: 'rm x' } })
    sim.advance(2400)
    sim.send({ type: 'dialog', tool: 'Bash', id: 'b2' })
    sim.send({ type: 'callEnd', id: 'b1', tool: 'Bash', args: { command: 'ls' }, hasFailed: false })
    expect(sim.shown).toEqual({ scene: 'permission', detail: 'Bash' })
    sim.send({ type: 'callEnd', id: 'b2', tool: 'Bash', args: { command: 'rm x' }, hasFailed: false })
    expect(sim.shown).toEqual({ scene: 'terminal', detail: 'rm x' })
  })

  test('without an id, the first call of that tool to return closes it', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'b1', tool: 'Bash', args: { command: 'ls' } })
    sim.send({ type: 'callStart', id: 'b2', tool: 'Bash', args: { command: 'rm x' } })
    sim.advance(2400)
    sim.send({ type: 'dialog', tool: 'Bash' })
    sim.send({ type: 'callEnd', id: 'b1', tool: 'Bash', args: { command: 'ls' }, hasFailed: false })
    expect(sim.shown).toEqual({ scene: 'terminal', detail: 'rm x' })
  })
})

describe('compaction', () => {
  test('shows at least 1200 ms, then the running call, thinking or rest', () => {
    const sim = turn().send({ type: 'compactStart' })
    expect(sim.scene).toBe('compacting')
    sim.send({ type: 'compactEnd' })
    sim.advance(1199)
    expect(sim.scene).toBe('compacting')
    sim.advance(1)
    expect(sim.scene).toBe('thinking')

    const idle = new Sim().send({ type: 'compactStart' }).send({ type: 'compactEnd' }).advance(1200)
    expect(idle.scene).toBe('idle')
  })
})

describe('the end of a turn', () => {
  const stop = (tasks: { type: string; description: string; command?: string }[]): Event => ({ type: 'stop', tasks })

  test('done, then the background task after the rest', () => {
    const sim = turn().send(stop([{ type: 'shell', description: 'Build', command: 'make build' }]))
    sim.send({ type: 'turnEnd', reason: 'answer', isAborted: false })
    expect(sim.shown).toEqual({ scene: 'done', detail: '' })
    sim.advance(7999)
    expect(sim.scene).toBe('done')
    sim.advance(1)
    expect(sim.shown).toEqual({ scene: 'waiting', detail: 'make build' })
  })

  test('nothing lingering: rest, and the tick stops', () => {
    const sim = turn().send({ type: 'surfaces', hasTerminal: true })
    expect(sim.timers.has('tick')).toBe(true)
    sim.send(stop([])).send({ type: 'turnEnd', reason: 'answer', isAborted: false }).advance(9000)
    expect(sim.scene).toBe('idle')
    expect(sim.timers.has('tick')).toBe(false)
  })

  test('any other reason is an error', () => {
    for (const reason of ['error', 'refusal']) {
      expect(turn().send({ type: 'turnEnd', reason, isAborted: false }).scene).toBe('error')
    }
  })

  test('standing tasks are not waited on', () => {
    const watch = { type: 'monitor', description: 'live updates for artifact https://claude.ai/artifact/abc' }
    const one = turn().send(stop([watch])).send({ type: 'turnEnd', reason: 'answer', isAborted: false }).advance(8000)
    expect(one.scene).toBe('idle')
    const two = turn()
      .send(stop([watch, { type: 'shell', description: 'Build', command: 'make build' }]))
      .send({ type: 'turnEnd', reason: 'answer', isAborted: false })
      .advance(8000)
    expect(two.shown).toEqual({ scene: 'waiting', detail: 'make build' })
  })

  test('a lingering workflow delegates; subagents are left to helper tracking', () => {
    const sim = turn()
      .send(stop([{ type: 'workflow', description: 'Audit the release' }, { type: 'subagent', description: 'Review' }]))
      .send({ type: 'turnEnd', reason: 'answer', isAborted: false })
      .advance(8000)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: 'Audit the release' })
    const two = turn()
      .send(stop([{ type: 'shell', description: 'a', command: 'a' }, { type: 'shell', description: 'b', command: 'b' }]))
      .send({ type: 'turnEnd', reason: 'answer', isAborted: false })
      .advance(8000)
    expect(two.shown).toEqual({ scene: 'waiting', detail: '2 tasks in the background' })
  })

  test('a Stop after an interrupted turn settles at once', () => {
    const sim = turn().send({ type: 'turnEnd', reason: 'aborted', isAborted: true })
    sim.send(stop([{ type: 'shell', description: 'Build', command: 'make build' }]))
    expect(sim.shown).toEqual({ scene: 'waiting', detail: 'make build' })
  })
})

describe('helpers', () => {
  test('the helper line follows what helpers do, throttled', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'a', tool: 'Agent', args: { description: 'Review the diff' } })
    sim.send({ type: 'helper', id: 'h1', purpose: 'Review the diff' })
    expect(sim.shown).toEqual({ scene: 'delegating', detail: 'Review the diff' }) // the call's hold
    sim.advance(1200)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: 'Review the diff: thinking' })
    sim.send({ type: 'helper', id: 'h1', scene: 'reading' })
    sim.send({ type: 'helper', id: 'h2', scene: 'testing' })
    sim.advance(1500)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: '2 helpers: 1 reading, 1 running tests' })
    sim.send({ type: 'helper', id: 'h1' }) // a handback: presence only
    sim.send({ type: 'helperGone', id: 'h1' })
    sim.advance(1500)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: '1 helper: running tests' })
  })

  test('at most one redraw at the start and one at the end of each window', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'a', tool: 'Agent', args: { description: 'Many' } })
    sim.advance(1200)
    const before = sim.draws.length
    const scenes: SceneId[] = ['reading', 'searching', 'terminal', 'web', 'coding', 'testing']
    scenes.forEach((scene, n) => sim.send({ type: 'helper', id: `h${n % 3}`, scene }))
    expect(sim.draws.length - before).toBe(1)
    sim.advance(1199)
    expect(sim.draws.length - before).toBe(1)
    sim.advance(1)
    expect(sim.draws.length - before).toBe(2)
    expect(sim.shown.detail).toBe('3 helpers: 1 browsing, 1 writing code, 1 running tests')
    sim.advance(5000)
    expect(sim.draws.length - before).toBe(2)
  })

  test('helpers at work after the turn show once the rest is over, then rest', () => {
    const sim = turn()
    sim.send({ type: 'helper', id: 'h', purpose: '' })
    sim.send({ type: 'helper', id: 'h', scene: 'searching' })
    sim.send({ type: 'stop', tasks: [{ type: 'subagent', description: 'Look around' }] })
    sim.send({ type: 'turnEnd', reason: 'answer', isAborted: false })
    sim.advance(9000)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: '1 helper: searching' })
    sim.send({ type: 'helperGone', id: 'h' })
    sim.advance(1500)
    expect(sim.scene).toBe('idle')
  })

  test('helpers do not change a scene that is not delegating', () => {
    const sim = turn()
    sim.send({ type: 'callStart', id: 'r', tool: 'Read' })
    sim.send({ type: 'helper', id: 'h', scene: 'designing' })
    sim.advance(1500)
    expect(sim.scene).toBe('reading')
    expect(sim.state.designWork).toBe(false)
  })

  test('pruning on Stop', () => {
    const sim = turn()
    for (const id of ['done', 'gone', 'busy']) sim.send({ type: 'helper', id })
    sim.send({ type: 'stop', tasks: [] })
    expect(sim.agentLists).toBe(1)
    sim.send({ type: 'agents', agents: [{ id: 'done', status: 'completed' }, { id: 'busy', status: 'running' }] })
    expect([...sim.state.helpers.keys()]).toEqual(['busy'])

    const flow = turn()
    flow.send({ type: 'helper', id: 'wf-agent' })
    flow.send({ type: 'stop', tasks: [{ type: 'workflow', description: 'Audit' }] })
    flow.send({ type: 'agents', agents: [] })
    expect([...flow.state.helpers.keys()]).toEqual(['wf-agent'])

    const none = turn().send({ type: 'stop', tasks: [] })
    expect(none.agentLists).toBe(0)
  })
})

describe('streaming', () => {
  test('a Bash block shows once its command tells, then again with its description', () => {
    const sim = turn().send({ type: 'stepStart' })
    sim.send({ type: 'toolBlock', index: 1, tool: 'Bash' })
    expect(sim.scene).toBe('thinking')
    sim.send({ type: 'input', index: 1, json: '{"command": "git status --short && git log --oneline -3"' })
    expect(sim.shown).toEqual({ scene: 'git', detail: '' })
    sim.send({ type: 'input', index: 1, json: ', "description": "Show changed files"}' })
    expect(sim.shown).toEqual({ scene: 'git', detail: 'Show changed files' })
  })

  test('a Write block shows its file name', () => {
    const sim = turn().send({ type: 'stepStart' })
    sim.send({ type: 'toolBlock', index: 0, tool: 'Write' })
    sim.send({ type: 'input', index: 0, json: '{"file_path": "/repo/src/tide-' })
    expect(sim.scene).toBe('thinking')
    sim.send({ type: 'input', index: 0, json: 'table.ts", "content": "export' })
    expect(sim.shown).toEqual({ scene: 'coding', detail: 'tide-table.ts' })
  })

  test('tools not told by their arguments show by name at once', () => {
    const sim = turn().send({ type: 'stepStart' })
    sim.send({ type: 'toolBlock', index: 0, tool: 'mcp__figma__x' })
    expect(sim.shown).toEqual({ scene: 'designing', detail: '' })
  })

  test('a thinking chunk right after a tool returned keeps the tool scene', () => {
    const sim = turn().call('r', 'Read')
    sim.advance(1200)
    sim.send({ type: 'stepStart' }).send({ type: 'thinking' })
    expect(sim.scene).toBe('reading')
  })

  test('a step after a module reload marks the turn working and asks for the tick', () => {
    const sim = new Sim().send({ type: 'sessionStart', stored: { scene: 'reading', detail: 'a.ts' }, frame: 7, typed: false })
    expect(sim.draws).toEqual([])
    sim.send({ type: 'stepStart' })
    expect(sim.state.working).toBe(true)
    expect(sim.probes).toBe(1)
    sim.send({ type: 'surfaces', hasTerminal: true })
    expect(sim.timers.has('tick')).toBe(true)
    sim.call('r', 'Read').advance(6200)
    expect(sim.scene).toBe('thinking')
  })
})

describe('session start and end', () => {
  test('a stored done or error rests; anything else is left', () => {
    for (const scene of ['done', 'error'] as const) {
      const sim = new Sim().send({ type: 'sessionStart', stored: { scene, detail: '' }, frame: 0, typed: false })
      expect(sim.scene).toBe('idle')
    }
    const reading = new Sim().send({ type: 'sessionStart', stored: { scene: 'reading', detail: 'x' }, frame: 0, typed: false })
    expect(reading.draws).toEqual([])
  })

  test('session end forgets everything and rests at once', () => {
    const sim = turn().send({ type: 'surfaces', hasTerminal: true })
    sim.send({ type: 'callStart', id: 'r', tool: 'Read' })
    sim.send({ type: 'helper', id: 'h' })
    sim.send({ type: 'stop', tasks: [{ type: 'shell', description: 'b', command: 'b' }] })
    sim.send({ type: 'typed', typed: true })
    sim.send({ type: 'sessionEnd' })
    expect(sim.shown).toEqual({ scene: 'idle', detail: '' })
    expect(sim.timers.size).toBe(0)
    expect(sim.state.helpers.size).toBe(0)
    expect(sim.state.lingering).toEqual([])
    expect(sim.state.working).toBe(false)
    expect(sim.state.typed).toBe(true)
  })
})

describe('the terminal tick', () => {
  test('600 ms a frame, wrapping at 60, only with a terminal surface', () => {
    const sim = turn()
    expect(sim.probes).toBe(1)
    sim.send({ type: 'surfaces', hasTerminal: true })
    sim.advance(600)
    expect(sim.state.frame).toBe(1)
    sim.advance(600 * 59)
    expect(sim.state.frame).toBe(0)
    sim.advance(600 * 3)
    expect(sim.state.frame).toBe(3)

    const desktop = turn().send({ type: 'surfaces', hasTerminal: false })
    expect(desktop.timers.has('tick')).toBe(false)
  })

  test('not asked again while it runs', () => {
    const sim = turn().send({ type: 'surfaces', hasTerminal: true })
    sim.send({ type: 'turnStart' })
    expect(sim.probes).toBe(1)
  })
})

describe('the demo', () => {
  test('plays every scene for 3000 ms, ignores real work, then restores', () => {
    const sim = turn().send({ type: 'demo' })
    expect(sim.shown).toEqual({ scene: 'thinking', detail: 'demo' })
    const seen: SceneId[] = []
    for (const _ of DEMO_SCENES) {
      seen.push(sim.scene)
      sim.send({ type: 'callStart', id: `c${seen.length}`, tool: 'Read' })
      expect(sim.shown.detail).toBe('demo')
      sim.advance(3000)
    }
    expect(seen).toEqual([...DEMO_SCENES])
    expect(sim.scene).toBe('reading') // the running call that began last
  })

  test('ends in rest between turns, and the terminal ticks while it plays', () => {
    const sim = new Sim().send({ type: 'demo' })
    expect(sim.probes).toBe(1)
    sim.send({ type: 'surfaces', hasTerminal: true })
    sim.advance(600)
    expect(sim.state.frame).toBe(1)
    sim.advance(3000 * DEMO_SCENES.length)
    expect(sim.scene).toBe('idle')
    expect(sim.timers.has('tick')).toBe(false)
  })

  test('helpers do not replace its detail, and session end cancels it', () => {
    const sim = turn().send({ type: 'helper', id: 'h' }).send({ type: 'demo' })
    sim.advance(3000 * 11)
    expect(sim.shown).toEqual({ scene: 'delegating', detail: 'demo' })
    sim.send({ type: 'sessionEnd' })
    expect(sim.scene).toBe('idle')
    sim.advance(10_000)
    expect(sim.scene).toBe('idle')
  })
})
