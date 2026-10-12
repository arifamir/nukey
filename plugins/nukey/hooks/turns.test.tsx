import { describe, expect, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import type { TurnStepChunk } from 'claude-code'
import {
  BAND,
  PEEK,
  SURFACES,
  type World,
  compact,
  pending,
  readBand,
  runCommand,
  startSession,
  streamStep,
  turnEnd,
  turnStart,
  value,
  world,
} from './harness'

const it = (name: string, body: TestBody) => test(name, { plugins: [PEEK] }, body)
type Call = Parameters<Engine['tool']['call']>[0]
const call = ($: Engine, input: Record<string, unknown>) => $.tool.call(input as Call)

// A session with a band mounted on the surface, and a turn under way.
async function session($: Engine, w: World, surface: 'terminal' | 'desktop' = 'terminal', isTurn = true) {
  await startSession($)
  const ui = await $.ui.mount({ plugin: 'nukey', surface, ...BAND })
  if (isTurn) await turnStart($)
  return { ui, read: () => readBand(ui, w) }
}

const stop = ($: Engine, tasks: { type: string; description: string; command?: string }[]) =>
  $.classic.Stop({ stop_hook_active: false, background_tasks: tasks.map((task, n) => ({ id: `t${n}`, status: 'running', ...task })) })

describe('a turn', () => {
  it('thinking, a call, the reply, DING!, then rest, on both surfaces', async ($, on) => {
    const w = world(on, { surfaces: ['terminal', 'desktop'] })
    await startSession($)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'nukey', surface, ...BAND })
      await turnStart($)
      expect((await readBand(ui, w)).label).toBe('Thinking it over')
      await call($, { tool: 'Read', file_path: '/repo/src/tide.ts', tool_use_id: `r-${surface}` })
      expect(await readBand(ui, w)).toMatchObject({ label: 'Reading through the files', detail: 'tide.ts' })
      await streamStep($, w, [{ kind: 'text', index: 0, text: 'All read.' }])
      expect((await readBand(ui, w)).label).toBe('Reading through the files') // held 1200 ms
      await w.clock.advance(1200)
      expect((await readBand(ui, w)).label).toBe('Plating up the answer')
      await stop($, [])
      await turnEnd($)
      expect(await readBand(ui, w)).toMatchObject({ label: 'Ding! All done', detail: '' })
      await w.clock.advance(7999)
      expect((await readBand(ui, w)).label).toBe('Ding! All done')
      await w.clock.advance(1)
      expect((await readBand(ui, w)).label).toBe('Nukey is napping')
      await ui.unmount()
    }
  })

  it('a turn that ends on an API error or a refusal shows the error', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await turnEnd($, 'error')
    expect((await read()).label).toBe('Something got burnt')
  })

  it('a background task lingers after the rest', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await stop($, [{ type: 'shell', description: 'Build', command: 'make build' }])
    await turnEnd($)
    expect((await read()).label).toBe('Ding! All done')
    await w.clock.advance(9000)
    expect(await read()).toMatchObject({ label: 'Waiting on something in the oven', detail: 'make build' })
  })

  it('standing tasks are not waited on; two tasks are counted', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    const watch = { type: 'monitor', description: 'live updates for artifact https://claude.ai/artifact/abc' }
    await stop($, [watch])
    await turnEnd($)
    await w.clock.advance(9000)
    expect((await read()).label).toBe('Nukey is napping')
    await turnStart($)
    await stop($, [watch, { type: 'shell', description: 'Build', command: 'make build' }, { type: 'workflow', description: 'Audit' }])
    await turnEnd($)
    await w.clock.advance(9000)
    expect(await read()).toMatchObject({ label: 'Waiting on something in the oven', detail: '2 tasks in the background' })
  })

  it('a lingering workflow alone delegates with its description', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await stop($, [{ type: 'workflow', description: 'Audit the release' }])
    await turnEnd($)
    await w.clock.advance(9000)
    expect(await read()).toMatchObject({ label: 'Sending in the helpers', detail: 'Audit the release' })
  })
})

