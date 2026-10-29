import { create } from 'zustand'
import type {
  ExtractOptions,
  Palette,
  PaletteColor,
  RGBA,
  RampParams,
  SortDimension,
  SortDirection
} from '@shared/types'
import {
  clamp,
  normalizeRgba,
  parseHex,
  rgbaToHex
} from '../core/color'
import {
  autoLightnessRange,
  defaultRampParams,
  generateRamp
} from '../core/ramp'
import {
  DEFAULT_EXTRACT_OPTIONS,
  clampColorChannel,
  createPalette,
  defaultPaletteName,
  defaultRampName,
  makeId,
  paletteFromRamp,
  touchPalette
} from '../core/palette'
import { sortPaletteColors } from '../core/sort'
import {
  clonePixels,
  createPixels,
  extractRegion,
  flattenLayers,
  toRgbaBytes,
  type Rect
} from '../core/pixels'
import type { ExtractResult } from '../core/extract'
import * as platform from '../platform'
import { paletteWorker } from '../workers/paletteClient'

export const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64] as const
export const MAX_HISTORY = 80

export type ToolId = 'pencil' | 'eraser' | 'bucket' | 'eyedropper' | 'line' | 'rectangle' | 'select'
export type DocumentKind = 'untitled' | 'image' | 'project'
export type SortState = { dimension: SortDimension; direction: SortDirection } | 'custom'

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  pixels: Uint32Array
}

export interface Selection {
  x: number
  y: number
  w: number
  h: number
}

export interface DocumentState {
  id: string
  width: number
  height: number
  name: string
  kind: DocumentKind
  sourcePath: string | null
  projectPath: string | null
  layers: Layer[]
  activeLayer: number
  dirty: boolean
}

interface SnapshotLayer {
  id: string
  name: string
  visible: boolean
  opacity: number
  pixels: Uint32Array
}

export interface Snapshot {
  label: string
  layers: SnapshotLayer[]
  activeLayer: number
  selection: Selection | null
}

export interface HistoryEntry extends Snapshot {
  id: string
  createdAt: number
}

export interface Transaction extends Snapshot {
  startedAt: number
}

export interface ClipboardBuffer {
  width: number
  height: number
  pixels: Uint32Array
}

export interface Viewport {
  width: number
  height: number
}

export interface ExtractSummary {
  result: ExtractResult
  palette: Palette
}

export interface WorkbenchState {
  doc: DocumentState
  revision: number
  tool: ToolId
  foreground: RGBA
  background: RGBA
  pixelPerfect: boolean
  contiguous: boolean
  symmetryX: boolean
  symmetryY: boolean
  showGrid: boolean
  selection: Selection | null
  clipboard: ClipboardBuffer | null
  cursor: { x: number; y: number } | null
  zoom: number
  pan: { x: number; y: number }
  viewport: Viewport
  history: HistoryEntry[]
  redoStack: HistoryEntry[]
  transaction: Transaction | null

  rampParams: RampParams
  activePalette: Palette | null
  paletteDirty: boolean
  library: Palette[]
  libraryLoaded: boolean
  selectedColorIndex: number | null
  sortState: SortState
  extractOptions: ExtractOptions
  extracting: boolean
}

export interface WorkbenchActions {
  setTool: (tool: ToolId) => void
  setForeground: (color: RGBA) => void
  setBackground: (color: RGBA) => void
  swapColors: () => void
  resetColors: () => void
  togglePixelPerfect: () => void
  setPixelPerfect: (value: boolean) => void
  toggleContiguous: () => void
  setContiguous: (value: boolean) => void
  toggleSymmetry: (axis: 'x' | 'y') => void
  setShowGrid: (value: boolean) => void
  setSelection: (selection: Selection | null) => void
  setClipboard: (clipboard: ClipboardBuffer | null) => void
  setCursor: (cursor: { x: number; y: number } | null) => void

  setViewport: (viewport: Viewport) => void
  fitView: () => void
  zoomStep: (direction: 1 | -1) => void
  setZoomAt: (zoom: number, anchorX: number, anchorY: number) => void
  setPan: (pan: { x: number; y: number }) => void

