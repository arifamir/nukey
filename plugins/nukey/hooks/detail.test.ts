import { describe, expect, test } from 'claude-code/testing'
import { cut, helperLine, lingeringScene, toolDetail } from './detail'

const BASH = { command: 'git status --short', description: 'Show working tree status' }

describe('tool call detail', () => {
  test('a shell call shows its description by default and its command as typed', () => {
    expect(toolDetail('Bash', BASH, false)).toBe('Show working tree status')
    expect(toolDetail('Bash', BASH, true)).toBe('git status --short')
  })

  test('a shell call with only a command shows it either way', () => {
    expect(toolDetail('Bash', { command: 'make build' }, false)).toBe('make build')
    expect(toolDetail('Bash', { command: 'make build' }, true)).toBe('make build')
  })

  test('each tool shows its telling argument', () => {
    expect(toolDetail('Read', { file_path: '/repo/src/a.ts' }, false)).toBe('a.ts')
    expect(toolDetail('NotebookEdit', { notebook_path: '/n/b.ipynb' }, false)).toBe('b.ipynb')
    expect(toolDetail('Grep', { pattern: 'TODO', path: 'src' }, false)).toBe('TODO')
    expect(toolDetail('WebFetch', { url: 'https://example.com/a', prompt: 'x' }, false)).toBe('https://example.com/a')
    expect(toolDetail('WebSearch', { query: 'tide tables' }, false)).toBe('tide tables')
    expect(toolDetail('Skill', { skill: 'code-review' }, false)).toBe('code-review')
    expect(toolDetail('Agent', { description: 'Review the diff', prompt: 'p' }, false)).toBe('Review the diff')
    expect(toolDetail('TodoWrite', { todos: [] }, false)).toBe('')
    expect(toolDetail('Read', undefined, false)).toBe('')
  })

  test('empty values are passed over', () => {
    expect(toolDetail('Bash', { description: '', command: 'ls' }, false)).toBe('ls')
  })

  test('a long description is kept whole up to 140 characters, then cut with an ellipsis', () => {
    const medium = 'm'.repeat(78)
    expect(toolDetail('Bash', { command: 'x', description: medium }, false)).toBe(medium)
    const long = 'l'.repeat(200)
    const shown = toolDetail('Bash', { command: 'x', description: long }, false)
    expect(shown).toBe(`${'l'.repeat(139)}…`)
    expect(shown).toHaveLength(140)
    expect(cut('a'.repeat(140))).toBe('a'.repeat(140))
  })

  test('an MCP tool with none of the keys shows its own name', () => {
    expect(toolDetail('mcp__atlassian__searchJiraIssuesUsingJql', { jql: 'x' }, false)).toBe('searchJiraIssuesUsingJql')
    expect(toolDetail('SomeTool', {}, false)).toBe('')
  })

  test('a multi-line command shows its first line', () => {
    expect(toolDetail('Bash', { command: "python3 - <<'EOF'\nprint(1)\nEOF" }, true)).toBe("python3 - <<'EOF'")
    expect(toolDetail('Bash', { command: 'a\tb' }, true)).toBe('a b')
  })
})

describe('the helper line', () => {
  test('none, one, several', () => {
    expect(helperLine([])).toBe('')
    expect(helperLine([{ scene: 'reading' }])).toBe('1 helper: reading')
    expect(helperLine([{ scene: 'testing', purpose: 'Review the diff' }])).toBe('Review the diff: running tests')
    expect(helperLine([{ scene: 'testing', purpose: '' }])).toBe('1 helper: running tests')
    expect(helperLine([{ scene: 'thinking' }, { scene: 'terminal' }, { scene: 'terminal', purpose: 'Build' }])).toBe(
      '3 helpers: 2 running commands, 1 thinking',
    )
    expect(helperLine([{ scene: 'reading' }, { scene: 'testing' }])).toBe('2 helpers: 1 reading, 1 running tests')
    expect(
      helperLine([
        { scene: 'reading' },
        { scene: 'terminal' },
        { scene: 'testing' },
        { scene: 'reading' },
        { scene: 'terminal' },
      ]),
    ).toBe('5 helpers: 2 reading, 2 running commands, 1 running tests')
    expect(helperLine([{ scene: 'thinking' }, { scene: 'thinking' }])).toBe('2 helpers: 2 thinking')
  })

  test('is cut to 140', () => {
    expect(helperLine([{ scene: 'reading', purpose: 'p'.repeat(200) }])).toHaveLength(140)
  })
})

describe('the lingering scene', () => {
  const shell = { type: 'shell', description: 'Run the test suite', command: 'npm test' }
  const review = { type: 'subagent', description: 'Review the diff' }
  const audit = { type: 'workflow', description: 'Audit the release' }
  const build = { type: 'shell', description: 'Build', command: 'make build' }
  const watch = { type: 'monitor', description: 'live updates for artifact https://claude.ai/artifact/abc' }

  test('the examples', () => {
    expect(lingeringScene([])).toBeUndefined()
    expect(lingeringScene([shell])).toEqual({ scene: 'waiting', detail: 'npm test' })
    expect(lingeringScene([review, audit])).toEqual({ scene: 'delegating', detail: '2 tasks in the background' })
    expect(lingeringScene([review, build])).toEqual({ scene: 'waiting', detail: '2 tasks in the background' })
    expect(lingeringScene([watch])).toBeUndefined()
    expect(lingeringScene([watch, build])).toEqual({ scene: 'waiting', detail: 'make build' })
  })

  test('a standing task is told in any case, and one task shows its first line', () => {
    expect(lingeringScene([{ type: 'monitor', description: 'Live Updates for x' }])).toBeUndefined()
    expect(lingeringScene([audit])).toEqual({ scene: 'delegating', detail: 'Audit the release' })
    expect(lingeringScene([{ type: 'shell', description: 'd', command: 'make a\nmake b' }])).toEqual({
      scene: 'waiting',
      detail: 'make a',
    })
  })
})