describe('calls', () => {
  it('a long call stays after a short one in parallel', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    const agent = pending()
    w.tool = e => (e.tool === 'Agent' ? agent.result : { result: 'ok', text: 'ok' })
    const running = call($, { tool: 'Agent', description: 'Review the diff', prompt: 'p', tool_use_id: 'a' })
    expect(await read()).toMatchObject({ label: 'Sending in the helpers', detail: 'Review the diff' })
    await call($, { tool: 'Read', file_path: 'x.ts', tool_use_id: 'r' })
    await w.clock.advance(1200)
    expect((await read()).label).toBe('Reading through the files')
    await w.clock.advance(1800)
    expect((await read()).label).toBe('Sending in the helpers')
    agent.finish()
    await running
  })

  it('returns the result unchanged', async ($, on) => {
    const w = world(on)
    await session($, w)
    w.tool = () => ({ result: { lines: 3 }, text: 'three lines' })
    const result = await call($, { tool: 'Read', file_path: 'x.ts', tool_use_id: 'r' })
    expect(result).toMatchObject({ result: { lines: 3 }, text: 'three lines' })
  })

  it('a failed call shows the error with its detail for 2500 ms', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    w.tool = () => ({ isError: true, result: 'boom', text: 'boom' })
    await call($, { tool: 'Bash', command: 'make', description: 'Build it', tool_use_id: 'b' })
    await w.clock.advance(1200)
    expect(await read()).toMatchObject({ label: 'Something got burnt', detail: 'Build it' })
    await streamStep($, w, [{ kind: 'text', index: 0, text: 'It broke.' }])
    await w.clock.advance(2499)
    expect((await read()).label).toBe('Something got burnt')
    await w.clock.advance(1)
    expect((await read()).label).toBe('Plating up the answer')
  })

  it('a call that throws shows the error too, and the throw goes on up', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    w.tool = () => {
      throw new Error('tool crashed')
    }
    await expect(call($, { tool: 'Grep', pattern: 'needle', tool_use_id: 'g' })).rejects.toThrow()
    await w.clock.advance(1200)
    expect(await read()).toMatchObject({ label: 'Something got burnt', detail: 'needle' })
  })

  it('a denied call is no failure', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    w.tool = () => ({ deny: 'not here' })
    const result = await call($, { tool: 'Bash', command: 'rm -rf /', tool_use_id: 'b' })
    expect(result).toMatchObject({ deny: 'not here' })
    await w.clock.advance(5000)
    expect((await read()).label).toBe('Thinking it over')
    expect(await value($, 'scene')).toEqual({ scene: 'thinking', detail: '' })
  })

  it('an interrupted turn rests, with no error from the late return', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    const bash = pending()
    w.tool = () => bash.result
    const running = call($, { tool: 'Bash', command: 'sleep 100', tool_use_id: 'b' })
    await w.clock.advance(100)
    await turnEnd($, 'aborted')
    bash.finish({ isError: true, result: 'Interrupted', text: 'Interrupted' })
    await running
    await w.clock.advance(5000)
    expect((await read()).label).toBe('Nukey is napping')
  })

  it('back to thinking 5000 ms after the last call', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await call($, { tool: 'Read', file_path: 'a.ts', tool_use_id: 'r' })
    await streamStep($, w, [{ kind: 'thinking', index: 0, text: 'hmm' }])
    await w.clock.advance(4999)
    expect((await read()).label).toBe('Reading through the files')
    await w.clock.advance(1)
    expect((await read()).label).toBe('Thinking it over')
  })

  it('design work carries through the turn and not into the next', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'desktop')
    await call($, { tool: 'Skill', skill: 'artifact-design', tool_use_id: 's' })
    await call($, { tool: 'Write', file_path: '/scratch/tide-table.html', content: '<p>', tool_use_id: 'w' })
    await w.clock.advance(1200)
    expect(await read()).toMatchObject({ label: 'Decorating the design', detail: 'tide-table.html' })
    await turnEnd($)
    await turnStart($, 't2')
    await call($, { tool: 'Write', file_path: '/scratch/index.html', content: '<p>', tool_use_id: 'w2' })
    expect(await read()).toMatchObject({ label: 'Cooking up some code', detail: 'index.html' })
  })
})

