import { describe, expect, test } from 'claude-code/testing'
import { partialFields, settleBlock, streamDetail } from './stream'

const bash = (json: string, designWork = false) => settleBlock('Bash', json, designWork)

describe('partial JSON', () => {
  test('complete and cut-off string fields', () => {
    const fields = partialFields('{"file_path": "/a/b.ts", "content": "const a')
    expect(fields.get('file_path')).toEqual({ value: '/a/b.ts', isComplete: true })
    expect(fields.get('content')).toEqual({ value: 'const a', isComplete: false })
  })

  test('escapes are decoded', () => {
    const fields = partialFields('{"a": "x\\ny", "b": "say \\"hi\\"", "c": "back\\\\slash", "d": "\\u00e9t\\u00e9", "e": "tab\\tbed"}')
    expect(fields.get('a')?.value).toBe('x\ny')
    expect(fields.get('b')?.value).toBe('say "hi"')
    expect(fields.get('c')?.value).toBe('back\\slash')
    expect(fields.get('d')?.value).toBe('été')
    expect(fields.get('e')?.value).toBe('tab\tbed')
  })

  test('an escape cut in half waits for the rest', () => {
    expect(partialFields('{"a": "x\\').get('a')).toEqual({ value: 'x', isComplete: false })
    expect(partialFields('{"a": "x\\u00').get('a')).toEqual({ value: 'x', isComplete: false })
  })

  test('keys inside values and nested values are not fields', () => {
    const fields = partialFields('{"description": "has \\"command\\": \\"rm\\"", "n": 3, "o": {"command": "x"}, "command": "ls"}')
    expect(fields.get('command')).toEqual({ value: 'ls', isComplete: true })
    expect(fields.has('o')).toBe(false)
  })

  test('nothing yet', () => {
    expect(partialFields('').size).toBe(0)
    expect(partialFields('{"comm').size).toBe(0)
    expect(partialFields('{"command": ').size).toBe(0)
  })
})

describe('settling a Bash block', () => {
  test('waits while the command cannot tell yet', () => {
    expect(bash('')).toBeUndefined()
    expect(bash('{"description": "Read the notes", "comm')).toBeUndefined()
    expect(bash('{"command": "ca')).toBeUndefined()
    expect(bash('{"command": "cd /repo')).toBeUndefined()
    expect(bash('{"command": "make bu')).toBeUndefined()
    expect(bash('{"command": "cat > notes')).toBeUndefined()
  })

  test('settles as soon as it can', () => {
    expect(bash('{"command": "cat notes.md')).toBe('reading')
    expect(bash('{"command": "cd /repo && git st')).toBe('git')
    expect(bash('{"command":"python3 - <<\'EOF\'\\nimport json')).toBe('terminal')
    expect(bash('{"command": "cat > hooks/activity.ts <<\'EOF\'\\nconst')).toBe('coding')
    expect(bash('{"command": "cat > notes.md <<\'EOF\'\\n# Notes')).toBe('writing')
    expect(bash('{"command": "cat > page.html <<\'EOF\'\\n<p>', true)).toBe('designing')
    expect(bash(`{"command": "make build && ./scripts/run-everything --verbose`)).toBe('terminal')
    expect(bash('{"command": "npm test')).toBe('testing')
  })

  test('a complete command settles whatever it is', () => {
    expect(bash('{"command": "make bu"')).toBe('terminal')
    expect(bash('{"command": "git status --short && git log --oneline -3", "desc')).toBe('git')
  })

  test('surrounding whitespace is no first word', () => {
    expect(bash('{"command": "  ')).toBeUndefined()
    expect(bash('{"command": "  cat x ')).toBe('reading')
  })
})

describe('settling the other told-by-arguments blocks', () => {
  test('file tools wait for a complete path', () => {
    expect(settleBlock('Write', '', false)).toBeUndefined()
    expect(settleBlock('Write', '{"file_path": "scratchpad/tide-table.ht', false)).toBeUndefined()
    expect(settleBlock('Write', '{"file_path": "scratchpad/tide-table.html"', false)).toBe('coding')
    expect(settleBlock('Write', '{"file_path": "scratchpad/tide-table.html"', true)).toBe('designing')
    expect(settleBlock('Write', '{"file_path": "src/theme.css", "content": "', false)).toBe('designing')
    expect(settleBlock('Write', '{"file_path": "notes.md"', false)).toBe('writing')
    expect(settleBlock('Edit', '{"file_path": "hooks/activity.ts"', false)).toBe('coding')
    expect(settleBlock('MultiEdit', '{"file_path": "/repo/CLAUDE.md"', false)).toBe('memory')
  })

  test('Skill and Artifact', () => {
    expect(settleBlock('Skill', '{"skill": "artifact-design"', false)).toBe('designing')
    expect(settleBlock('Skill', '{"skill": "code-rev', false)).toBeUndefined()
    expect(settleBlock('Skill', '{"skill": "code-review"}', false)).toBe('skill')
    expect(settleBlock('Artifact', '{"action": "quickstart"', false)).toBe('designing')
    expect(settleBlock('Artifact', '{"action": "publish"', false)).toBe('sharing')
  })

  test('tools not told by their arguments never settle here', () => {
    expect(settleBlock('Read', '{"file_path": "a.ts"}', false)).toBeUndefined()
  })
})

describe('the streaming detail', () => {
  test('the first complete value among the keys', () => {
    expect(streamDetail('{"file_path": "/repo/src/tide-table.ts", "content": "x', false)).toBe('tide-table.ts')
    expect(streamDetail('{"command": "git status", "description": "Show changed files"}', false)).toBe('Show changed files')
    expect(streamDetail('{"command": "git status", "description": "Show cha', false)).toBeUndefined()
    expect(streamDetail('{"command": "git status", "description": "Show changed files"}', true)).toBe('git status')
    expect(streamDetail('{"skill": "code-review"}', false)).toBe('code-review')
  })

  test('escapes are decoded, a line break ends the line, other whitespace is a space', () => {
    expect(streamDetail('{"description": "Say \\"hi\\""}', false)).toBe('Say "hi"')
    expect(streamDetail('{"description": "first\\nsecond"}', false)).toBe('first')
    expect(streamDetail('{"description": "tab\\there"}', false)).toBe('tab here')
    expect(streamDetail('{"command": "echo a\\\\b"}', true)).toBe('echo a\\b')
  })

  test('is cut to 140', () => {
    expect(streamDetail(`{"description": "${'d'.repeat(200)}"}`, false)).toHaveLength(140)
  })
})
