import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import type { RGBA } from '@shared/types'
import {
  bresenham,
  brushStampPoints,
  clearRegion,
  clonePixels,
  countOpaque,
  extractRegion,
  flattenLayers,
  floodFill,
  mirrorPoints,
  packColor,
  paintPoints,
  pixelPerfectPath,
  rectFromPoints,
  rectPoints,
  type Point
} from '../../core/pixels'
import { parseHex } from '../../core/color'
import {
  normalizeSelection,
  useWorkbench,
  ZOOM_LEVELS,
  type Selection
} from '../../store/workbench'
import { useUi } from '../../store/ui'
import { usePreferences } from '../../store/preferences'
import { useT } from '../../i18n'

interface GestureCommon {
  pointerId: number
  previousSelection: Selection | null
}

type PaintGesture = GestureCommon & {
  kind: 'paint'
  tool: 'pencil' | 'eraser'
  base: Uint32Array
  points: Point[]
  last: Point
  color: number
  brushSize: number
  pixelPerfect: boolean
  mirrorX: boolean
  mirrorY: boolean
}

type ShapeGesture = GestureCommon & {
  kind: 'shape'
  shape: 'line' | 'rectangle'
  base: Uint32Array
  start: Point
  end: Point
  color: number
  mirrorX: boolean
  mirrorY: boolean
}

type SelectCreateGesture = GestureCommon & {
  kind: 'select-create'
  start: Point
  moved: boolean
}

type SelectMoveGesture = GestureCommon & {
  kind: 'select-move'
  base: Uint32Array
  original: Selection
  start: Point
  floating: Uint32Array
  moved: boolean
}

type PanGesture = GestureCommon & {
  kind: 'pan'
  startScreen: Point
  startPan: Point
}

type SampleGesture = GestureCommon & {
  kind: 'sample'
  toBackground: boolean
}

type Gesture =
  | PaintGesture
  | ShapeGesture
  | SelectCreateGesture
  | SelectMoveGesture
  | PanGesture
  | SampleGesture

const CHECKER_SIZE = 8

function drawCheckerboard(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  zoom: number,
  colorA: string,
  colorB: string
): void {
  const block = Math.max(CHECKER_SIZE, Math.round(zoom * 4))
  context.fillStyle = colorA
  context.fillRect(left, top, width, height)
  context.fillStyle = colorB
  const columns = Math.ceil(width / block)
  const rows = Math.ceil(height / block)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if ((row + column) % 2 !== 0) continue
      const x = left + column * block
      const y = top + row * block
      context.fillRect(x, y, Math.min(block, left + width - x), Math.min(block, top + height - y))
    }
  }
}

function contains(selection: Selection | null, point: Point | null): boolean {
  if (!selection || !point) return false
  return (
    point.x >= selection.x &&
    point.y >= selection.y &&
    point.x < selection.x + selection.w &&
    point.y < selection.y + selection.h
  )
}

function constrainLine(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return end
  const angle = Math.atan2(dy, dx)
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
  const length = dx * Math.cos(snapped) + dy * Math.sin(snapped)
  return {
    x: start.x + Math.round(Math.cos(snapped) * Math.max(0, length)),
    y: start.y + Math.round(Math.sin(snapped) * Math.max(0, length))
  }
}

function constrainSquare(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const side = Math.max(Math.abs(dx), Math.abs(dy))
  const signX = dx < 0 ? -1 : 1
  const signY = dy < 0 ? -1 : 1
  return { x: start.x + signX * side, y: start.y + signY * side }
}

