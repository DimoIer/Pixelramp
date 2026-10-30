export interface RGBA {
  /** 0–255 */
  r: number
  /** 0–255 */
  g: number
  /** 0–255 */
  b: number
  /** 0–255 */
  a: number
}

export type PaletteSource = 'generated' | 'extracted' | 'manual'
export type ColorRole = 'shadow' | 'base' | 'highlight' | 'neutral'

export interface PaletteColor {
  rgba: RGBA
  role?: ColorRole
  /** Pixel frequency, present on colors imported/extracted from an image. */
  count?: number
}

export interface RampParams {
  baseColor: RGBA
  count: number
  /** OKLCh lightness, 0–1. */
  lightnessRange: [number, number]
  chromaTaper: boolean
  /** Degrees. Negative values pull shadows toward blue/violet. */
  hueShift: {
    shadows: number
    highlights: number
  }
  colorSpace: 'OKLCh' | 'HSL'
  interpolation: 'linear' | 'eased'
}

export interface Palette {
  id: string
  name: string
  colors: PaletteColor[]
  source: PaletteSource
  createdAt: number
  updatedAt: number
  baseColor?: RGBA
  generationParams?: RampParams
  extractionOptions?: ExtractOptions
}

export type SortDimension = 'lightness' | 'hue' | 'chroma' | 'frequency'
export type SortDirection = 'asc' | 'desc'

export interface ExtractOptions {
  /** Alpha 0 is always ignored. If false, only fully opaque pixels are counted. */
  includeSemiTransparent: boolean
  /** Perceptual OKLab merge distance. 0 disables merging. */
  mergeThreshold: number
  /** Ignore alpha zero (kept for explicit intent / future compatibility). */
  ignoreTransparent: boolean
}

export type FileKind = 'image' | 'project' | 'json' | 'unknown'

export interface OpenedFile {
  path: string
  name: string
  kind: FileKind
  bytes: Uint8Array
}

export interface RecentFile {
  path: string
  name: string
  kind: FileKind
  openedAt: number
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface SaveFileRequest {
  bytes: Uint8Array
  suggestedName: string
  title?: string
  filters?: FileFilter[]
  /** When supplied and saveAs is false, write directly to this path. */
  currentPath?: string | null
  saveAs?: boolean
}

export interface ProjectManifest {
  format: 'pixelramp-project'
  version: 1
  app: 'PixelRamp'
  width: number
  height: number
  name: string
  createdAt: number
  savedAt: number
  palette: Palette | null
}

export interface DesktopApi {
  platform: 'tauri'
  version: string
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    forceClose: () => void
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
    onCloseRequested: (callback: () => void) => () => void
  }
  files: {
    open: (kind: 'image' | 'project' | 'any' | 'json' | 'paletteImage') => Promise<OpenedFile | null>
    openPath: (path: string) => Promise<OpenedFile | null>
    save: (request: SaveFileRequest) => Promise<string | null>
    reveal: (path: string) => void
  }
  palettes: {
    list: () => Promise<Palette[]>
    save: (palette: Palette) => Promise<Palette[]>
    remove: (id: string) => Promise<Palette[]>
  }
  recent: {
    list: () => Promise<RecentFile[]>
    clear: () => Promise<void>
  }
}
