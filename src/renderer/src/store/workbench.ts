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
  resizeCanvasPixels,
  resizeNearest,
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
export type ResizeAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

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

export interface DocumentTab {
  id: string
  doc: DocumentState
  revision: number
  history: HistoryEntry[]
  redoStack: HistoryEntry[]
  selection: Selection | null
  zoom: number
  pan: { x: number; y: number }
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
  tabs: DocumentTab[]
  activeTabId: string
  revision: number
  tool: ToolId
  brushSize: number
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
  setBrushSize: (size: number) => void
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
  newDocumentTab: (width: number, height: number) => void
  loadDocumentTab: (input: {
    pixels: Uint32Array
    width: number
    height: number
    name: string
    kind: DocumentKind
    sourcePath: string | null
    projectPath: string | null
    palette?: Palette | null
    clean?: boolean
    layers?: Array<{
      id: string
      name: string
      visible: boolean
      opacity: number
      pixels: Uint32Array
    }>
    activeLayer?: number
  }) => void
  switchTab: (id: string) => void
  closeTab: (id: string) => void
  closeActiveTab: () => void
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
  resizeDocument: (width: number, height: number, anchor: ResizeAnchor) => void
  applyActiveLayerPixels: (label: string, pixels: Uint32Array) => void
  scaleTexture: (width: number, height: number) => void

  addLayer: () => void
  duplicateLayer: (index?: number) => void
  removeLayer: (index?: number) => boolean
  selectLayer: (index: number) => void
  setLayerVisibility: (index: number, visible: boolean) => void
  setLayerOpacity: (index: number, opacity: number) => void
  renameLayer: (index: number, name: string) => void
  moveLayer: (index: number, direction: -1 | 1) => void
  mergeLayerDown: (index?: number) => boolean

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
  const doc: DocumentState = {
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
  }
  const tab: DocumentTab = {
    id: doc.id,
    doc,
    revision: 0,
    history: [],
    redoStack: [],
    selection: null,
    zoom: 16,
    pan: { x: 0, y: 0 }
  }
  return {
    doc,
    tabs: [tab],
    activeTabId: tab.id,
    revision: 0,
    tool: 'pencil',
    brushSize: 1,
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
    const left = a[index]
    const right = layers[index]
    if (
      left.id !== right.id ||
      left.name !== right.name ||
      left.visible !== right.visible ||
      left.opacity !== right.opacity
    ) {
      return false
    }
    if (left.pixels.length !== right.pixels.length) return false
    for (let i = 0; i < left.pixels.length; i += 1) {
      if (left.pixels[i] !== right.pixels[i]) return false
    }
  }
  return true
}

function layerName(layers: Layer[]): string {
  let index = layers.length + 1
  const names = new Set(layers.map((layer) => layer.name))
  while (names.has(`Layer ${index}`)) index += 1
  return `Layer ${index}`
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

function cloneDocument(doc: DocumentState): DocumentState {
  return {
    ...doc,
    layers: doc.layers.map((layer) => ({ ...layer, pixels: clonePixels(layer.pixels) }))
  }
}

function captureTab(state: WorkbenchState): DocumentTab {
  return {
    id: state.activeTabId,
    doc: cloneDocument(state.doc),
    revision: state.revision,
    history: [...state.history],
    redoStack: [...state.redoStack],
    selection: state.selection ? { ...state.selection } : null,
    zoom: state.zoom,
    pan: { ...state.pan }
  }
}

function blankDocument(width: number, height: number): DocumentState {
  return {
    id: makeId(),
    width,
    height,
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
        pixels: createPixels(width, height)
      }
    ],
    activeLayer: 0,
    dirty: false
  }
}

function tabSnapshot(tab: DocumentTab): Partial<WorkbenchState> {
  return {
    doc: cloneDocument(tab.doc),
    activeTabId: tab.id,
    revision: tab.revision,
    history: [...tab.history],
    redoStack: [...tab.redoStack],
    selection: tab.selection ? { ...tab.selection } : null,
    zoom: tab.zoom,
    pan: { ...tab.pan },
    transaction: null,
    cursor: null
  }
}

