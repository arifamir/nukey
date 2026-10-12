// Nukey and its props on the terminal: three rows of glyphs each.
import type { SceneId } from '../../types'

export type Rows = readonly [string, string, string]

const FACES: Partial<Record<SceneId, string>> = {
  idle: '- -',
  compacting: '- -',
  done: '^ ^',
  error: 'x x',
  thinking: '° °',
}

const AT_REST = new Set<SceneId>(['idle', 'done'])

// The dial light stays lit at rest and on done, and blinks with the frame counter otherwise.
export function dialLight(scene: SceneId, tick: number): string {
  return AT_REST.has(scene) || tick % 2 === 0 ? '▪' : '▫'
}

export function nukeyRows(scene: SceneId, tick: number): Rows {
  const face = FACES[scene] ?? '◕ ◕'
  return ['┌─────┬─┐', `│ ${face} │${dialLight(scene, tick)}│`, '└┬───┬┴─┘']
}

// Every scene's frames; all rows of a scene share one width.
// Frame counts and widths follow the reference table so the layout never jumps.
export const PROP_FRAMES: Record<SceneId, readonly Rows[]> = {
  // A "z" drifts up and to the right, a bigger "Z" following.
  idle: [
    ['    ', '    ', 'z   '],
    ['    ', ' z  ', 'z   '],
    ['  Z ', ' z  ', 'z   '],
  ],
  // A thought cloud; the kernel inside heats up and pops.
  thinking: [
    ['  ╭────╮', '∘ │ .  │', '  ╰────╯'],
    ['  ╭────╮', '∘ │ o  │', '  ╰────╯'],
    ['  ╭────╮', '∘ │*O* │', '  ╰────╯'],
  ],
  // A recipe card; the highlighted (heavy) line slides down.
  reading: [
    ['│━━━━ │', '│──── │', '│───  │'],
    ['│──── │', '│━━━━ │', '│───  │'],
    ['│──── │', '│──── │', '│━━━  │'],
  ],
  // A tablet on its stand, code and a blinking cursor on it.
  coding: [
    ['╭─────╮', '│</>█ │', '╰──┴──╯'],
    ['╭─────╮', '│</>  │', '╰──┴──╯'],
  ],
  // An order pad; a pencil writes its lines.
  writing: [
    ['┌oooo┐', '│─/  │', '│    │'],
    ['┌oooo┐', '│───/│', '│    │'],
    ['┌oooo┐', '│────│', '│──/ │'],
  ],
  // A piping bag moves along a cake, icing following it.
  designing: [
    ['▼    ', '~    ', '▓▓▓▓▓'],
    [' ▼   ', '~~   ', '▓▓▓▓▓'],
    ['  ▼  ', '~~~  ', '▓▓▓▓▓'],
    ['   ▼ ', '~~~~ ', '▓▓▓▓▓'],
  ],
  // An oven display: a prompt with a blinking cursor, two knobs below.
  terminal: [
    ['┌─────┐', '│$ █  │', '└o───o┘'],
    ['┌─────┐', '│$    │', '└o───o┘'],
  ],
  // A lens moving over a spice rack.
  searching: [
    ['O▮▮▮▮▮▮', '═╲═════', '▮▮▮▮▮▮▮'],
    ['▮▮▮O▮▮▮', '════╲══', '▮▮▮▮▮▮▮'],
    ['▮▮▮▮▮O▮', '══════╲', '▮▮▮▮▮▮▮'],
  ],
  // A tablet on a stand: a page loads, then shows its text.
  web: [
    ['╭─────╮', '│█    │', '╰──┴──╯'],
    ['╭─────╮', '│███  │', '╰──┴──╯'],
    ['╭─────╮', '│█████│', '╰──┴──╯'],
    ['╭─────╮', '│≡≡≡≡ │', '╰──┴──╯'],
  ],
  // Two little microwave helpers hopping in turn.
  delegating: [
    [' [oo]     ', '      [oo]', '──────────'],
    ['      [oo]', ' [oo]     ', '──────────'],
  ],
  // A speech bubble whose text writes in.
  talking: [
    ['╭────╮', '│█   │', '╰┬───╯'],
    ['╭────╮', '│──█ │', '╰┬───╯'],
    ['╭────╮', '│────│', '╰┬───╯'],
  ],
  // A small speech bubble whose question mark blinks.
  asking: [
    ['┌─┐', '│?│', '╰┘ '],
    ['┌─┐', '│ │', '╰┘ '],
  ],
  // A meal-plan checklist ticking off its items.
  planning: [
    ['□ ─────', '□ ──── ', '□ ─────'],
    ['✓ ─────', '□ ──── ', '□ ─────'],
    ['✓ ─────', '✓ ──── ', '□ ─────'],
    ['✓ ─────', '✓ ──── ', '✓ ─────'],
  ],
  // A whisk spinning: its wires seen flat, then edge on.
  tool: [
    ['( )', ' V ', ' ┃ '],
    ['(|)', ' V ', ' ┃ '],
  ],
  // DING! with a sparkle in each corner on the second frame.
  done: [
    ['       ', ' DING! ', '       '],
    ['·     ·', ' DING! ', '·     ·'],
  ],
  // A hanging sign asking OK?, swinging.
  permission: [
    ['   ╻    ', '  ╱ ╲   ', ' [OK?]  '],
    ['   ╻    ', '  ╱ ╲   ', '  [OK?] '],
  ],
  // A sponge scrubbing a plate, bubbles rising.
  compacting: [
    ['  o    ', '██     ', '▀▀▀▀▀▀▀'],
    [' o  °  ', '  ██   ', '▀▀▀▀▀▀▀'],
    ['°  o  .', '    ██ ', '▀▀▀▀▀▀▀'],
  ],
  // Burnt toast, its smoke drifting.
  error: [
    [' ~ ~', '╭──╮', '│▓▓│'],
    ['~ ~ ', '╭──╮', '│▓▓│'],
  ],
  // An egg timer, the sand running through.
  waiting: [
    ['╲███╱', '  ┊  ', '╱   ╲'],
    ['╲▄▄▄╱', '  ┊  ', '╱ ▄ ╲'],
    ['╲ ▄ ╱', '  ┊  ', '╱▄▄▄╲'],
    ['╲   ╱', '  ┊  ', '╱███╲'],
  ],
  // Cupcakes ticked off one by one.
  testing: [
    ['· ▟▙', '· ▟▙', '· ▟▙'],
    ['✓ ▟▙', '· ▟▙', '· ▟▙'],
    ['✓ ▟▙', '✓ ▟▙', '· ▟▙'],
    ['✓ ▟▙', '✓ ▟▙', '✓ ▟▙'],
  ],
  // A new plate slides onto the stack.
  git: [
    ['     ══', ' ═════ ', ' ═════ '],
    ['   ════', ' ═════ ', ' ═════ '],
    [' ═════ ', ' ═════ ', ' ═════ '],
  ],
  // Groceries dropping into a bag.
  installing: [
    ['  o  ', '┃   ┃', '┗━━━┛'],
    ['     ', '┃ o ┃', '┗━━━┛'],
    ['  v  ', '┃ o ┃', '┗━━━┛'],
  ],
  // A medal on its ribbon, glinting.
  skill: [
    ['╲ ╱', '(*)', '   '],
    ['╲ ╱', '(+)', '   '],
  ],
  // A note stuck on the fridge, then pinned by a magnet.
  memory: [
    ['╭───╮', '│  ▕│', '╰───╯'],
    ['╭───╮', '│▫ ▕│', '╰───╯'],
    ['╭───╮', '│▪ ▕│', '╰───╯'],
  ],
  // A serving cloche lifts to show sparkles.
  sharing: [
    ['     ', '╭─┴─╮', '▀▀▀▀▀'],
    ['╭─┴─╮', '  ·  ', '▀▀▀▀▀'],
    ['╭─┴─╮', ' ·*· ', '▀▀▀▀▀'],
  ],
}

export function propRows(scene: SceneId, tick: number): Rows {
  const frames = PROP_FRAMES[scene]
  const index = ((Math.trunc(tick) % frames.length) + frames.length) % frames.length
  return frames[index]!
}
