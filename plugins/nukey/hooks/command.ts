// The `/nukey` command: what an argument asks for, and the replies. Pure: no `$`.
import type { ThemeName } from '../types'
import { THEMES, THEME_NAMES } from './themes'

export const COMMAND = {
  name: 'nukey',
  description:
    'Hide or show Nukey. "demo" plays every scene, "meter" shows or hides the control panel, ' +
    '"details" shows its readings in figures, "commands" shows commands as typed, "theme" changes its colours.',
  argumentHint: '[demo|meter|details|commands|theme [name]]',
} as const

export type Ask =
  | { kind: 'toggle' }
  | { kind: 'demo' }
  | { kind: 'meter' }
  | { kind: 'details' }
  | { kind: 'commands' }
  | { kind: 'theme'; name?: string }
  | { kind: 'unknown'; text: string }

// Arguments are trimmed and matched in any letter case.
export function parseArgs(args: string): Ask {
  const text = args.trim()
  const word = text.toLowerCase()
  if (word === '') return { kind: 'toggle' }
  if (word === 'demo' || word === 'meter' || word === 'details' || word === 'commands') return { kind: word }
  if (word === 'theme') return { kind: 'theme' }
  const theme = /^theme\s+(.+)$/s.exec(word)
  if (theme?.[1] !== undefined) return { kind: 'theme', name: theme[1].trim() }
  return { kind: 'unknown', text }
}

// Only the five lower-case names are themes (never a name inherited from Object).
export const themeNamed = (name: unknown): ThemeName | undefined =>
  THEME_NAMES.find(theme => theme === name)

const themeList = (): string => THEME_NAMES.map(name => `${name} (${THEMES[name].label})`).join(', ')

export const reply = {
  hidden: () => 'Nukey is tucked away. Run /nukey again to bring it back.',
  shown: () => 'Nukey is back above the prompt.',
  demo: (scenes: number, seconds: number) =>
    `Playing the Nukey demo: ${scenes} scenes, ${seconds} seconds apiece. Anything Claude does meanwhile picks up again once the demo is over.`,
  meter: (isOn: boolean) =>
    isOn
      ? 'Meter on. The power bars rise with the context window, the big buttons light up with the 5-hour limit and the small ones with the weekly limit.'
      : 'Meter off. Run /nukey meter to switch it on again.',
  details: (isOn: boolean) =>
    isOn
      ? 'Percentages on: each reading is written out next to the meter. Run /nukey details to hide them.'
      : 'Percentages off; the meter itself stays. Run /nukey details to show them again.',
  commands: (isTyped: boolean) =>
    isTyped
      ? 'Showing shell commands exactly as typed. Run /nukey commands to see their descriptions instead.'
      : 'Showing what each shell command is for again. Run /nukey commands to see them as typed.',
  theme: (name: ThemeName) => `Nukey is now ${THEMES[name].label}. Themes: ${themeList()}.`,
  noTheme: (name: string) => `There is no theme "${name}". Pick one of: ${themeList()}.`,
  unknown: (text: string) =>
    `/nukey does not know "${text}". Try: /nukey (hide or show), demo, meter, details, commands, theme, or theme <name>.`,
}
