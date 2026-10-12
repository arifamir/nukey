// Nukey and its prop together in one 128 x 64 drawing, for pages that show a scene on its own
// (the band itself draws the two halves separately).
import type { SceneId } from '../../types'
import type { Theme } from '../themes'
import { CANVAS } from './index'
import { NUKEY_AT, POSES, placedNukey } from './nukey'
import { propBody } from './props'
import { svgDoc } from './svg'

export function drawScene(scene: SceneId, theme: Theme): string {
  return svgDoc(
    0,
    0,
    CANVAS.width,
    CANVAS.height,
    placedNukey(POSES[scene], theme, NUKEY_AT.x, NUKEY_AT.y),
    propBody(scene, theme),
  )
}