export function PixelCanvas() {
  const { doc, revision, tool, zoom, pan, showGrid, selection, symmetryX, symmetryY, cursor, brushSize } =
    useWorkbench(
      useShallow((state) => ({
        doc: state.doc,
        revision: state.revision,
        tool: state.tool,
        zoom: state.zoom,
        pan: state.pan,
        showGrid: state.showGrid,
        selection: state.selection,
        symmetryX: state.symmetryX,
        symmetryY: state.symmetryY,
        cursor: state.cursor,
        brushSize: state.brushSize
      }))
    )
  const canvasTheme = usePreferences((state) => state.theme)
  const canvasLight = usePreferences((state) => state.canvasLight)
  const t = useT()

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const spaceRef = useRef(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [dragOver, setDragOver] = useState(false)
  const sourceRef = useRef<HTMLCanvasElement | null>(null)
  const sourceKeyRef = useRef('')

  const pixelStatus = useMemo(() => {
    const composite = flattenLayers(doc.layers, doc.width, doc.height)
    return { opaque: countOpaque(composite) }
  }, [doc, revision])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const update = (): void => {
      const rect = element.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      setSize({ width, height })
      useWorkbench.getState().setViewport({ width, height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (size.width === 0 || size.height === 0) return
    useWorkbench.getState().setViewport(size)
  }, [size.width, size.height])

  const updateSource = useCallback((): HTMLCanvasElement | null => {
    const key = `${doc.id}:${revision}:${doc.width}:${doc.height}`
    if (sourceKeyRef.current === key && sourceRef.current) return sourceRef.current
    let source = sourceRef.current
    if (!source || source.width !== doc.width || source.height !== doc.height) {
      source = document.createElement('canvas')
      source.width = doc.width
      source.height = doc.height
      sourceRef.current = source
    }
    const context = source.getContext('2d')
    if (!context) return null
    const pixels = flattenLayers(doc.layers, doc.width, doc.height)
    const imageData = new ImageData(doc.width, doc.height)
    new Uint32Array(imageData.data.buffer).set(pixels)
    context.clearRect(0, 0, doc.width, doc.height)
    context.putImageData(imageData, 0, 0)
    sourceKeyRef.current = key
    return source
  }, [doc, revision])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0 || size.height === 0) return
    const source = updateSource()
    if (!source) return

    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.max(1, Math.round(size.width * dpr))
    const pixelHeight = Math.max(1, Math.round(size.height * dpr))
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size.width, size.height)
    context.imageSmoothingEnabled = false

    const left = Math.round(pan.x + size.width / 2 - (doc.width * zoom) / 2)
    const top = Math.round(pan.y + size.height / 2 - (doc.height * zoom) / 2)
    const width = doc.width * zoom
    const height = doc.height * zoom
    const devicePixel = 1 / dpr
    const computed = getComputedStyle(document.documentElement)
    const cssVar = (name: string, fallback: string): string =>
      computed.getPropertyValue(name).trim() || fallback
    const checkerA = cssVar('--canvas-checker-a', canvasLight ? '#f4f0e7' : '#242720')
    const checkerB = cssVar('--canvas-checker-b', canvasLight ? '#e2dccf' : '#1e211a')
    const canvasField = cssVar('--canvas-field', canvasLight ? '#e9e4d8' : '#191b16')
    const canvasEdge = cssVar('--canvas-edge', canvasLight ? 'rgba(42,46,34,.28)' : 'rgba(242,240,231,.16)')
    const canvasGrid = cssVar('--canvas-grid', canvasLight ? 'rgba(42,46,34,.13)' : 'rgba(245,243,232,.055)')
    const canvasInk = cssVar('--canvas-ink', canvasLight ? 'rgba(32,36,25,.62)' : 'rgba(252,250,240,.58)')
    const canvasEmpty = cssVar('--canvas-empty', canvasLight ? 'rgba(32,36,25,.055)' : 'rgba(252,250,240,.06)')

    context.save()
    context.shadowColor = canvasLight ? 'rgba(61, 54, 40, 0.28)' : 'rgba(0, 0, 0, 0.55)'
    context.shadowBlur = 30
    context.shadowOffsetY = 10
    context.fillStyle = canvasField
    context.beginPath()
    context.rect(left, top, width, height)
    context.fill()
    context.restore()

    context.save()
    context.beginPath()
    context.rect(left, top, width, height)
    context.clip()

    drawCheckerboard(context, left, top, width, height, zoom, checkerA, checkerB)

    context.imageSmoothingEnabled = false
    context.drawImage(source, 0, 0, doc.width, doc.height, left, top, width, height)
    context.restore()

    context.save()
    context.strokeStyle = canvasEdge
    context.lineWidth = devicePixel
    context.strokeRect(left - devicePixel / 2, top - devicePixel / 2, width + devicePixel, height + devicePixel)
    context.restore()

    if (showGrid && zoom >= 8) {
      context.save()
      context.beginPath()
      context.rect(left, top, width, height)
      context.clip()
      context.lineWidth = devicePixel
      context.strokeStyle = canvasGrid
      context.beginPath()
      for (let x = 1; x < doc.width; x += 1) {
        if (x % 8 === 0) continue
        const screenX = left + x * zoom
        if (screenX < 0 || screenX > size.width) continue
        const snapped = Math.round(screenX * dpr) / dpr + devicePixel / 2
        context.moveTo(snapped, top)
        context.lineTo(snapped, top + height)
      }
      for (let y = 1; y < doc.height; y += 1) {
        if (y % 8 === 0) continue
        const screenY = top + y * zoom
        if (screenY < 0 || screenY > size.height) continue
        const snapped = Math.round(screenY * dpr) / dpr + devicePixel / 2
        context.moveTo(left, snapped)
        context.lineTo(left + width, snapped)
      }
      context.stroke()
      context.strokeStyle = 'rgba(245, 243, 232, 0.1)'
      context.beginPath()
      for (let x = 8; x < doc.width; x += 8) {
        const screenX = left + x * zoom
        if (screenX < 0 || screenX > size.width) continue
        const snapped = Math.round(screenX * dpr) / dpr + devicePixel / 2
        context.moveTo(snapped, top)
        context.lineTo(snapped, top + height)
      }
      for (let y = 8; y < doc.height; y += 8) {
        const screenY = top + y * zoom
        if (screenY < 0 || screenY > size.height) continue
        const snapped = Math.round(screenY * dpr) / dpr + devicePixel / 2
        context.moveTo(left, snapped)
        context.lineTo(left + width, snapped)
      }
      context.stroke()
      context.restore()
    }

    if (symmetryX || symmetryY) {
      context.save()
      context.beginPath()
      context.rect(left, top, width, height)
      context.clip()
      context.strokeStyle = 'rgba(215, 243, 107, 0.42)'
      context.lineWidth = devicePixel
      context.setLineDash([4, 5])
      context.beginPath()
      if (symmetryX) {
        const screenX = left + width / 2
        context.moveTo(screenX, top)
        context.lineTo(screenX, top + height)
      }
      if (symmetryY) {
        const screenY = top + height / 2
        context.moveTo(left, screenY)
        context.lineTo(left + width, screenY)
      }
      context.stroke()
      context.restore()
    }

    if (selection && selection.w > 0 && selection.h > 0) {
      const sx = left + selection.x * zoom
      const sy = top + selection.y * zoom
      const sw = selection.w * zoom
      const sh = selection.h * zoom
      context.save()
      context.beginPath()
      context.rect(left, top, width, height)
      context.clip()
      context.fillStyle = 'rgba(215, 243, 107, 0.035)'
      context.fillRect(sx, sy, sw, sh)
      context.lineWidth = devicePixel
      context.setLineDash([4, 4])
      context.strokeStyle = 'rgba(0, 0, 0, 0.8)'
      context.strokeRect(sx + devicePixel / 2, sy + devicePixel / 2, sw, sh)
      context.lineDashOffset = 4
      context.strokeStyle = 'rgba(252, 250, 240, 0.96)'
      context.strokeRect(sx + devicePixel / 2, sy + devicePixel / 2, sw, sh)
      context.restore()
    }

    if (cursor && cursor.x >= 0 && cursor.y >= 0 && cursor.x < doc.width && cursor.y < doc.height) {
      const cellSize = zoom
      const footprint = brushStampPoints(
        [{ x: cursor.x, y: cursor.y }],
        tool === 'pencil' || tool === 'eraser' ? brushSize : 1
      )
      const preview = mirrorPoints(
        footprint,
        doc.width,
        doc.height,
        symmetryX,
        symmetryY
      )
      context.save()
      const seen = new Set<string>()
      for (const point of preview) {
        const key = `${point.x}:${point.y}`
        if (seen.has(key)) continue
        seen.add(key)
        const mx = left + point.x * zoom
        const my = top + point.y * zoom
        context.fillStyle = canvasEmpty
        context.fillRect(mx, my, cellSize, cellSize)
        context.lineWidth = devicePixel
        context.strokeStyle = canvasInk
        context.strokeRect(mx + devicePixel / 2, my + devicePixel / 2, cellSize - devicePixel, cellSize - devicePixel)
      }
      context.restore()
    }
  }, [brushSize, canvasLight, canvasTheme, cursor, doc, pan, revision, selection, showGrid, size, symmetryX, symmetryY, tool, updateSource, zoom])

  useEffect(() => {
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const element = rootRef.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const anchorX = event.clientX - rect.left
      const anchorY = event.clientY - rect.top
      const current = useWorkbench.getState().zoom
      const levels = [...ZOOM_LEVELS]
      const next =
        event.deltaY < 0
          ? levels.find((level) => level > current) ?? levels[levels.length - 1]
          : [...levels].reverse().find((level) => level < current) ?? levels[0]
      if (next !== current) useWorkbench.getState().setZoomAt(next, anchorX, anchorY)
    }
    const element = rootRef.current
    if (!element) return
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targetIsTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return !!target.closest('input, textarea, select, button, [contenteditable="true"]')
    }
    const down = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !targetIsTyping(event.target)) {
        if (!spaceRef.current) {
          spaceRef.current = true
          setSpacePressed(true)
        }
        event.preventDefault()
      }
      if (event.key === 'Escape' && gestureRef.current) {
        event.preventDefault()
        cancelGestureRef.current()
      }
    }
    const up = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        spaceRef.current = false
        setSpacePressed(false)
      }
    }
    const blur = (): void => {
      spaceRef.current = false
      setSpacePressed(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const getCellFromEvent = (event: { clientX: number; clientY: number }): Point => {
    const element = rootRef.current
    if (!element) return { x: -1, y: -1 }
    const rect = element.getBoundingClientRect()
    const state = useWorkbench.getState()
    const offsetX = state.pan.x + state.viewport.width / 2 - (state.doc.width * state.zoom) / 2
    const offsetY = state.pan.y + state.viewport.height / 2 - (state.doc.height * state.zoom) / 2
    const x = Math.floor((event.clientX - rect.left - offsetX) / state.zoom)
    const y = Math.floor((event.clientY - rect.top - offsetY) / state.zoom)
    return { x, y }
  }

  const getScreenPoint = (event: { clientX: number; clientY: number }): Point => {
    const element = rootRef.current
    if (!element) return { x: 0, y: 0 }
    const rect = element.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const insideCanvas = (point: Point): boolean => {
    const state = useWorkbench.getState()
    return point.x >= 0 && point.y >= 0 && point.x < state.doc.width && point.y < state.doc.height
  }

  const setCursorFromPoint = (position: Point | null): void => {
    const state = useWorkbench.getState()
    if (
      !position ||
      position.x < 0 ||
      position.y < 0 ||
      position.x >= state.doc.width ||
      position.y >= state.doc.height
    ) {
      if (state.cursor) state.setCursor(null)
      return
    }
    if (state.cursor?.x !== position.x || state.cursor?.y !== position.y) {
      state.setCursor(position)
    }
  }

  const sampleAt = (point: Point, toBackground: boolean): void => {
    const state = useWorkbench.getState()
    if (!insideCanvas(point)) return
    const layer = state.doc.layers[state.doc.activeLayer]
    if (!layer) return
    const composite = flattenLayers(state.doc.layers, state.doc.width, state.doc.height)
    const value = composite[point.y * state.doc.width + point.x] ?? 0
    const color: RGBA = {
      r: value & 0xff,
      g: (value >>> 8) & 0xff,
      b: (value >>> 16) & 0xff,
      a: (value >>> 24) & 0xff
    }
    if (toBackground) state.setBackground(color)
    else state.setForeground(color)
  }

  const paintGesture = (gesture: PaintGesture): void => {
    const state = useWorkbench.getState()
    const next = clonePixels(gesture.base)
    const points =
      gesture.pixelPerfect && gesture.brushSize === 1
        ? pixelPerfectPath(gesture.points)
        : gesture.points
    const stamped = brushStampPoints(points, gesture.brushSize)
    const mirrored = mirrorPoints(
      stamped,
      state.doc.width,
      state.doc.height,
      gesture.mirrorX,
      gesture.mirrorY
    )
    paintPoints(next, state.doc.width, state.doc.height, mirrored, gesture.color)
    state.setDraftPixels(next)
  }

  const shapeGesture = (gesture: ShapeGesture, shiftKey: boolean): void => {
    const state = useWorkbench.getState()
    const next = clonePixels(gesture.base)
    let end = gesture.end
    if (shiftKey) {
      end = gesture.shape === 'line' ? constrainLine(gesture.start, end) : constrainSquare(gesture.start, end)
    }
    end = {
      x: Math.max(0, Math.min(state.doc.width - 1, end.x)),
      y: Math.max(0, Math.min(state.doc.height - 1, end.y))
    }
    gesture.end = end
    const points =
      gesture.shape === 'line'
        ? bresenham(gesture.start.x, gesture.start.y, end.x, end.y)
        : rectPoints(gesture.start.x, gesture.start.y, end.x, end.y, false)
    const mirrored = mirrorPoints(
      points,
      state.doc.width,
      state.doc.height,
      gesture.mirrorX,
      gesture.mirrorY
    )
    paintPoints(next, state.doc.width, state.doc.height, mirrored, gesture.color)
    state.setDraftPixels(next)
  }

  const selectionMoveGesture = (gesture: SelectMoveGesture, target: Point): void => {
    const state = useWorkbench.getState()
    const dx = target.x - gesture.start.x
    const dy = target.y - gesture.start.y
    const x = Math.max(0, Math.min(state.doc.width - gesture.original.w, gesture.original.x + dx))
    const y = Math.max(0, Math.min(state.doc.height - gesture.original.h, gesture.original.y + dy))
    if (x === gesture.original.x && y === gesture.original.y && !gesture.moved) return
    gesture.moved = true
    const next = clonePixels(gesture.base)
    clearRegion(next, state.doc.width, state.doc.height, gesture.original)
    for (let fy = 0; fy < gesture.original.h; fy += 1) {
      for (let fx = 0; fx < gesture.original.w; fx += 1) {
        const value = gesture.floating[fy * gesture.original.w + fx]
        if ((value >>> 24) === 0) continue
        const tx = x + fx
        const ty = y + fy
        if (tx < 0 || ty < 0 || tx >= state.doc.width || ty >= state.doc.height) continue
        next[ty * state.doc.width + tx] = value
      }
    }
    const nextSelection = { x, y, w: gesture.original.w, h: gesture.original.h }
    state.setDraftPixels(next, nextSelection)
  }

  const cancelGesture = (): void => {
    const gesture = gestureRef.current
    if (!gesture) return
    const state = useWorkbench.getState()
    if (gesture.kind === 'paint' || gesture.kind === 'shape' || gesture.kind === 'select-move') {
      if (state.transaction) state.cancelTransaction()
    } else if (gesture.kind === 'select-create') {
      state.setSelection(gesture.previousSelection)
    }
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(gesture.pointerId)) {
      try {
        canvas.releasePointerCapture(gesture.pointerId)
      } catch {
        // Pointer capture can already be gone.
      }
    }
    gestureRef.current = null
    setIsPanning(false)
  }
  const cancelGestureRef = useRef(cancelGesture)
  cancelGestureRef.current = cancelGesture

  useEffect(() => {
    const onRightButton = (event: MouseEvent): void => {
      const gesture = gestureRef.current
      if (event.button !== 2 || !gesture || gesture.kind === 'pan') return
      event.preventDefault()
      event.stopPropagation()
      cancelGestureRef.current()
    }
    window.addEventListener('mousedown', onRightButton, true)
    return () => window.removeEventListener('mousedown', onRightButton, true)
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return
    if (event.button === 2 && gestureRef.current && gestureRef.current.kind !== 'pan') {
      event.preventDefault()
      cancelGesture()
      return
    }
    if (gestureRef.current) return
    const state = useWorkbench.getState()
    if (useUi.getState().busy) return
    rootRef.current?.focus({ preventScroll: true })
    const point = getCellFromEvent(event)
    const screen = getScreenPoint(event)

    if (event.button === 2 || event.button === 1 || spaceRef.current) {
      event.preventDefault()
      gestureRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        previousSelection: state.selection,
        startScreen: screen,
        startPan: { ...state.pan }
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      setIsPanning(true)
      return
    }

    if (event.altKey) {
      if (insideCanvas(point)) {
        sampleAt(point, event.shiftKey)
        setCursorFromPoint(point)
      }
      return
    }

    if (!insideCanvas(point) && tool !== 'select') return
    const layer = state.doc.layers[state.doc.activeLayer]
    if (!layer) return

    const pointerSelection = state.selection
    const common: GestureCommon = {
      pointerId: event.pointerId,
      previousSelection: pointerSelection ? { ...pointerSelection } : null
    }

    if (tool === 'eyedropper') {
      sampleAt(point, event.shiftKey)
      gestureRef.current = { ...common, kind: 'sample', toBackground: event.shiftKey }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'bucket' && insideCanvas(point)) {
      const pixels = clonePixels(layer.pixels)
      const changed = floodFill(
        pixels,
        state.doc.width,
        state.doc.height,
        point.x,
        point.y,
        packColor(state.foreground),
        state.contiguous
      )
      if (changed > 0) {
        state.beginTransaction('油漆桶')
        state.setDraftPixels(pixels)
        state.commitTransaction()
      }
      return
    }

    if (tool === 'select') {
      if (pointerSelection && contains(pointerSelection, point)) {
        if (!state.beginTransaction('移动选区')) return
        const floating = extractRegion(
          layer.pixels,
          state.doc.width,
          state.doc.height,
          pointerSelection
        )
        gestureRef.current = {
          ...common,
          kind: 'select-move',
          base: clonePixels(layer.pixels),
          original: { ...pointerSelection },
          start: point,
          floating,
          moved: false
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      } else {
        state.setSelection(null)
        gestureRef.current = {
          ...common,
          kind: 'select-create',
          start: { x: Math.max(0, Math.min(state.doc.width - 1, point.x)), y: Math.max(0, Math.min(state.doc.height - 1, point.y)) },
          moved: false
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      return
    }

    if (tool === 'pencil' || tool === 'eraser') {
      if (!state.beginTransaction(tool === 'eraser' ? '橡皮' : '铅笔')) return
      const gesture: PaintGesture = {
        ...common,
        kind: 'paint',
        tool,
        base: clonePixels(layer.pixels),
        points: [{ ...point }],
        last: { ...point },
        color: tool === 'eraser' ? 0 : packColor(state.foreground),
        brushSize: state.brushSize,
        pixelPerfect: state.pixelPerfect,
        mirrorX: state.symmetryX,
        mirrorY: state.symmetryY
      }
      gestureRef.current = gesture
      paintGesture(gesture)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'line' || tool === 'rectangle') {
      if (!state.beginTransaction(tool === 'line' ? '直线' : '矩形')) return
      const gesture: ShapeGesture = {
        ...common,
        kind: 'shape',
        shape: tool,
        base: clonePixels(layer.pixels),
        start: { x: Math.max(0, Math.min(state.doc.width - 1, point.x)), y: Math.max(0, Math.min(state.doc.height - 1, point.y)) },
        end: { x: Math.max(0, Math.min(state.doc.width - 1, point.x)), y: Math.max(0, Math.min(state.doc.height - 1, point.y)) },
        color: packColor(state.foreground),
        mirrorX: state.symmetryX,
        mirrorY: state.symmetryY
      }
      gestureRef.current = gesture
      shapeGesture(gesture, event.shiftKey)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (
      gestureRef.current &&
      gestureRef.current.kind !== 'pan' &&
      (event.buttons & 2) !== 0
    ) {
      cancelGesture()
      return
    }
    const cell = getCellFromEvent(event)
    const gesture = gestureRef.current
    if (!gesture) {
      setCursorFromPoint(insideCanvas(cell) ? cell : null)
      return
    }

    if (gesture.kind === 'pan') {
      const screen = getScreenPoint(event)
      useWorkbench.getState().setPan({
        x: gesture.startPan.x + (screen.x - gesture.startScreen.x),
        y: gesture.startPan.y + (screen.y - gesture.startScreen.y)
      })
      setCursorFromPoint(null)
      return
    }

    if (gesture.kind === 'sample') {
      const state = useWorkbench.getState()
      if (insideCanvas(cell)) {
        sampleAt(cell, gesture.toBackground)
        setCursorFromPoint(cell)
      }
      return
    }

    if (gesture.kind === 'paint') {
      setCursorFromPoint(insideCanvas(cell) ? cell : null)
      if (cell.x === gesture.last.x && cell.y === gesture.last.y) return
      const segment = bresenham(gesture.last.x, gesture.last.y, cell.x, cell.y)
      for (let index = 1; index < segment.length; index += 1) gesture.points.push(segment[index])
      gesture.last = { ...cell }
      paintGesture(gesture)
      return
    }

    if (gesture.kind === 'shape') {
      setCursorFromPoint(insideCanvas(cell) ? cell : null)
      gesture.end = { ...cell }
      shapeGesture(gesture, event.shiftKey)
      return
    }

    if (gesture.kind === 'select-create') {
      setCursorFromPoint(insideCanvas(cell) ? cell : null)
      if (cell.x === gesture.start.x && cell.y === gesture.start.y) {
        useWorkbench.getState().setSelection(null)
        return
      }
      gesture.moved = true
      const rect = rectFromPoints(gesture.start, cell)
      const selection = normalizeSelection(rect, useWorkbench.getState().doc.width, useWorkbench.getState().doc.height)
      useWorkbench.getState().setSelection(selection)
      return
    }

    if (gesture.kind === 'select-move') {
      setCursorFromPoint(insideCanvas(cell) ? cell : null)
      const state = useWorkbench.getState()
      selectionMoveGesture(gesture, {
        x: Math.max(0, Math.min(state.doc.width - 1, cell.x)),
        y: Math.max(0, Math.min(state.doc.height - 1, cell.y))
      })
    }
  }

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current
    if (!gesture) return
    const state = useWorkbench.getState()
    if (gesture.kind === 'select-create' && !gesture.moved) {
      state.setSelection(null)
    }
    if (gesture.kind === 'paint' || gesture.kind === 'shape' || gesture.kind === 'select-move') {
      state.commitTransaction()
    }
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) {
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore.
      }
    }
    gestureRef.current = null
    setIsPanning(false)
    const cell = getCellFromEvent(event)
    setCursorFromPoint(insideCanvas(cell) ? cell : null)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    finishGesture(event)
  }

  const handlePointerCancel = (): void => {
    cancelGesture()
  }

  const handlePointerLeave = (): void => {
    if (!gestureRef.current) useWorkbench.getState().setCursor(null)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragOver(false)
    const raw = event.dataTransfer.getData('text/plain')
    const color = parseHex(raw)
    if (!color) return
    const point = getCellFromEvent(event)
    const state = useWorkbench.getState()
    if (!insideCanvas(point)) return
    const layer = state.doc.layers[state.doc.activeLayer]
    if (!layer) return
    const pixels = clonePixels(layer.pixels)
    paintPoints(pixels, state.doc.width, state.doc.height, [point], packColor(color))
    state.beginTransaction('放置调色卡颜色')
    state.setDraftPixels(pixels)
    state.commitTransaction()
    state.setForeground(color)
    state.setCursor(point)
  }

  const overSelection = contains(selection, cursor)
  const cursorStyle: CSSProperties['cursor'] =
    spacePressed || isPanning
      ? isPanning
        ? 'grabbing'
        : 'grab'
      : tool === 'select'
        ? overSelection
          ? 'move'
          : 'crosshair'
        : tool === 'eyedropper'
          ? 'crosshair'
          : tool === 'bucket'
            ? 'crosshair'
            : 'crosshair'

  const selectionLabel = selection
    ? `${selection.w}×${selection.h}`
    : pixelStatus.opaque === 0
      ? t('空白画布')
      : `${doc.width} × ${doc.height}`

  return (
    <div
      ref={rootRef}
      className={clsx('canvas-stage', dragOver && 'is-color-drop', isPanning && 'is-panning')}
      tabIndex={0}
      role="application"
      aria-label={t('像素画布')}
      style={{ cursor: cursorStyle }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('text/plain')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={canvasRef} className="pixel-canvas" />
      <div className="canvas-stage__grain" aria-hidden />
      <div className="canvas-hints">
        <span className="canvas-hint">
          <span className="canvas-hint__key mono">{t('滚轮')}</span> {t('缩放')}
        </span>
        <span className="canvas-hint">
          <span className="canvas-hint__key mono">{t('空格')}</span> {t('平移')}
        </span>
        <span className="canvas-hint canvas-hint--accent">
          <span className="canvas-hint__dot" />
          {selectionLabel}
        </span>
      </div>
      {dragOver ? (
        <div className="canvas-drop-label">
          <span>{t('拖放调色卡颜色')}</span>
          <span className="mono">{t('绘制像素')}</span>
        </div>
      ) : null}
    </div>
  )
}
