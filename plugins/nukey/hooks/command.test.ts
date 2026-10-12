import { describe, expect, test } from 'claude-code/testing'
import { parseArgs, reply, themeNamed } from './command'
import { readGauges, sameGauges } from './meter'

describe('/nukey arguments', () => {
  test('each argument, in any letter case, trimmed', () => {
    expect(parseArgs('')).toEqual({ kind: 'toggle' })
    expect(parseArgs('   ')).toEqual({ kind: 'toggle' })
    expect(parseArgs('demo')).toEqual({ kind: 'demo' })
    expect(parseArgs(' Demo ')).toEqual({ kind: 'demo' })
    expect(parseArgs('METER')).toEqual({ kind: 'meter' })
    expect(parseArgs('details')).toEqual({ kind: 'details' })
    expect(parseArgs('Commands')).toEqual({ kind: 'commands' })
    expect(parseArgs('theme')).toEqual({ kind: 'theme' })
    expect(parseArgs('Theme  RETRO ')).toEqual({ kind: 'theme', name: 'retro' })
    expect(parseArgs('theme toaster')).toEqual({ kind: 'theme', name: 'toaster' })
  })

  test('anything else is unknown, not a toggle', () => {
    expect(parseArgs('themes')).toEqual({ kind: 'unknown', text: 'themes' })
    expect(parseArgs('dance now')).toEqual({ kind: 'unknown', text: 'dance now' })
    expect(reply.unknown('themes')).toContain('demo, meter, details, commands, theme')
  })

  test('only the five names are themes', () => {
    expect(themeNamed('bubblegum')).toBe('bubblegum')
    expect(themeNamed('toaster')).toBeUndefined()
    expect(themeNamed('constructor')).toBeUndefined()
    expect(themeNamed('Classic')).toBeUndefined()
    expect(themeNamed(undefined)).toBeUndefined()
  })

  test('the theme replies list every theme in cycle order', () => {
    const list = 'classic (Classic cream), retro (Retro mint), steel (Stainless steel), midnight (Midnight), bubblegum (Bubblegum)'
    expect(reply.theme('bubblegum')).toBe(`Nukey is now Bubblegum. Themes: ${list}.`)
    expect(reply.noTheme('toaster')).toContain('no theme "toaster"')
    expect(reply.noTheme('toaster')).toContain(list)
  })
})

describe('meter readings', () => {
  test('whole percents, halves up, the context too', () => {
    const rate = (kind: string, percentUsed: number) => ({ kind, percentUsed })
    expect(readGauges({ context: { percent: 62.5 }, rateLimits: [rate('five_hour', 57.4), rate('seven_day', 41)] })).toEqual({
      context: 63,
      fiveHour: 57,
      week: 41,
    })
    expect(readGauges({ context: {}, rateLimits: [rate('five_hour', 57.5), rate('spend_limit', 3)] })).toEqual({
      context: null,
      fiveHour: 58,
      week: null,
    })
    expect(readGauges({})).toEqual({ context: null, fiveHour: null, week: null })
  })

  test('compared figure by figure', () => {
    expect(sameGauges({ context: 1, fiveHour: null, week: 2 }, { context: 1, fiveHour: null, week: 2 })).toBe(true)
    expect(sameGauges({ context: 1, fiveHour: null, week: 2 }, { context: 1, fiveHour: 0, week: 2 })).toBe(false)
  })
})
