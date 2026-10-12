// From a tool call to the scene Nukey acts out. Pure rule tables: no `$`.
import type { SceneId } from '../types'

export type Args = Readonly<Record<string, unknown>>

// ---------------------------------------------------------------------------
// Tables

// Built-in tools by name, matched exactly.
const TOOL_TABLE: Readonly<Record<string, SceneId>> = scenesByName({
  reading: [
    'Read',
    'NotebookRead',
    'ReadMcpResourceTool',
    'ListMcpResourcesTool',
    'ReadMcpResourceDirTool',
    'ReadNotifications',
    'FetchInboxMessage',
  ],
  skill: ['Skill'],
  coding: ['Edit', 'MultiEdit', 'Write', 'NotebookEdit'],
  terminal: ['Bash', 'KillShell', 'TaskStop'],
  waiting: ['BashOutput', 'TaskOutput', 'Monitor', 'ScheduleWakeup', 'CronCreate', 'CronList', 'CronDelete'],
  searching: ['Grep', 'Glob', 'LS', 'ToolSearch', 'ListSkills', 'ListPlugins', 'ListAgents'],
  web: ['WebFetch', 'WebSearch'],
  delegating: ['Agent', 'Task', 'Workflow', 'SendMessage'],
  asking: ['AskUserQuestion'],
  planning: ['TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'EnterPlanMode', 'ExitPlanMode'],
  sharing: ['Artifact', 'SendUserFile', 'PushNotification', 'ReportFindings', 'SuggestSkills', 'SuggestPluginInstall'],
  git: ['EnterWorktree', 'ExitWorktree'],
})

// Shell programs by name, for the first program of a command.
const PROGRAM_TABLE: Readonly<Record<string, SceneId>> = scenesByName({
  git: ['git', 'gh'],
  reading: ['cat', 'head', 'tail', 'less', 'more', 'bat', 'wc', 'nl', 'jq', 'yq', 'sed', 'awk', 'diff', 'stat', 'file'],
  searching: ['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'find', 'fd', 'ls', 'tree', 'which', 'locate'],
  web: ['curl', 'wget', 'http', 'https'],
})

const FILE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])

// The tools whose scene waits for one argument while it streams, and that argument.
const TELLING_KEY: Readonly<Record<string, string>> = {
  Bash: 'command',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  Write: 'file_path',
  Skill: 'skill',
  Artifact: 'action',
}

// The calls with which a helper hands its answer back.
const HANDBACKS: ReadonlySet<string> = new Set(['SubagentHandback', 'StructuredOutput'])

// Test runners called on their own, and the tools that run tests as `<tool> test`.
const TEST_RUNNERS: ReadonlySet<string> = new Set(['pytest', 'vitest', 'jest', 'mocha', 'rspec', 'phpunit', 'tox', 'unittest'])
const TEST_SUBCOMMAND: ReadonlySet<string> = new Set(['go', 'cargo', 'bun', 'deno', 'dotnet', 'npm', 'pnpm', 'yarn', 'make'])
const TEST_RUN_SCRIPT: ReadonlySet<string> = new Set(['npm', 'pnpm', 'yarn', 'bun'])

// Package managers and the sub-commands with which they install.
const INSTALLERS: Readonly<Record<string, ReadonlySet<string>>> = {
  npm: new Set(['install', 'add', 'i', 'ci']),
  pnpm: new Set(['install', 'add', 'i', 'ci']),
  yarn: new Set(['install', 'add', 'i', 'ci']),
  bun: new Set(['install', 'add', 'i', 'ci']),
  pip: new Set(['install']),
  pip3: new Set(['install']),
  uv: new Set(['add', 'sync', 'pip']),
  poetry: new Set(['add', 'install']),
  brew: new Set(['install']),
  cargo: new Set(['add', 'install']),
  apt: new Set(['install']),
  'apt-get': new Set(['install']),
}

const WRAPPERS = /^\s*(?:sudo|time|command|exec|nohup|do|then|else)\s+/
const CHANGE_DIR = /^\s*(?:cd|pushd)\s+(?:"(?:[^"\\]|\\.)*"|'[^']*'|\S+?)\s*(?:&&|;)\s*/
const ENV_ASSIGNMENT = /^\s*[A-Za-z_][A-Za-z0-9_]*=(?:"(?:[^"\\]|\\.)*"|'[^']*'|\S*)\s+/
const PROGRAM = /^[A-Za-z0-9_./+-]+/
const QUOTED = /"(?:[^"\\]|\\.)*"|'[^']*'/g

// ---------------------------------------------------------------------------
// File kinds

export type FileKind = 'memory' | 'prose' | 'looks' | 'page' | 'other'