  newDocument: (width: number, height: number) => void
  loadDocument: (input: {
    pixels: Uint32Array
    width: number
    height: number
    name: string
    kind: DocumentKind
    sourcePath: string | null
    projectPath: string | null
    palette?: Palette | null
    clean?: boolean
  }) => void
  markSaved: (filePath: string, name?: string) => void
  setDocumentDirty: (dirty: boolean) => void

  beginTransaction: (label: string) => boolean
  setDraftPixels: (pixels: Uint32Array, selection?: Selection | null) => void
  commitTransaction: () => void
  cancelTransaction: () => void
  undo: () => void
  redo: () => void

  updateRampParams: (patch: {
    count?: number
    lightnessRange?: [number, number]
    chromaTaper?: boolean
    hueShift?: Partial<RampParams['hueShift']>
    colorSpace?: RampParams['colorSpace']
    interpolation?: RampParams['interpolation']
  }) => void
  setRampBaseColor: (color: RGBA, autoRange?: boolean) => void
  applyRampToPalette: (mode: 'replace' | 'append' | 'new') => Palette | null

  setSelectedColorIndex: (index: number | null) => void
  openPalette: (palette: Palette) => void
  setActivePaletteFromProject: (palette: Palette | null) => void
  renameActivePalette: (name: string) => void
  setPaletteColor: (index: number, color: RGBA, role?: PaletteColor['role']) => void
  addPaletteColor: (color?: RGBA) => void
  removePaletteColor: (index: number) => void
  reorderPaletteColor: (from: number, to: number) => void
  sortActivePalette: (dimension: SortDimension, direction: SortDirection) => void
  createEmptyPalette: () => Palette
  newPaletteFromColor: (color: RGBA) => Palette
  saveActivePalette: () => Promise<Palette>
  loadLibrary: () => Promise<void>
  deleteLibraryPalette: (id: string) => Promise<void>
  duplicateLibraryPalette: (id: string) => Promise<Palette>
  importPalette: (palette: Palette) => void

  setExtractOptions: (patch: Partial<ExtractOptions>) => void
  extractFromCanvas: () => Promise<ExtractSummary>
  adoptExtraction: (result: ExtractResult, name: string, options?: ExtractOptions) => Palette

  replaceDocumentPixels: (pixels: Uint32Array) => void
}

export type WorkbenchStore = WorkbenchState & WorkbenchActions

const DEFAULT_BASE = parseHex('#7A8B6F') ?? { r: 122, g: 139, b: 111, a: 255 }

function makeInitialState(): WorkbenchState {
  const rampParams = defaultRampParams(DEFAULT_BASE, 7)
  const ramp = generateRamp(rampParams)
  const activePalette = paletteFromRamp(ramp, rampParams, 'Moss & Ember')
  return {
    doc: {
      id: makeId(),
      width: 32,
      height: 32,
      name: 'untitled',
      kind: 'untitled',
      sourcePath: null,
      projectPath: null,
      layers: [
        {
          id: makeId(),
          name: 'Layer 1',
          visible: true,
          opacity: 1,
          pixels: createPixels(32, 32)
        }
      ],
      activeLayer: 0,
      dirty: false
    },
    revision: 0,
    tool: 'pencil',
    foreground: DEFAULT_BASE,
    background: parseHex('#171913') ?? { r: 23, g: 25, b: 19, a: 255 },
    pixelPerfect: true,
    contiguous: true,
    symmetryX: false,
    symmetryY: false,
    showGrid: true,
    selection: null,
    clipboard: null,
    cursor: null,
    zoom: 16,
    pan: { x: 0, y: 0 },
    viewport: { width: 900, height: 640 },
    history: [],
    redoStack: [],
    transaction: null,
    rampParams,
    activePalette,
    paletteDirty: true,
    library: [],
    libraryLoaded: false,
    selectedColorIndex: null,
    sortState: { dimension: 'lightness', direction: 'asc' },
    extractOptions: { ...DEFAULT_EXTRACT_OPTIONS },
    extracting: false
  }
}

function snapshotOf(state: WorkbenchState, label: string): Snapshot {
  return {
    label,
    layers: state.doc.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: clonePixels(layer.pixels)
    })),
    activeLayer: state.doc.activeLayer,
    selection: state.selection ? { ...state.selection } : null
  }
}

function makeHistoryEntry(snapshot: Snapshot): HistoryEntry {
  return { ...snapshot, id: makeId(), createdAt: Date.now() }
}