describe('dialogs', () => {
  it('permission shows until its call returns, then the call, then thinking', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    const bash = pending()
    w.tool = () => bash.result
    const running = call($, { tool: 'Bash', command: 'rm -rf build', tool_use_id: 'b' })
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
    await w.clock.advance(1200)
    expect(await read()).toMatchObject({ label: 'Waiting for your OK', detail: 'Bash' })
    bash.finish()
    await running
    expect(await read()).toMatchObject({ label: 'Running a command', detail: 'rm -rf build' })
    await w.clock.advance(5000)
    expect((await read()).label).toBe('Thinking it over')
  })

  it('a question or a plan to approve asks', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await $.classic.PermissionRequest({ tool_name: 'AskUserQuestion', tool_input: {} })
    expect(await read()).toMatchObject({ label: 'Needs your input', detail: '' })
    await $.classic.PermissionRequest({ tool_name: 'ExitPlanMode', tool_input: {} })
    expect((await read()).label).toBe('Needs your input')
  })

  it("a helper's dialog changes nothing", async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {}, agent_id: 'h1' })
    expect((await read()).label).toBe('Thinking it over')
  })

  it('a dialog keeps the scene while another tool returns', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    const [bash, grep] = [pending(), pending()]
    w.tool = e => (e.tool === 'Bash' ? bash.result : grep.result)
    const deploying = call($, { tool: 'Bash', command: 'deploy', tool_use_id: 'b' })
    const searching = call($, { tool: 'Grep', pattern: 'x', tool_use_id: 'g' })
    await w.clock.advance(2400)
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} })
    grep.finish()
    await searching
    await w.clock.advance(10_000)
    expect(await read()).toMatchObject({ label: 'Waiting for your OK', detail: 'Bash' })
    bash.finish()
    await deploying
  })
})

describe('compaction', () => {
  it('tidies up for at least 1200 ms, then thinks again', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await compact($)
    expect((await read()).label).toBe('Making room in the fridge')
    await w.clock.advance(1199)
    expect((await read()).label).toBe('Making room in the fridge')
    await w.clock.advance(1)
    expect((await read()).label).toBe('Thinking it over')
  })

  it('between turns it settles back to rest', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'terminal', false)
    await compact($, { trigger: 'auto' })
    expect((await read()).label).toBe('Making room in the fridge')
    await w.clock.advance(1200)
    expect((await read()).label).toBe('Nukey is napping')
  })
})

describe('streaming', () => {
  it('a heredoc to a code file shows writing code while the model pauses', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    const chunks: (TurnStepChunk | 'pause')[] = [
      { kind: 'tool', index: 1, id: 'b', name: 'Bash' },
      { kind: 'input', index: 1, json: '{"command": "cat > notes.ts <<\'EOF\'\\nexport const a' },
      'pause',
      { kind: 'input', index: 1, json: ' = 1\\nEOF"}' },
    ]
    w.chunks = chunks
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })
    const seen: TurnStepChunk[] = []
    const reading = (async () => {
      for await (const chunk of stream) seen.push(chunk)
    })()
    await w.clock.settle()
    expect((await read()).label).toBe('Cooking up some code')
    w.release()
    await reading
    expect(seen).toEqual(chunks.filter(chunk => chunk !== 'pause'))
  })

  it('a streamed Write shows its file; a Bash block its scene, then its description', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'desktop')
    await streamStep($, w, [
      { kind: 'tool', index: 0, id: 'w', name: 'Write' },
      { kind: 'input', index: 0, json: '{"file_path": "/repo/src/tide-table.ts", "content": "export' },
    ])
    expect(await read()).toMatchObject({ label: 'Cooking up some code', detail: 'tide-table.ts' })
    w.chunks = [
      { kind: 'tool', index: 1, id: 'b', name: 'Bash' },
      { kind: 'input', index: 1, json: '{"command": "git status --short && git log --oneline -3"' },
      'pause',
      { kind: 'input', index: 1, json: ', "description": "Show changed files"}' },
    ]
    const stream = (async () => {
      for await (const _ of $.turn.step({ turnId: 't1', index: 1, model: 'm', messageCount: 2 })) void _
    })()
    await w.clock.settle()
    expect(await read()).toMatchObject({ label: 'Stacking up git work', detail: '' })
    w.release()
    await stream
    expect(await read()).toMatchObject({ label: 'Stacking up git work', detail: 'Show changed files' })
  })

  it('text talks; whitespace changes nothing', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await streamStep($, w, [{ kind: 'text', index: 0, text: '  \n' }])
    expect((await read()).label).toBe('Thinking it over')
    await streamStep($, w, [{ kind: 'text', index: 0, text: 'Hello' }])
    expect((await read()).label).toBe('Plating up the answer')
  })

  it('escapes in a streamed description are decoded', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await streamStep($, w, [
      { kind: 'tool', index: 0, id: 'b', name: 'Bash' },
      { kind: 'input', index: 0, json: '{"command": "ls -la", "description": "List \\"all\\" files\\nand more"}' },
    ])
    expect(await read()).toMatchObject({ label: 'Hunting through the code', detail: 'List "all" files' })
  })

  it('a helper step passes through without touching the scene', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    w.chunks = [{ kind: 'text', index: 0, text: 'helper talk' }]
    const seen: TurnStepChunk[] = []
    for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1, agentId: 'h1' })) seen.push(chunk)
    expect(seen).toHaveLength(1)
    expect((await read()).label).toBe('Thinking it over')
  })
})