export const useWorkbench = create<WorkbenchStore>((set, get) => ({
  ...makeInitialState(),

  setTool: (tool) => set({ tool }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(32, Math.round(size))) }),
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

  newDocumentTab: (width, height) => {
    const state = get()
    const current = captureTab(state)
    const tabs = state.tabs.map((tab) => (tab.id === current.id ? current : tab))
    const doc = blankDocument(
      Math.max(1, Math.min(256, Math.round(width))),
      Math.max(1, Math.min(256, Math.round(height)))
    )
    const tab: DocumentTab = {
      id: doc.id,
      doc,
      revision: 0,
      history: [],
      redoStack: [],
      selection: null,
      zoom: 16,
      pan: { x: 0, y: 0 }
    }
    set({
      tabs: [...tabs, tab],
      ...tabSnapshot(tab),
      activeTabId: tab.id
    })
    get().fitView()
  },

  loadDocumentTab: (input) => {
    const state = get()
    const current = captureTab(state)
    const tabs = state.tabs.map((tab) => (tab.id === current.id ? current : tab))
    const width = Math.max(1, Math.min(256, Math.round(input.width)))
    const height = Math.max(1, Math.min(256, Math.round(input.height)))
    const layers =
      input.layers && input.layers.length > 0
        ? input.layers.map((layer) => ({
            id: layer.id || makeId(),
            name: layer.name || 'Layer',
            visible: layer.visible !== false,
            opacity: Math.max(0, Math.min(1, layer.opacity)),
            pixels: clonePixels(layer.pixels)
          }))
        : [
            {
              id: makeId(),
              name: 'Layer 1',
              visible: true,
              opacity: 1,
              pixels: clonePixels(input.pixels)
            }
          ]
    const doc: DocumentState = {
      id: makeId(),
      width,
      height,
      name: input.name,
      kind: input.kind,
      sourcePath: input.sourcePath,
      projectPath: input.projectPath,
      layers,
      activeLayer: Math.max(
        0,
        Math.min(layers.length - 1, input.activeLayer ?? layers.length - 1)
      ),
      dirty: false
    }
    const tab: DocumentTab = {
      id: doc.id,
      doc,
      revision: 0,
      history: [],
      redoStack: [],
      selection: null,
      zoom: 16,
      pan: { x: 0, y: 0 }
    }
    set({ tabs: [...tabs, tab], ...tabSnapshot(tab) })
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

  switchTab: (id) => {
    const state = get()
    if (id === state.activeTabId) return
    const current = captureTab(state)
    const tabs = state.tabs.map((tab) => (tab.id === current.id ? current : tab))
    const target = tabs.find((tab) => tab.id === id)
    if (!target) return
    set({ tabs, ...tabSnapshot(target) })
  },

  closeTab: (id) => {
    const state = get()
    const current = captureTab(state)
    const savedTabs = state.tabs.map((tab) => (tab.id === current.id ? current : tab))
    const index = savedTabs.findIndex((tab) => tab.id === id)
    if (index < 0) return
    const remaining = savedTabs.filter((tab) => tab.id !== id)
    if (id !== state.activeTabId) {
      set({ tabs: remaining })
      return
    }
    if (remaining.length > 0) {
      const next = remaining[Math.min(index, remaining.length - 1)]
      set({ tabs: remaining, ...tabSnapshot(next) })
      return
    }
    const doc = blankDocument(32, 32)
    const tab: DocumentTab = {
      id: doc.id,
      doc,
      revision: 0,
      history: [],
      redoStack: [],
      selection: null,
      zoom: 16,
      pan: { x: 0, y: 0 }
    }
    set({ tabs: [tab], ...tabSnapshot(tab) })
    get().fitView()
  },

  closeActiveTab: () => {
    get().closeTab(get().activeTabId)
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

  resizeDocument: (width, height, anchor) => {
    const state = get()
    const nextWidth = Math.max(1, Math.min(256, Math.round(width)))
    const nextHeight = Math.max(1, Math.min(256, Math.round(height)))
    if (nextWidth === state.doc.width && nextHeight === state.doc.height) return
    const horizontal =
      anchor.includes('left') ? 0 : anchor.includes('right') ? nextWidth - state.doc.width : Math.round((nextWidth - state.doc.width) / 2)
    const vertical =
      anchor.startsWith('top') ? 0 : anchor.startsWith('bottom') ? nextHeight - state.doc.height : Math.round((nextHeight - state.doc.height) / 2)
    const layers = state.doc.layers.map((layer) => ({
      ...layer,
      pixels: resizeCanvasPixels(
        layer.pixels,
        state.doc.width,
        state.doc.height,
        nextWidth,
        nextHeight,
        horizontal,
        vertical
      )
    }))
    set({
      doc: {
        ...state.doc,
        width: nextWidth,
        height: nextHeight,
        layers,
        dirty: true
      },
      revision: state.revision + 1,
      selection: null,
      history: [],
      redoStack: [],
      transaction: null
    })
    get().fitView()
  },

  applyActiveLayerPixels: (label, pixels) => {
    const state = get()
    if (state.transaction) return
    const active = state.doc.layers[state.doc.activeLayer]
    if (!active) return
    state.beginTransaction(label)
    state.setDraftPixels(pixels)
    state.commitTransaction()
  },

  scaleTexture: (width, height) => {
    const state = get()
    const nextWidth = Math.max(1, Math.min(256, Math.round(width)))
    const nextHeight = Math.max(1, Math.min(256, Math.round(height)))
    if (nextWidth === state.doc.width && nextHeight === state.doc.height) return
    const layers = state.doc.layers.map((layer) => ({
      ...layer,
      pixels: resizeNearest(
        layer.pixels,
        state.doc.width,
        state.doc.height,
        nextWidth,
        nextHeight
      )
    }))
    set({
      doc: {
        ...state.doc,
        width: nextWidth,
        height: nextHeight,
        layers,
        dirty: true
      },
      revision: state.revision + 1,
      selection: null,
      history: [],
      redoStack: [],
      transaction: null
    })
    get().fitView()
  },
  addLayer: () => {
    const state = get()
    if (state.transaction || !state.beginTransaction('新建图层')) return
    const index = state.doc.activeLayer + 1
    const layers = [...state.doc.layers]
    layers.splice(index, 0, {
      id: makeId(),
      name: layerName(state.doc.layers),
      visible: true,
      opacity: 1,
      pixels: createPixels(state.doc.width, state.doc.height)
    })
    set({
      doc: { ...state.doc, layers, activeLayer: index },
      revision: state.revision + 1
    })
    get().commitTransaction()
  },

  duplicateLayer: (index) => {
    const state = get()
    if (state.transaction) return
    const sourceIndex = index ?? state.doc.activeLayer
    const source = state.doc.layers[sourceIndex]
    if (!source) return
    state.beginTransaction('复制图层')
    const layers = [...state.doc.layers]
    layers.splice(sourceIndex + 1, 0, {
      ...source,
      id: makeId(),
      name: `${source.name} copy`,
      pixels: clonePixels(source.pixels)
    })
    set({
      doc: { ...state.doc, layers, activeLayer: sourceIndex + 1 },
      revision: state.revision + 1
    })
    get().commitTransaction()
  },

  removeLayer: (index) => {
    const state = get()
    if (state.transaction || state.doc.layers.length <= 1) return false
    const target = index ?? state.doc.activeLayer
    if (target < 0 || target >= state.doc.layers.length) return false
    state.beginTransaction('删除图层')
    const layers = state.doc.layers.filter((_, layerIndex) => layerIndex !== target)
    const activeLayer =
      target < state.doc.activeLayer
        ? state.doc.activeLayer - 1
        : Math.min(target, layers.length - 1)
    set({
      doc: { ...state.doc, layers, activeLayer },
      revision: state.revision + 1
    })
    get().commitTransaction()
    return true
  },

  selectLayer: (index) => {
    const state = get()
    if (index < 0 || index >= state.doc.layers.length || index === state.doc.activeLayer) return
    set({
      doc: { ...state.doc, activeLayer: index },
      revision: state.revision + 1
    })
  },

  setLayerVisibility: (index, visible) => {
    const state = get()
    const layer = state.doc.layers[index]
    if (!layer || layer.visible === visible || state.transaction) return
    state.beginTransaction('切换图层可见性')
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((entry, layerIndex) =>
          layerIndex === index ? { ...entry, visible } : entry
        )
      },
      revision: state.revision + 1
    })
    get().commitTransaction()
  },

  setLayerOpacity: (index, opacity) => {
    const state = get()
    const next = Math.max(0, Math.min(1, opacity))
    if (state.transaction || state.doc.layers[index]?.opacity === next) return
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((entry, layerIndex) =>
          layerIndex === index ? { ...entry, opacity: next } : entry
        ),
        dirty: true
      },
      revision: state.revision + 1
    })
  },

  renameLayer: (index, name) => {
    const state = get()
    const layer = state.doc.layers[index]
    const trimmed = name.trim()
    if (!layer || !trimmed || layer.name === trimmed || state.transaction) return
    state.beginTransaction('重命名图层')
    set({
      doc: {
        ...state.doc,
        layers: state.doc.layers.map((entry, layerIndex) =>
          layerIndex === index ? { ...entry, name: trimmed } : entry
        )
      },
      revision: state.revision + 1
    })
    get().commitTransaction()
  },

  moveLayer: (index, direction) => {
    const state = get()
    const target = index + direction
    if (
      state.transaction ||
      index < 0 ||
      index >= state.doc.layers.length ||
      target < 0 ||
      target >= state.doc.layers.length
    ) {
      return
    }
    state.beginTransaction('调整图层顺序')
    const layers = [...state.doc.layers]
    const [moved] = layers.splice(index, 1)
    layers.splice(target, 0, moved)
    set({
      doc: { ...state.doc, layers, activeLayer: target },
      revision: state.revision + 1
    })
    get().commitTransaction()
  },

  mergeLayerDown: (index) => {
    const state = get()
    const sourceIndex = index ?? state.doc.activeLayer
    if (state.transaction || sourceIndex <= 0 || sourceIndex >= state.doc.layers.length) return false
    state.beginTransaction('向下合并图层')
    const layers = [...state.doc.layers]
    const below = layers[sourceIndex - 1]
    const above = layers[sourceIndex]
    const merged = flattenLayers([below, above], state.doc.width, state.doc.height)
    layers.splice(sourceIndex - 1, 2, {
      ...below,
      visible: true,
      opacity: 1,
      pixels: merged
    })
    set({
      doc: { ...state.doc, layers, activeLayer: sourceIndex - 1 },
      revision: state.revision + 1
    })
    get().commitTransaction()
    return true
  },


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
    const layers = withLayerPixels(state.doc.layers, state.doc.activeLayer, pixels).map(
      (layer, index) => (index === state.doc.activeLayer ? { ...layer, visible: true } : layer)
    )
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
