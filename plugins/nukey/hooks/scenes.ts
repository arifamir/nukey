import type { SceneId } from '../types'

// What the band says for each scene, word for word.
export const LABELS: Record<SceneId, string> = {
  idle: 'Nukey is napping',
  thinking: 'Thinking it over',
  reading: 'Reading through the files',
  coding: 'Cooking up some code',
  writing: 'Writing it all down',
  designing: 'Decorating the design',
  terminal: 'Running a command',
  searching: 'Hunting through the code',
  web: 'Looking it up online',
  delegating: 'Sending in the helpers',
  talking: 'Plating up the answer',
  asking: 'Needs your input',
  planning: 'Planning the steps',
  tool: 'Using a kitchen tool',
  done: 'Ding! All done',
  permission: 'Waiting for your OK',
  compacting: 'Making room in the fridge',
  error: 'Something got burnt',
  waiting: 'Waiting on something in the oven',
  testing: 'Taste-testing',
  git: 'Stacking up git work',
  installing: 'Bringing in the groceries',
  skill: 'Picking up a new skill',
  memory: 'Noting it on the fridge',
  sharing: 'Serving something up for you',
}

// How the helper line says what a helper is doing ("2 helpers: 1 reading, ...").
export const DOING: Record<SceneId, string> = {
  idle: 'resting',
  thinking: 'thinking',
  reading: 'reading',
  coding: 'writing code',
  writing: 'writing text',
  designing: 'designing',
  terminal: 'running commands',
  searching: 'searching',
  web: 'browsing',
  delegating: 'delegating',
  talking: 'replying',
  asking: 'asking',
  planning: 'planning',
  tool: 'using tools',
  done: 'done',
  permission: 'waiting for permission',
  compacting: 'tidying up',
  error: 'stuck',
  waiting: 'waiting',
  testing: 'running tests',
  git: 'using git',
  installing: 'installing',
  skill: 'loading skills',
  memory: 'remembering',
  sharing: 'sharing',
}

// The scenes `/nukey demo` plays, in order (resting is left out).
export const DEMO_SCENES: readonly SceneId[] = [
  'thinking',
  'reading',
  'coding',
  'writing',
  'designing',
  'terminal',
  'testing',
  'git',
  'installing',
  'searching',
  'web',
  'delegating',
  'planning',
  'skill',
  'memory',
  'tool',
  'sharing',
  'waiting',
  'permission',
  'error',
  'compacting',
  'talking',
  'asking',
  'done',
]

export const isSceneId = (value: unknown): value is SceneId => typeof value === 'string' && Object.hasOwn(LABELS, value)

// Every timing the band keeps, in milliseconds.
export const TIMING = {
  callHold: 1200, // a tool call's scene, and compacting, stay at least this long
  errorHold: 2500, // the error scene after a failed call
  heldQueue: 3, // held scenes waiting behind a hold
  backToThinking: 5000, // after the last running call returned
  rest: 8000, // after done or error, before settling
  frame: 600, // terminal animation tick
  frames: 60, // the frame counter counts 0 to 59
  helperThrottle: 1200, // helper line redraw window
  demoScene: 3000, // per demo scene
} as const

export const DETAIL_MAX = 140
export const SHORT_DETAIL = 60
