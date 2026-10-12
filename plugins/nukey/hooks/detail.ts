// The one-line detail under the label: for a tool call, for the helpers at work,
// and for the background work left when a turn ends. Pure: no `$`.
import type { SceneId } from '../types'
import { DETAIL_MAX, DOING } from './scenes'
import type { Args } from './classify'

const DEFAULT_KEYS = ['file_path', 'notebook_path', 'description', 'command', 'pattern', 'query', 'url', 'skill'] as const
const TYPED_KEYS = ['file_path', 'notebook_path', 'command', 'pattern', 'query', 'url', 'description', 'skill'] as const
const PATH_KEYS: ReadonlySet<string> = new Set(['file_path', 'notebook_path'])

// Cut to the detail's maximum: 139 characters and an ellipsis.
export function cut(text: string, max = DETAIL_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// The first line of a text, any other control whitespace shown as a space.
export function firstLine(text: string): string {
  return (text.split(/\r\n|\r|\n/)[0] ?? '').replace(/[\t\v\f]/g, ' ')
}

const lastSegment = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

// One argument's value as the detail shows it: a path's file name, else its first line.
export function detailOf(key: string, value: string): string {
  return cut(PATH_KEYS.has(key) ? firstLine(lastSegment(value)) : firstLine(value))
}

// The keys a call's detail is looked for in, in order: by default a shell call shows
// what it does (its description), "as typed" shows the command itself.
export const detailKeys = (typed: boolean): readonly string[] => (typed ? TYPED_KEYS : DEFAULT_KEYS)

export function toolDetail(tool: string, args: Args | undefined, typed: boolean): string {
  for (const key of detailKeys(typed)) {
    const value = args?.[key]
    if (typeof value === 'string' && value !== '') return detailOf(key, value)
  }
  return tool.startsWith('mcp__') ? tool.slice(tool.lastIndexOf('__') + 2) : ''
}

// ---------------------------------------------------------------------------
// Helpers

export type Helper = { scene: SceneId; purpose?: string }

// "Review the diff: running tests", "1 helper: reading", "3 helpers: 2 running commands, 1 thinking".
export function helperLine(helpers: readonly Helper[]): string {
  if (helpers.length === 0) return ''
  if (helpers.length === 1) {
    const [only] = helpers
    if (only === undefined) return ''
    const who = only.purpose !== undefined && only.purpose !== '' ? only.purpose : '1 helper'
    return cut(`${who}: ${DOING[only.scene]}`)
  }
  const counts = new Map<SceneId, number>()
  for (const helper of helpers) counts.set(helper.scene, (counts.get(helper.scene) ?? 0) + 1)
  // A stable sort keeps ties in the order the activities were first met.
  const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([scene, count]) => `${count} ${DOING[scene]}`)
  return cut(`${helpers.length} helpers: ${parts.join(', ')}`)
}

// ---------------------------------------------------------------------------
// Background work left when a turn ends

export type BackgroundTask = { type: string; description: string; command?: string }

// Subscriptions that last the whole session (an artifact being watched) and must
// not keep Nukey from resting.
const isStanding = (task: BackgroundTask): boolean => task.description.toLowerCase().startsWith('live updates for ')

// What the band shows for background work, or undefined when there is none to wait on.
export function lingeringScene(tasks: readonly BackgroundTask[]): { scene: SceneId; detail: string } | undefined {
  const left = tasks.filter(task => !isStanding(task))
  const [only] = left
  if (only === undefined) return undefined
  const scene: SceneId = left.every(task => task.type === 'subagent' || task.type === 'workflow') ? 'delegating' : 'waiting'
  const detail =
    left.length === 1
      ? firstLine(only.command !== undefined && only.command !== '' ? only.command : only.description)
      : `${left.length} tasks in the background`
  return { scene, detail: cut(detail) }
}