const PROSE_EXTENSION = /\.(?:md|mdx|markdown|txt|rst|adoc|asciidoc|org|tex|rtf)$/i
const PROSE_NAME = /(?:^|\/)(?:README|LICENSE|LICENCE|CHANGELOG|CONTRIBUTING|AUTHORS|NOTICE|TODO)$/i
const LOOKS_EXTENSION = /\.(?:css|scss|sass|less|svg)$/i
const PAGE_EXTENSION = /\.(?:html|htm|xhtml)$/i
// Memory ignores case: `claude.md` and `memory.md` are memory files too.
const MEMORY_DIR = /(?:^|\/)memory\//i
const MEMORY_NAME = /(?:^|\/)(?:CLAUDE|MEMORY)\.md$/i

export function fileKind(path: string): FileKind {
  if (MEMORY_DIR.test(path) || MEMORY_NAME.test(path)) return 'memory'
  if (PROSE_EXTENSION.test(path) || PROSE_NAME.test(path)) return 'prose'
  if (LOOKS_EXTENSION.test(path)) return 'looks'
  if (PAGE_EXTENSION.test(path)) return 'page'
  return 'other'
}

// The scene for a shell command that writes, from the words of its line: any prose
// file makes it writing, then looks (and web pages once the turn has taken up
// design work) make it designing, else it is plain code.
function writeScene(words: readonly string[], designWork: boolean): SceneId {
  const isProse = (word: string) => PROSE_EXTENSION.test(word) || PROSE_NAME.test(word)
  if (words.some(isProse)) return 'writing'
  if (words.some(word => LOOKS_EXTENSION.test(word) || (designWork && PAGE_EXTENSION.test(word)))) return 'designing'
  return 'coding'
}

// ---------------------------------------------------------------------------
// Tools

export const isToldByArgs = (tool: string): boolean => Object.hasOwn(TELLING_KEY, tool)
export const tellingKey = (tool: string): string | undefined => (Object.hasOwn(TELLING_KEY, tool) ? TELLING_KEY[tool] : undefined)
export const isHandback = (tool: string): boolean => HANDBACKS.has(tool)
export const isFileTool = (tool: string): boolean => FILE_TOOLS.has(tool)

const text = (args: Args | undefined, key: string): string | undefined => {
  const value = args?.[key]
  return typeof value === 'string' ? value : undefined
}

// A call that by its nature is design work (a design tool, a design skill, an
// Artifact quickstart), so web pages written later in the turn are designing.
export function takesUpDesignWork(tool: string, args?: Args): boolean {
  if (tool === 'Bash' || FILE_TOOLS.has(tool)) return false
  return isDesignCall(tool, args)
}

function isDesignCall(tool: string, args: Args | undefined): boolean {
  if (/design|figma/i.test(tool)) return true
  const skill = tool === 'Skill' ? text(args, 'skill') : undefined
  if (skill !== undefined && /design|diagram/i.test(skill)) return true
  return tool === 'Artifact' && text(args, 'action') === 'quickstart'
}

export function classifyTool(tool: string, args?: Args, designWork = false): SceneId {
  const command = tool === 'Bash' ? text(args, 'command') : undefined
  if (command !== undefined) return classifyShell(command, designWork)

  const path = FILE_TOOLS.has(tool) ? text(args, 'file_path') : undefined
  if (path !== undefined) {
    const kind = fileKind(path)
    if (kind === 'memory') return 'memory'
    if (kind === 'prose') return 'writing'
    if (kind === 'looks' || (kind === 'page' && designWork)) return 'designing'
  }

  if (isDesignCall(tool, args)) return 'designing'
  if (Object.hasOwn(TOOL_TABLE, tool)) return TOOL_TABLE[tool] ?? 'tool'
  if (/browser|chrome/i.test(tool)) return 'web'
  if (/terminal/i.test(tool)) return 'terminal'

  const name = tool.includes('__') ? tool.slice(tool.lastIndexOf('__') + 2) : tool
  if (/search|find|query/i.test(name)) return 'searching'
  if (/^(?:get|read|list|fetch|view)/i.test(name)) return 'reading'
  if (/^(?:show|display|render|open)/i.test(name)) return 'sharing'
  return 'tool'
}

// ---------------------------------------------------------------------------
// Shell commands

// Strips what leads up to a command's first program: `cd dir &&`, `FOO=1`, `sudo`.
export function stripLeading(command: string): string {
  let rest = command
  for (;;) {
    const lead = CHANGE_DIR.exec(rest) ?? ENV_ASSIGNMENT.exec(rest) ?? WRAPPERS.exec(rest)
    if (lead === null) return rest
    rest = rest.slice(lead[0].length)
  }
}

const baseName = (word: string): string => word.slice(word.lastIndexOf('/') + 1)

// The name of the first program of a command, after the leading items; '' if none.
export function firstProgram(command: string): string {
  const match = PROGRAM.exec(stripLeading(command))
  return match === null ? '' : baseName(match[0])
}

// Every quoted string emptied, so words inside quotes are never commands.
const blankQuotes = (command: string): string => command.replace(QUOTED, quoted => quoted.charAt(0).repeat(2))