function activePixels(state: WorkbenchState): Uint32Array {
  return state.doc.layers[state.doc.activeLayer]?.pixels ?? new Uint32Array(0)
}

function layersEqual(a: SnapshotLayer[], layers: Layer[]): boolean {
  if (a.length !== layers.length) return false
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index].pixels
    const right = layers[index].pixels
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false
    }
  }
  return true
}

function withLayerPixels(layers: Layer[], activeLayer: number, pixels: Uint32Array): Layer[] {
  return layers.map((layer, index) =>
    index === activeLayer ? { ...layer, pixels } : layer
  )
}

function nextNumberedName(palettes: Palette[]): string {
  let index = 1
  const names = new Set(palettes.map((entry) => entry.name))
  while (names.has(defaultPaletteName(index))) index += 1
  return defaultPaletteName(index)
}

function restoreHistoryEntry(entry: Snapshot | HistoryEntry): {
  layers: Layer[]
  activeLayer: number
  selection: Selection | null
} {
  return {
    layers: entry.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: clonePixels(layer.pixels)
    })),
    activeLayer: entry.activeLayer,
    selection: entry.selection ? { ...entry.selection } : null
  }
}

export const useWorkbench = create<WorkbenchStore>((set, get) => ({
  ...makeInitialState(),

  setTool: (tool) => set({ tool }),
  setForeground: (color) => set({ foreground: normalizeRgba(color) }),
  setBackground: (color) => set({ background: normalizeRgba(color) }),
  swapColors: () => set((state) => ({ foreground: state.background, background: state.foreground })),
  resetColors: () =>
    set({
      foreground: { r: 0, g: 0, b: 0, a: 255 },
      background: { r: 255, g: 255, b: 255, a: 255 }
    }),
  togglePixelPerfect: () => set((state) => ({ pixelPerfect: !state.pixelPerfect })),
  setPixelPerfect: (value) => set({ pixelPerfect: value }),
  toggleContiguous: () => set((state) => ({ contiguous: !state.contiguous })),
  setContiguous: (value) => set({ contiguous: value }),
  toggleSymmetry: (axis) =>
    set((state) => (axis === 'x' ? { symmetryX: !state.symmetryX } : { symmetryY: !state.symmetryY })),
  setShowGrid: (value) => set({ showGrid: value }),
  setSelection: (selection) => set({ selection }),
  setClipboard: (clipboard) => set({ clipboard }),
  setCursor: (cursor) => set({ cursor }),

  setViewport: (viewport) =>
    set((state) =>
      state.viewport.width === viewport.width && state.viewport.height === viewport.height
        ? state
        : { viewport }
    ),

  fitView: () => {
    const { doc, viewport } = get()
    const availableWidth = Math.max(80, viewport.width - 128)
    const availableHeight = Math.max(80, viewport.height - 128)
    let zoom = 1
    for (const level of ZOOM_LEVELS) {
      if (doc.width * level <= availableWidth && doc.height * level <= availableHeight) zoom = level
    }
    set({ zoom, pan: { x: 0, y: 0 } })
  },

  zoomStep: (direction) => {
    const { zoom, viewport } = get()
    const levels = [...ZOOM_LEVELS]
    const next =
      direction > 0
        ? levels.find((level) => level > zoom) ?? levels[levels.length - 1]
        : [...levels].reverse().find((level) => level < zoom) ?? levels[0]
    get().setZoomAt(next, viewport.width / 2, viewport.height / 2)
  },

  setZoomAt: (zoom, anchorX, anchorY) => {
    const state = get()
    const nextZoom = clamp(zoom, 1, 64)
    if (nextZoom === state.zoom) return
    const offsetX = state.pan.x + state.viewport.width / 2 - (state.doc.width * state.zoom) / 2
    const offsetY = state.pan.y + state.viewport.height / 2 - (state.doc.height * state.zoom) / 2
    const worldX = (anchorX - offsetX) / state.zoom
    const worldY = (anchorY - offsetY) / state.zoom
    const nextPan = {
      x:
        anchorX -
        worldX * nextZoom -
        state.viewport.width / 2 +
        (state.doc.width * nextZoom) / 2,
      y:
        anchorY -
        worldY * nextZoom -
        state.viewport.height / 2 +
        (state.doc.height * nextZoom) / 2
    }
    set({ zoom: nextZoom, pan: nextPan })
  },

  setPan: (pan) => set({ pan }),

  newDocument: (width, height) => {
    const size = clamp(Math.round(width), 1, 256)
    const state = get()
    set({
      doc: {
        id: makeId(),
        width: size,
        height: size,
        name: 'untitled',
        kind: 'untitled',
        sourcePath: null,
        projectPath: null,
        layers: [
          {
            id: makeId(),
            name: 'Layer 1',
            visible: true,
            opacity: 1,
            pixels: createPixels(size, size)
          }
        ],
        activeLayer: 0,
        dirty: false
      },
      revision: state.revision + 1,
      history: [],
      redoStack: [],
      transaction: null,
      selection: null,
      cursor: null,
      zoom: Math.min(16, Math.max(1, Math.floor(512 / size))),
      pan: { x: 0, y: 0 }
    })
    get().fitView()
  },

  loadDocument: (input) => {
    const state = get()
    const size = Math.max(1, Math.min(256, Math.round(input.width)))
    const height = Math.max(1, Math.min(256, Math.round(input.height)))
    set({
      doc: {
        id: makeId(),
        width: size,
        height,
        name: input.name,
        kind: input.kind,
        sourcePath: input.sourcePath,
        projectPath: input.projectPath,
        layers: [
          {
            id: makeId(),
            name: 'Layer 1',
            visible: true,
            opacity: 1,
            pixels: clonePixels(input.pixels)
          }
        ],
        activeLayer: 0,
        dirty: false
      },
      revision: state.revision + 1,
      history: [],
      redoStack: [],
      transaction: null,
      selection: null,
      cursor: null,
      pan: { x: 0, y: 0 }
    })
    if (input.palette !== undefined) {
      if (input.palette) {
        const clone: Palette = JSON.parse(JSON.stringify(input.palette)) as Palette
        set({
          activePalette: clone,
          paletteDirty: !get().library.some((entry) => entry.id === clone.id),
          selectedColorIndex: null
        })
        if (clone.generationParams) set({ rampParams: clone.generationParams })
        else if (clone.baseColor) {
          set({ rampParams: { ...get().rampParams, baseColor: clone.baseColor } })
        }
      } else {
        set({ activePalette: null, paletteDirty: false, selectedColorIndex: null })
      }
    }
    get().fitView()
  },

  markSaved: (filePath, name) =>
    set((state) => ({
      doc: {
        ...state.doc,
        dirty: false,
        kind: 'project',
        projectPath: filePath,
        sourcePath: filePath,
        name: name ?? state.doc.name
      }
    })),

  setDocumentDirty: (dirty) => set((state) => ({ doc: { ...state.doc, dirty } })),

  beginTransaction: (label) => {
    const state = get()
    if (state.transaction) return false
    set({
      transaction: {
        ...snapshotOf(state, label),
        startedAt: Date.now()
      }
    })
    return true
  },

  setDraftPixels: (pixels, selection) => {
    const state = get()
    const layers = withLayerPixels(state.doc.layers, state.doc.activeLayer, pixels)
    set({
      doc: { ...state.doc, layers },
      revision: state.revision + 1,
      ...(selection !== undefined ? { selection } : {})
    })
  },

  commitTransaction: () => {
    const state = get()
    if (!state.transaction) return
    if (layersEqual(state.transaction.layers, state.doc.layers)) {
      set({ transaction: null })
      return
    }
    const entry = makeHistoryEntry({
      label: state.transaction.label,
      layers: state.transaction.layers,
      activeLayer: state.transaction.activeLayer,
      selection: state.transaction.selection
    })
    set({
      transaction: null,
      history: [...state.history, entry].slice(-MAX_HISTORY),
      redoStack: [],
      doc: { ...state.doc, dirty: true }
    })
  },

  cancelTransaction: () => {
    const state = get()
    if (!state.transaction) return
    const restored = restoreHistoryEntry(state.transaction)
    set({
      doc: { ...state.doc, layers: restored.layers, activeLayer: restored.activeLayer },
      selection: restored.selection,
      transaction: null,
      revision: state.revision + 1
    })
  },

  undo: () => {
    const state = get()
    if (state.transaction) {
      get().cancelTransaction()
      return
    }
    const previous = state.history[state.history.length - 1]
    if (!previous) return
    const current = makeHistoryEntry(snapshotOf(state, previous.label))
    const restored = restoreHistoryEntry(previous)
    set({
      doc: { ...state.doc, layers: restored.layers, activeLayer: restored.activeLayer, dirty: true },
      selection: restored.selection,
      history: state.history.slice(0, -1),
      redoStack: [...state.redoStack, current],
      transaction: null,
      revision: state.revision + 1
    })
  },

  redo: () => {
    const state = get()
    if (state.transaction) return
    const next = state.redoStack[state.redoStack.length - 1]
    if (!next) return
    const current = makeHistoryEntry(snapshotOf(state, next.label))
    const restored = restoreHistoryEntry(next)
    set({
      doc: { ...state.doc, layers: restored.layers, activeLayer: restored.activeLayer, dirty: true },
      selection: restored.selection,
      history: [...state.history, current].slice(-MAX_HISTORY),
      redoStack: state.redoStack.slice(0, -1),
      transaction: null,
      revision: state.revision + 1
    })
  },

  updateRampParams: (patch) =>
    set((state) => ({
      rampParams: {
        ...state.rampParams,
        ...(patch.count !== undefined ? { count: clamp(Math.round(patch.count), 3, 15) } : {}),
        ...(patch.lightnessRange ? { lightnessRange: patch.lightnessRange } : {}),
        ...(patch.chromaTaper !== undefined ? { chromaTaper: patch.chromaTaper } : {}),
        ...(patch.hueShift
          ? { hueShift: { ...state.rampParams.hueShift, ...patch.hueShift } }
          : {}),
        ...(patch.colorSpace ? { colorSpace: patch.colorSpace } : {}),
        ...(patch.interpolation ? { interpolation: patch.interpolation } : {})
      }
    })),

  setRampBaseColor: (color, autoRange = true) =>
    set((state) => ({
      rampParams: {
        ...state.rampParams,
        baseColor: normalizeRgba(color),
        ...(autoRange ? { lightnessRange: autoLightnessRange(color) } : {})
      }
    })),

  applyRampToPalette: (mode) => {
    const state = get()
    const ramp = generateRamp(state.rampParams)
    if (ramp.colors.length === 0) return null
    const generated = paletteFromRamp(ramp, state.rampParams)
    let palette: Palette
    if (mode === 'new' || !state.activePalette) {
      palette = {
        ...generated,
        name:
          mode === 'new'
            ? defaultRampName(state.rampParams.baseColor, state.rampParams.count)
            : state.activePalette?.name ?? defaultPaletteName(state.library.length + 1)
      }
    } else if (mode === 'append' && state.activePalette) {
      palette = touchPalette({
        ...state.activePalette,
        source: 'generated',
        baseColor: state.rampParams.baseColor,
        generationParams: { ...state.rampParams },
        colors: [
          ...state.activePalette.colors,
          ...generated.colors.map((color) => ({ ...color, rgba: { ...color.rgba } }))
        ]
      })
    } else {
      palette = touchPalette({
        ...state.activePalette,
        source: 'generated',
        baseColor: state.rampParams.baseColor,
        generationParams: { ...state.rampParams },
        colors: generated.colors.map((color) => ({ ...color, rgba: { ...color.rgba } }))
      })
    }
    set({
      activePalette: palette,
      paletteDirty: true,
      selectedColorIndex: null,
      sortState: { dimension: 'lightness', direction: 'asc' }
    })
    return palette
  },

  setSelectedColorIndex: (index) => set({ selectedColorIndex: index }),

  openPalette: (palette) => {
    const clone: Palette = JSON.parse(JSON.stringify(palette)) as Palette
    set({
      activePalette: clone,
      paletteDirty: false,
      selectedColorIndex: null,
      sortState: 'custom'
    })
    if (clone.generationParams) set({ rampParams: { ...clone.generationParams } })
    else if (clone.baseColor) set({ rampParams: { ...get().rampParams, baseColor: clone.baseColor } })
  },

  setActivePaletteFromProject: (palette) => {
    if (!palette) {
      set({ activePalette: null, paletteDirty: false, selectedColorIndex: null })
      return
    }
    const clone: Palette = JSON.parse(JSON.stringify(palette)) as Palette
    const existsInLibrary = get().library.some((entry) => entry.id === clone.id)
    set({
      activePalette: clone,
      paletteDirty: !existsInLibrary,
      selectedColorIndex: null,
      sortState: 'custom'
    })
    if (clone.generationParams) set({ rampParams: { ...clone.generationParams } })
  },

  renameActivePalette: (name) =>
    set((state) => {
      if (!state.activePalette) return state
      const trimmed = name.trim()
      if (!trimmed || trimmed === state.activePalette.name) return state
      return {
        activePalette: { ...state.activePalette, name: trimmed, updatedAt: Date.now() },
        paletteDirty: true
      }
    }),

  setPaletteColor: (index, color, role) =>
    set((state) => {
      if (!state.activePalette) return state
      const colors = state.activePalette.colors.map((entry, i) =>
        i === index
          ? {
              ...entry,
              rgba: normalizeRgba(color),
              ...(role !== undefined ? { role } : {})
            }
          : entry
      )
      return {
        activePalette: { ...state.activePalette, colors, updatedAt: Date.now() },
        paletteDirty: true,
        foreground:
          state.selectedColorIndex === index ? normalizeRgba(color) : state.foreground
      }
    }),

  addPaletteColor: (color) => {
    const state = get()
    const palette =
      state.activePalette ??
      createPalette({
        name: nextNumberedName(state.library),
        colors: [],
        source: 'manual'
      })
    const rgba = normalizeRgba(color ?? state.foreground)
    const colors = [...palette.colors, { rgba }]
    set({
      activePalette: { ...palette, colors, source: palette.source, updatedAt: Date.now() },
      paletteDirty: true,
      selectedColorIndex: colors.length - 1
    })
  },

  removePaletteColor: (index) =>
    set((state) => {
      if (!state.activePalette) return state
      const colors = state.activePalette.colors.filter((_, i) => i !== index)
      let selected = state.selectedColorIndex
      if (selected !== null) {
        if (index === selected) selected = null
        else if (index < selected) selected -= 1
        if (selected !== null && selected >= colors.length) selected = colors.length - 1
        if (selected !== null && selected < 0) selected = null
      }
      return {
        activePalette: { ...state.activePalette, colors, updatedAt: Date.now() },
        paletteDirty: true,
        selectedColorIndex: selected
      }
    }),

  reorderPaletteColor: (from, to) =>
    set((state) => {
      if (!state.activePalette) return state
      const colors = [...state.activePalette.colors]
      if (from < 0 || from >= colors.length || to < 0 || to >= colors.length) return state
      const [moved] = colors.splice(from, 1)
      colors.splice(to, 0, moved)
      return {
        activePalette: { ...state.activePalette, colors, updatedAt: Date.now() },
        paletteDirty: true,
        selectedColorIndex: to,
        sortState: 'custom'
      }
    }),

  sortActivePalette: (dimension, direction) =>
    set((state) => {
      if (!state.activePalette) return state
      return {
        activePalette: {
          ...state.activePalette,
          colors: sortPaletteColors(state.activePalette.colors, dimension, direction),
          updatedAt: Date.now()
        },
        paletteDirty: true,
        selectedColorIndex: null,
        sortState: { dimension, direction }
      }
    }),

  createEmptyPalette: () => {
    const state = get()
    const palette = createPalette({
      name: nextNumberedName(state.library),
      colors: [{ rgba: normalizeRgba(state.foreground) }],
      source: 'manual'
    })
    set({
      activePalette: palette,
      paletteDirty: true,
      selectedColorIndex: 0,
      sortState: 'custom'
    })
    return palette
  },

  newPaletteFromColor: (color) => {
    const state = get()
    const palette = createPalette({
      name: nextNumberedName(state.library),
      colors: [{ rgba: normalizeRgba(color) }],
      source: 'manual'
    })
    set({ activePalette: palette, paletteDirty: true, selectedColorIndex: 0, sortState: 'custom' })
    return palette
  },

  saveActivePalette: async () => {
    const state = get()
    if (!state.activePalette) throw new Error('There is no active palette to save.')
    if (state.activePalette.colors.length === 0) throw new Error('Add at least one color first.')
    const saved = touchPalette(state.activePalette)
    const library = await platform.savePalette(saved)
    set({ library, activePalette: saved, paletteDirty: false, libraryLoaded: true })
    return saved
  },

  loadLibrary: async () => {
    try {
      const library = await platform.listPalettes()
      set({ library, libraryLoaded: true })
    } catch {
      set({ libraryLoaded: true })
    }
  },

  deleteLibraryPalette: async (id) => {
    const library = await platform.removePalette(id)
    set({
      library,
      paletteDirty: get().activePalette?.id === id ? true : get().paletteDirty
    })
  },

  duplicateLibraryPalette: async (id) => {
    const state = get()
    const source = state.library.find((entry) => entry.id === id)
    if (!source) throw new Error('Palette not found.')
    const copy = {
      ...source,
      id: makeId(),
      name: `${source.name} copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: source.colors.map((color) => ({ ...color, rgba: { ...color.rgba } }))
    }
    const library = await platform.savePalette(copy)
    set({ library, libraryLoaded: true })
    return copy
  },

  importPalette: (palette) => {
    const clone: Palette = JSON.parse(JSON.stringify(palette)) as Palette
    set({
      activePalette: clone,
      paletteDirty: true,
      selectedColorIndex: null,
      sortState: 'custom'
    })
    if (clone.generationParams) set({ rampParams: { ...clone.generationParams } })
  },

  setExtractOptions: (patch) =>
    set((state) => ({ extractOptions: { ...state.extractOptions, ...patch } })),

  extractFromCanvas: async () => {
    const state = get()
    if (state.extracting) throw new Error('Color extraction is already running.')
    set({ extracting: true })
    try {
      const composite = flattenLayers(state.doc.layers, state.doc.width, state.doc.height)
      let source = composite
      let label = 'Canvas'
      if (state.selection && state.selection.w > 0 && state.selection.h > 0) {
        source = extractRegion(
          composite,
          state.doc.width,
          state.doc.height,
          state.selection
        )
        label = 'Selection'
      }
      const bytes = toRgbaBytes(source)
      const result = await paletteWorker.extract(bytes, state.extractOptions)
      if (result.colors.length === 0) {
        throw new Error('No visible colors found. Draw something or include semi-transparent pixels.')
      }
      const name =
        label === 'Selection'
          ? `${state.doc.name} · selection`
          : `${state.doc.name} · extracted`
      const palette = get().adoptExtraction(result, name, state.extractOptions)
      return { result, palette }
    } finally {
      set({ extracting: false })
    }
  },

  adoptExtraction: (result, name, options) => {
    const colors = result.colors.map((color) => ({
      rgba: { ...color.rgba },
      count: color.count
    }))
    const palette = createPalette({
      name,
      colors,
      source: 'extracted',
      ...(options ? { extractionOptions: options } : {})
    })
    set({
      activePalette: palette,
      paletteDirty: true,
      selectedColorIndex: null,
      libraryLoaded: get().libraryLoaded,
      sortState: { dimension: 'lightness', direction: 'asc' }
    })
    return palette
  },

  replaceDocumentPixels: (pixels) => {
    const state = get()
    const next = withLayerPixels(state.doc.layers, state.doc.activeLayer, pixels)
    set({
      doc: { ...state.doc, layers: next, dirty: true },
      revision: state.revision + 1
    })
  }
}))

export const useActivePixels = (): Uint32Array =>
  useWorkbench((state) => state.doc.layers[state.doc.activeLayer]?.pixels ?? EMPTY_PIXELS)

const EMPTY_PIXELS = new Uint32Array(0)

export function normalizeSelection(rect: Rect, width: number, height: number): Selection | null {
  const x = Math.max(0, Math.min(width, Math.round(rect.x)))
  const y = Math.max(0, Math.min(height, Math.round(rect.y)))
  const w = Math.max(0, Math.min(width - x, Math.round(rect.w)))
  const h = Math.max(0, Math.min(height - y, Math.round(rect.h)))
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

export function paletteColorCss(color: RGBA): string {
  return rgbaToHex(color)
}

export function normalizeColorValue(color: RGBA): RGBA {
  return normalizeRgba({
    r: clampColorChannel(color.r),
    g: clampColorChannel(color.g),
    b: clampColorChannel(color.b),
    a: clampColorChannel(color.a)
  })
}
