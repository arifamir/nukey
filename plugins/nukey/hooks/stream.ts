// Classifying a tool call while its JSON arguments are still streaming in. Pure: no `$`.
import type { SceneId } from '../types'
import { classifyShell, classifyTool, stripLeading, tellingKey } from './classify'
import { detailOf } from './detail'

export type Field = { value: string; isComplete: boolean }

// The top-level string fields of a JSON object that may be cut off anywhere, each
// decoded (escapes such as \n, \" and \\ become what they stand for). A string cut
// off mid-way is kept as far as it arrived, marked incomplete; the first of a key wins.
export function partialFields(json: string): Map<string, Field> {
  const fields = new Map<string, Field>()
  let at = json.indexOf('{')
  if (at === -1) return fields
  at += 1
  const skipSpace = () => {
    while (at < json.length && /\s/.test(json.charAt(at))) at += 1
  }
  for (;;) {
    skipSpace()
    if (json.charAt(at) === ',') {
      at += 1
      skipSpace()
    }
    if (json.charAt(at) !== '"') return fields
    const key = readString(json, at)
    if (!key.isComplete) return fields
    at = key.end
    skipSpace()
    if (json.charAt(at) !== ':') return fields
    at += 1
    skipSpace()
    if (at >= json.length) return fields
    if (json.charAt(at) === '"') {
      const value = readString(json, at)
      if (!fields.has(key.value)) fields.set(key.value, { value: value.value, isComplete: value.isComplete })
      if (!value.isComplete) return fields
      at = value.end
    } else {
      at = skipValue(json, at)
      if (at >= json.length) return fields
    }
  }
}

// Reads the JSON string whose opening quote is at `start`.
function readString(json: string, start: number): { value: string; isComplete: boolean; end: number } {
  let value = ''
  let at = start + 1
  while (at < json.length) {
    const char = json.charAt(at)
    if (char === '"') return { value, isComplete: true, end: at + 1 }
    if (char !== '\\') {
      value += char
      at += 1
      continue
    }
    const escaped = json.charAt(at + 1)
    if (escaped === '') break
    if (escaped === 'u') {
      const hex = json.slice(at + 2, at + 6)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break
      value += String.fromCharCode(parseInt(hex, 16))
      at += 6
      continue
    }
    value += ESCAPES[escaped] ?? escaped
    at += 2
  }
  return { value, isComplete: false, end: json.length }
}

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }

// Skips a non-string value (number, literal, nested object or array) from `start`,
// up to the comma or closing brace that ends it.
function skipValue(json: string, start: number): number {
  let depth = 0
  let at = start
  while (at < json.length) {
    const char = json.charAt(at)
    if (char === '"') {
      at = readString(json, at).end
      continue
    }
    if (char === '{' || char === '[') depth += 1
    else if (char === '}' || char === ']') {
      if (depth === 0) return at
      depth -= 1
    } else if (char === ',' && depth === 0) return at
    at += 1
  }
  return at
}

// The scene of a told-by-arguments block once its buffer tells it, else undefined.
export function settleBlock(tool: string, json: string, designWork: boolean): SceneId | undefined {
  const key = tellingKey(tool)
  if (key === undefined) return undefined
  const field = partialFields(json).get(key)
  if (field === undefined) return undefined
  if (tool !== 'Bash') return field.isComplete ? classifyTool(tool, { [key]: field.value }, designWork) : undefined
  return settleCommand(field.value, field.isComplete, designWork)
}

// A shell command as far as it has arrived: settle as soon as the scene can no
// longer change into something more specific.
export function settleCommand(command: string, isComplete: boolean, designWork: boolean): SceneId | undefined {
  const partial = command.trimStart()
  const rest = stripLeading(partial)
  const head = isComplete ? /^(\S+)/.exec(rest) : /^(\S+)\s/.exec(rest)
  if (head === null) return undefined
  if (!isComplete && (head[1] === 'cd' || head[1] === 'pushd')) return undefined
  const scene = classifyShell(partial, designWork)
  if (isComplete) return scene
  const hasLineBreak = partial.includes('\n')
  if ((scene === 'coding' || scene === 'writing' || scene === 'designing') && !hasLineBreak) return undefined
  if (scene === 'terminal' && partial.length < 40 && !hasLineBreak) return undefined
  return scene
}

const STREAM_DEFAULT_KEYS = ['file_path', 'skill', 'description'] as const
const STREAM_TYPED_KEYS = ['file_path', 'skill', 'command'] as const

// The detail of a streaming block: the first complete value among its keys.
export function streamDetail(json: string, typed: boolean): string | undefined {
  const fields = partialFields(json)
  for (const key of typed ? STREAM_TYPED_KEYS : STREAM_DEFAULT_KEYS) {
    const field = fields.get(key)
    if (field?.isComplete === true && field.value !== '') return detailOf(key, field.value)
  }
  return undefined
}