// The commands of a chain or pipeline, quotes emptied, a heredoc's body left out.
export function chainOf(command: string): string[] {
  const lines = command.split('\n')
  const heredoc = lines.findIndex(line => line.includes('<<'))
  const kept = heredoc === -1 ? lines : lines.slice(0, heredoc + 1)
  return blankQuotes(kept.join('\n'))
    .split(/&&|\|\||;|\||\n/)
    .map(piece => piece.trim())
    .filter(piece => piece !== '')
}

// A command's words from its first program on, launchers (`npx`, `uv run`,
// `python -m`, ...) skipped so the program they launch comes first.
export function commandWords(command: string): string[] {
  const words = stripLeading(command).trim().split(/\s+/).filter(word => word !== '')
  for (;;) {
    const [first = '', second = ''] = words
    const head = baseName(first)
    if (['npx', 'bunx', 'pnpx', 'uvx'].includes(head)) {
      words.shift()
      while (words[0]?.startsWith('-')) words.shift()
    } else if (['uv', 'poetry', 'pipenv', 'pdm', 'hatch'].includes(head) && second === 'run') {
      words.splice(0, 2)
      while (words[0]?.startsWith('-')) words.shift()
    } else if (/^python[0-9.]*$/.test(head) && second === '-m') {
      words.splice(0, 2)
    } else if (['npm', 'pnpm', 'yarn'].includes(head) && (second === 'exec' || second === 'dlx')) {
      words.splice(0, 2)
    } else if (head === 'bundle' && second === 'exec') {
      words.splice(0, 2)
    } else {
      break
    }
  }
  if (words[0] !== undefined) words[0] = baseName(words[0])
  return words
}

// `test`, or a script named after it (`test:unit`), as a whole word.
const isTestWord = (word: string | undefined): boolean => word !== undefined && /^test(?![A-Za-z0-9_])/.test(word)

export function isTestCommand(words: readonly string[]): boolean {
  const [first = '', second, third] = words
  if (TEST_RUNNERS.has(first)) return true
  if (TEST_SUBCOMMAND.has(first) && isTestWord(second)) return true
  return TEST_RUN_SCRIPT.has(first) && second === 'run' && isTestWord(third)
}

export function isInstallCommand(words: readonly string[]): boolean {
  const [first = '', second = ''] = words
  return Object.hasOwn(INSTALLERS, first) && (INSTALLERS[first]?.has(second) ?? false)
}

// An output redirect to a file (`> f`, `>> f`, `1> f`), quotes respected; stderr
// (`2>`, `&>`), a duplication (`2>&1`, `>&2`) and `/dev/...` are not files.
export function redirectsToFile(line: string): boolean {
  const redirect = /(^|[^0-9&>])(\d?)(&?)>>?[ \t]*([^\s&|>]\S*)/g
  for (const match of blankQuotes(line).matchAll(redirect)) {
    const [, , fd = '', amp = '', target = ''] = match
    if ((fd !== '' && fd !== '1') || amp !== '') continue
    if (target.startsWith('/dev/')) continue
    return true
  }
  return false
}

// `tee` with a file to write, anywhere in the line's pipeline.
function teesToFile(line: string): boolean {
  return chainOf(line).some(piece => {
    const words = stripLeading(piece).trim().split(/\s+/)
    if (baseName(words[0] ?? '') !== 'tee') return false
    return words.slice(1).some(word => !word.startsWith('-') && !word.startsWith('/dev/'))
  })
}

// Whether the command's first line writes a file, and which words it names.
function writtenWords(command: string): string[] | undefined {
  const line = stripLeading(command).split('\n')[0] ?? ''
  const program = firstProgram(line)
  const writes =
    teesToFile(line) ||
    (program === 'sed' && /\s-i(?![A-Za-z0-9_])/.test(blankQuotes(line))) ||
    (['cat', 'echo', 'printf'].includes(program) && redirectsToFile(line))
  if (!writes) return undefined
  return line
    .split(/\s+/)
    .filter(word => word !== '')
    .map(word => word.replace(/^['"]/, '').replace(/['"]$/, ''))
}

export function classifyShell(command: string, designWork = false): SceneId {
  const text = command.trim()
  const chain = chainOf(text)
  const words = chain.map(commandWords)

  if (words.some(isTestCommand)) return 'testing'
  if (chain.some(piece => ['git', 'gh'].includes(firstProgram(piece)))) return 'git'
  if (words.some(isInstallCommand)) return 'installing'

  const written = writtenWords(text)
  if (written !== undefined) return writeScene(written, designWork)

  const program = firstProgram(text)
  return Object.hasOwn(PROGRAM_TABLE, program) ? (PROGRAM_TABLE[program] ?? 'terminal') : 'terminal'
}

function scenesByName(table: Partial<Record<SceneId, readonly string[]>>): Record<string, SceneId> {
  const byName: Record<string, SceneId> = {}
  for (const [scene, names] of Object.entries(table) as [SceneId, readonly string[]][]) {
    for (const name of names) byName[name] = scene
  }
  return byName
}
