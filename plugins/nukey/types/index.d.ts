// The 25 things Nukey can be seen doing, one per scene.
export type SceneId =
  | 'idle'
  | 'thinking'
  | 'reading'
  | 'coding'
  | 'writing'
  | 'designing'
  | 'terminal'
  | 'searching'
  | 'web'
  | 'delegating'
  | 'talking'
  | 'asking'
  | 'planning'
  | 'tool'
  | 'done'
  | 'permission'
  | 'compacting'
  | 'error'
  | 'waiting'
  | 'testing'
  | 'git'
  | 'installing'
  | 'skill'
  | 'memory'
  | 'sharing'

// The colour schemes Nukey can be drawn in, picked with `/nukey theme`.
export type ThemeName = 'classic' | 'retro' | 'steel' | 'midnight' | 'bubblegum'

// The meter's readings in whole percents used; null where there is no reading.
export type Gauges = { context: number | null; fiveHour: number | null; week: number | null }

declare module 'claude-code' {
  interface PluginState {
    nukey: {
      // What the band shows: the scene and its one-line detail ('' for none).
      scene: { scene: SceneId; detail: string }
      // Hidden with a bare `/nukey`.
      hidden: boolean
      // The terminal animation frame, 0 to 59.
      frame: number
      // The meter's readings.
      gauges: Gauges
      // The control panel is shown (default on).
      meter: boolean
      // Its readings are spelled out beside it (default off).
      details: boolean
      // Shell calls show their command as typed rather than their description.
      typed: boolean
      // The colours, also kept in `$.store` under `theme`.
      theme: ThemeName
    }
  }
}
