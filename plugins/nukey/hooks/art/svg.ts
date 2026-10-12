// A very small SVG writer: tags as strings, numbers trimmed to what they need.

export type Attrs = Record<string, string | number | undefined>

// A number as SVG wants it: at most three decimals, no trailing zeros, no "-0".
export function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function attrText(attrs: Attrs): string {
  let text = ''
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue
    text += ` ${name}="${typeof value === 'number' ? num(value) : value}"`
  }
  return text
}

// One element; children are already-written markup.
export function tag(name: string, attrs: Attrs = {}, ...children: string[]): string {
  const inner = children.join('')
  return inner === '' ? `<${name}${attrText(attrs)}/>` : `<${name}${attrText(attrs)}>${inner}</${name}>`
}

export const group = (attrs: Attrs, ...children: string[]) => tag('g', attrs, ...children)

// A whole document with the given view box and the same size in pixels.
export function svgDoc(x: number, y: number, width: number, height: number, ...children: string[]): string {
  return tag(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width,
      height,
      viewBox: `${num(x)} ${num(y)} ${num(width)} ${num(height)}`,
      'shape-rendering': 'geometricPrecision',
    },
    ...children,
  )
}

// Values joined for SMIL `values` / `keyTimes`.
export const list = (values: readonly (number | string)[]) =>
  values.map(v => (typeof v === 'number' ? num(v) : v)).join(';')

type Loop = { dur: number; begin?: number; keyTimes?: readonly number[]; discrete?: boolean; spline?: boolean }

function timing({ dur, begin, keyTimes, discrete, spline }: Loop, valueCount: number): Attrs {
  const attrs: Attrs = { dur: `${num(dur)}s`, repeatCount: 'indefinite' }
  if (begin) attrs.begin = `${num(begin)}s`
  if (keyTimes) attrs.keyTimes = list(keyTimes)
  if (discrete) attrs.calcMode = 'discrete'
  if (spline) {
    attrs.calcMode = 'spline'
    attrs.keySplines = Array.from({ length: valueCount - 1 }, () => '0.45 0 0.55 1').join(';')
    if (!keyTimes) attrs.keyTimes = list(Array.from({ length: valueCount }, (_, i) => i / (valueCount - 1)))
  }
  return attrs
}

// A looping attribute animation.
export function animate(attributeName: string, values: readonly (number | string)[], loop: Loop): string {
  return tag('animate', { attributeName, values: list(values), ...timing(loop, values.length) })
}

// A looping transform animation (translate, rotate or scale), replacing the element's own transform.
export function animateTransform(
  type: 'translate' | 'rotate' | 'scale',
  values: readonly string[],
  loop: Loop,
): string {
  return tag('animateTransform', {
    attributeName: 'transform',
    type,
    values: values.join(';'),
    ...timing(loop, values.length),
  })
}