describe('helpers', () => {
  it('the helper line follows the helpers', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'desktop')
    const agent = pending()
    w.tool = e => (e.tool === 'Agent' && e.agentId === undefined ? agent.result : { result: 'ok', text: 'ok' })
    const running = call($, { tool: 'Agent', description: 'Review the diff', prompt: 'p', tool_use_id: 'a' })
    expect(await read()).toMatchObject({ label: 'Sending in the helpers', detail: 'Review the diff' })
    await call($, { tool: 'Read', file_path: 'a.ts', agentId: 'h1', tool_use_id: 'h1r' })
    await call($, { tool: 'Bash', command: 'npm test', agentId: 'h2', tool_use_id: 'h2b' })
    await w.clock.advance(1500)
    expect(await read()).toMatchObject({ label: 'Sending in the helpers', detail: '2 helpers: 1 reading, 1 running tests' })
    await call($, { tool: 'SubagentHandback', agentId: 'h1', tool_use_id: 'h1h' })
    await turnEnd($, 'answer', 'h1')
    await w.clock.advance(1500)
    expect((await read()).detail).toBe('1 helper: running tests')
    agent.finish()
    await running
  })

  it('a spawned helper carries its purpose', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'desktop')
    const agent = pending()
    w.tool = e => (e.tool === 'Agent' ? agent.result : { result: 'ok', text: 'ok' })
    const running = call($, { tool: 'Agent', description: 'Scout', prompt: 'p', tool_use_id: 'a' })
    w.spawned = 'h9'
    await $.agent.spawn({
      tool_use_id: 'a',
      prompt: 'p',
      description: 'Map the repo',
      subagentType: 'Explore',
      provider: { plugin: 'engine', tier: 'core' },
      parentModel: 'm',
      background: false,
      fork: false,
    })
    await call($, { tool: 'Grep', pattern: 'x', agentId: 'h9', tool_use_id: 'g' })
    await w.clock.advance(2500)
    expect((await read()).detail).toBe('Map the repo: searching')
    agent.finish()
    await running
  })

  it('helpers at work after the turn show after the rest, then Nukey rests', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await call($, { tool: 'Agent', description: 'Look around', prompt: 'p', run_in_background: true, tool_use_id: 'a' })
    await $.classic.SubagentStart({ agent_id: 'h1', agent_type: 'Explore' })
    await call($, { tool: 'Grep', pattern: 'x', agentId: 'h1', tool_use_id: 'g' })
    w.agents = [{ id: 'h1', description: 'Look around', type: 'Explore', status: 'running' }]
    await stop($, [{ type: 'subagent', description: 'Look around' }])
    await turnEnd($)
    await w.clock.advance(9000)
    expect(await read()).toMatchObject({ label: 'Sending in the helpers', detail: '1 helper: searching' })
    await turnEnd($, 'aborted', 'h1')
    await w.clock.advance(1500)
    expect((await read()).label).toBe('Nukey is napping')
  })

  it('Stop prunes helpers the engine no longer runs', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'desktop', false)
    for (const id of ['done', 'gone', 'busy']) await $.classic.SubagentStart({ agent_id: id, agent_type: 'x' })
    w.agents = [
      { id: 'done', description: '', type: 'x', status: 'completed' },
      { id: 'busy', description: '', type: 'x', status: 'running' },
    ]
    await stop($, [])
    await w.clock.advance(1500)
    expect((await read()).detail).toBe('1 helper: thinking')
    await $.classic.SubagentStart({ agent_id: 'flow', agent_type: 'x' })
    await stop($, [{ type: 'workflow', description: 'Audit' }])
    await w.clock.advance(1500)
    expect((await read()).detail).toBe('2 helpers: 2 thinking')
  })

  it("a helper's work never changes the main scene or takes up design work", async ($, on) => {
    const w = world(on)
    const { read } = await session($, w, 'desktop')
    await call($, { tool: 'Skill', skill: 'artifact-design', agentId: 'h1', tool_use_id: 's' })
    await call($, { tool: 'Edit', file_path: 'app.css', old_string: 'a', new_string: 'b', agentId: 'h1', tool_use_id: 'e' })
    await compact($, { agentId: 'h1' })
    await compact($, { trigger: 'precompute' })
    await w.clock.advance(1200)
    expect((await read()).label).toBe('Thinking it over')
    await call($, { tool: 'Write', file_path: 'page.html', content: '', tool_use_id: 'w' })
    expect((await read()).label).toBe('Cooking up some code')
  })
})

describe('the session', () => {
  it('session end mid-turn rests and forgets, but keeps the preferences', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await runCommand($, 'nukey', 'details')
    await runCommand($, 'nukey', 'theme steel')
    const agent = pending()
    w.tool = () => agent.result
    const running = call($, { tool: 'Agent', description: 'x', prompt: 'p', tool_use_id: 'a' })
    await $.classic.SubagentStart({ agent_id: 'h1', agent_type: 'x' })
    await stop($, [{ type: 'shell', description: 'b', command: 'make b' }])
    await $.session.end({ reason: 'clear', sessionId: 's', resume: {} } as Parameters<Engine['session']['end']>[0])
    expect(await read()).toMatchObject({ label: 'Nukey is napping', detail: '' })
    const frame = await value($, 'frame')
    await w.clock.advance(20_000)
    expect(await value($, 'frame')).toBe(frame)
    expect((await read()).label).toBe('Nukey is napping')
    expect(await value($, 'details')).toBe(true)
    expect(await value($, 'theme')).toBe('steel')
    agent.finish()
    await running
    // Nothing of the old conversation comes back: the next Stop settles straight to rest.
    await stop($, [])
    expect((await read()).label).toBe('Nukey is napping')
  })

  it('a session that starts on done or error rests; on anything else it is left', async ($, on) => {
    const w = world(on)
    const { read } = await session($, w)
    await turnEnd($)
    expect((await read()).label).toBe('Ding! All done')
    await startSession($)
    expect((await read()).label).toBe('Nukey is napping')
    await turnStart($)
    await call($, { tool: 'Read', file_path: 'a.ts', tool_use_id: 'r' })
    await startSession($)
    expect((await read()).label).toBe('Reading through the files')
  })

  it('the frame ticks every 600 ms on a terminal and stops at rest', async ($, on) => {
    const w = world(on)
    await session($, w)
    await w.clock.advance(600)
    expect(await value($, 'frame')).toBe(1)
    await w.clock.advance(600 * 59)
    expect(await value($, 'frame')).toBe(0)
    await stop($, [])
    await turnEnd($)
    await w.clock.advance(8000)
    const frame = await value($, 'frame')
    await w.clock.advance(6000)
    expect(await value($, 'frame')).toBe(frame)
  })

  it('no tick on a desktop alone', async ($, on) => {
    const w = world(on, { surfaces: ['desktop'] })
    await session($, w, 'desktop')
    await w.clock.advance(6000)
    expect(await value($, 'frame')).toBeNull()
  })
})
