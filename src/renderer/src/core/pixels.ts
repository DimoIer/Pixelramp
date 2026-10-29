import type { RGBA } from '@shared/types'
import { clamp, rgba } from './color'

/** Packed pixel layout is 0xAABBGGRR (the natural little-endian ImageData layout). */
export const TRANSPARENT = 0

export function packColor(color: RGBA): number {
  return (
    (((color.a & 0xff) << 24) | ((color.b & 0xff) << 16) | ((color.g & 0xff) << 8) | (color.r & 0xff)) >>>
    0
  )
}

export function unpackColor(value: number): RGBA {
  return {
    r: value & 0xff,
    g: (value >>> 8) & 0xff,
    b: (value >>> 16) & 0xff,
    a: (value >>> 24) & 0xff
  }
}

export function withAlpha(color: RGBA, alpha: number): RGBA {
  return { ...color, a: Math.round(clamp(alpha, 0, 255)) }
}

export function createPixels(width: number, height: number): Uint32Array {
  return new Uint32Array(Math.max(0, width * height))
}

export function clonePixels(pixels: Uint32Array): Uint32Array {
  return new Uint32Array(pixels)
}

export function pixelIndex(x: number, y: number, width: number): number {
  return y * width + x
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height
}

export function getPixel(
  pixels: Uint32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (!inBounds(x, y, width, height)) return TRANSPARENT
  return pixels[y * width + x] >>> 0
}

export function toRgbaBytes(pixels: Uint32Array): Uint8Array {
  const bytes = new Uint8Array(pixels.length * 4)
  bytes.set(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength))
  return bytes
}

export function imageDataToPacked(image: ImageData): Uint32Array {
  const source = new Uint32Array(image.data.buffer, image.data.byteOffset, image.width * image.height)
  return new Uint32Array(source)
}

export function packedToImageData(pixels: Uint32Array, width: number, height: number): ImageData {
  const data = new ImageData(width, height)
  const target = new Uint32Array(data.data.buffer)
  target.set(pixels.subarray(0, width * height))
  return data
}

export interface Point {
  x: number
  y: number
}

export function bresenham(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = []
  let x = Math.round(x0)
  let y = Math.round(y0)
  const endX = Math.round(x1)
  const endY = Math.round(y1)
  const dx = Math.abs(endX - x)
  const dy = -Math.abs(endY - y)
  const sx = x < endX ? 1 : -1
  const sy = y < endY ? 1 : -1
  let error = dx + dy

  while (true) {
    points.push({ x, y })
    if (x === endX && y === endY) break
    const e2 = 2 * error
    if (e2 >= dy) {
      error += dy
      x += sx
    }
    if (e2 <= dx) {
      error += dx
      y += sy
    }
  }
  return points
}

/** Remove redundant L-corners from a freehand path for crisp 1px diagonals. */
export function pixelPerfectPath(points: Point[]): Point[] {
  const clean: Point[] = []
  for (const point of points) {
    const last = clean[clean.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    clean.push(point)
    let changed = true
    while (changed && clean.length >= 3) {
      changed = false
      const a = clean[clean.length - 3]
      const b = clean[clean.length - 2]
      const c = clean[clean.length - 1]
      const diagonal = Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1
      const orthA = (a.x === b.x || a.y === b.y) && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
      const orthC = (c.x === b.x || c.y === b.y) && Math.abs(c.x - b.x) + Math.abs(c.y - b.y) === 1
      if (diagonal && orthA && orthC) {
        clean.splice(clean.length - 2, 1)
        changed = true
      }
    }
  }
  return clean
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  return bresenham(x0, y0, x1, y1)
}

export function rectPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean
): Point[] {
  const left = Math.min(x0, x1)
  const right = Math.max(x0, x1)
  const top = Math.min(y0, y1)
  const bottom = Math.max(y0, y1)
  const points: Point[] = []
  if (filled) {
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) points.push({ x, y })
    }
    return points
  }
  for (let x = left; x <= right; x += 1) {
    points.push({ x, y: top })
    if (bottom !== top) points.push({ x, y: bottom })
  }
  for (let y = top + 1; y < bottom; y += 1) {
    points.push({ x: left, y })
    if (right !== left) points.push({ x: right, y })
  }
  return points
}

export function mirrorPoints(
  points: Point[],
  width: number,
  height: number,
  mirrorX: boolean,
  mirrorY: boolean
): Point[] {
  if (!mirrorX && !mirrorY) return points
  const seen = new Set<string>()
  const output: Point[] = []
  const push = (x: number, y: number): void => {
    if (!inBounds(x, y, width, height)) return
    const key = `${x}:${y}`
    if (seen.has(key)) return
    seen.add(key)
    output.push({ x, y })
  }
  for (const point of points) {
    push(point.x, point.y)
    if (mirrorX) push(width - 1 - point.x, point.y)
    if (mirrorY) push(point.x, height - 1 - point.y)
    if (mirrorX && mirrorY) push(width - 1 - point.x, height - 1 - point.y)
  }
  return output
}

export function paintPoints(
  target: Uint32Array,
  width: number,
  height: number,
  points: Point[],
  color: number
): void {
  for (const point of points) {
    if (!inBounds(point.x, point.y, width, height)) continue
    target[point.y * width + point.x] = color >>> 0
  }
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function normalizeRect(rect: Rect): Rect {
  const x = Math.min(rect.x, rect.x + rect.w)
  const y = Math.min(rect.y, rect.y + rect.h)
  return { x, y, w: Math.abs(rect.w), h: Math.abs(rect.h) }
}

export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 }
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = clamp(Math.round(rect.x), 0, Math.max(0, width))
  const y = clamp(Math.round(rect.y), 0, Math.max(0, height))
  const right = clamp(Math.round(rect.x + rect.w), 0, width)
  const bottom = clamp(Math.round(rect.y + rect.h), 0, height)
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) }
}

export function extractRegion(
  pixels: Uint32Array,
  width: number,
  height: number,
  rect: Rect
): Uint32Array {
  const clipped = clampRect(rect, width, height)
  const result = new Uint32Array(clipped.w * clipped.h)
  for (let y = 0; y < clipped.h; y += 1) {
    for (let x = 0; x < clipped.w; x += 1) {
      result[y * clipped.w + x] = pixels[(clipped.y + y) * width + (clipped.x + x)]
    }
  }
  return result
}

export function clearRegion(target: Uint32Array, width: number, height: number, rect: Rect): void {
  const clipped = clampRect(rect, width, height)
  for (let y = 0; y < clipped.h; y += 1) {
    for (let x = 0; x < clipped.w; x += 1) {
      target[(clipped.y + y) * width + (clipped.x + x)] = TRANSPARENT
    }
  }
}

export function pasteRegion(
  target: Uint32Array,
  targetWidth: number,
  targetHeight: number,
  source: Uint32Array,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number
): void {
  for (let sy = 0; sy < sourceHeight; sy += 1) {
    const ty = y + sy
    if (ty < 0 || ty >= targetHeight) continue
    for (let sx = 0; sx < sourceWidth; sx += 1) {
      const tx = x + sx
      if (tx < 0 || tx >= targetWidth) continue
      target[ty * targetWidth + tx] = source[sy * sourceWidth + sx]
    }
  }
}

/** Fill the active layer with the exact target color. tolerance is intentionally 0. */
export function floodFill(
  target: Uint32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  color: number,
  contiguous: boolean
): number {
  if (!inBounds(x, y, width, height)) return 0
  const start = y * width + x
  const replaced = target[start] >>> 0
  const fill = color >>> 0
  if (replaced === fill) return 0

  let changed = 0
  if (!contiguous) {
    for (let index = 0; index < target.length; index += 1) {
      if ((target[index] >>> 0) === replaced) {
        target[index] = fill
        changed += 1
      }
    }
    return changed
  }

  const stack: number[] = [start]
  target[start] = fill
  changed = 1
  while (stack.length > 0) {
    const index = stack.pop() as number
    const px = index % width
    const py = (index / width) | 0
    if (px > 0) {
      const next = index - 1
      if ((target[next] >>> 0) === replaced) {
        target[next] = fill
        changed += 1
        stack.push(next)
      }
    }
    if (px < width - 1) {
      const next = index + 1
      if ((target[next] >>> 0) === replaced) {
        target[next] = fill
        changed += 1
        stack.push(next)
      }
    }
    if (py > 0) {
      const next = index - width
      if ((target[next] >>> 0) === replaced) {
        target[next] = fill
        changed += 1
        stack.push(next)
      }
    }
    if (py < height - 1) {
      const next = index + width
      if ((target[next] >>> 0) === replaced) {
        target[next] = fill
        changed += 1
        stack.push(next)
      }
    }
  }
  return changed
}

export function resizeNearest(
  source: Uint32Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): Uint32Array {
  const result = new Uint32Array(targetWidth * targetHeight)
  for (let y = 0; y < targetHeight; y += 1) {
    const sy = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight))
    for (let x = 0; x < targetWidth; x += 1) {
      const sx = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth))
      result[y * targetWidth + x] = source[sy * sourceWidth + sx]
    }
  }
  return result
}

/** Crop and resample an imported image into a square editor layer. */
export function prepareImportedPixels(
  source: Uint32Array,
  sourceWidth: number,
  sourceHeight: number,
  targetSize: number,
  mode: 'crop' | 'scale'
): Uint32Array {
  const size = Math.max(1, Math.min(256, Math.round(targetSize)))
  if (mode === 'scale') {
    return resizeNearest(source, sourceWidth, sourceHeight, size, size)
  }
  const side = Math.min(sourceWidth, sourceHeight)
  const sx = Math.floor((sourceWidth - side) / 2)
  const sy = Math.floor((sourceHeight - side) / 2)
  const cropped = new Uint32Array(side * side)
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      cropped[y * side + x] = source[(sy + y) * sourceWidth + (sx + x)]
    }
  }
  return resizeNearest(cropped, side, side, size, size)
}

export interface LayerLike {
  pixels: Uint32Array
  visible: boolean
  opacity: number
}

/** Flatten visible layers to packed pixels. */
export function flattenLayers(layers: LayerLike[], width: number, height: number): Uint32Array {
  if (layers.length === 0) return new Uint32Array(width * height)
  if (layers.length === 1 && layers[0].visible && layers[0].opacity >= 1) {
    return new Uint32Array(layers[0].pixels)
  }
  const result = new Uint32Array(width * height)
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    for (let index = 0; index < result.length; index += 1) {
      const src = layer.pixels[index] >>> 0
      const srcA = ((src >>> 24) & 0xff) * clamp(layer.opacity, 0, 1)
      if (srcA <= 0) continue
      const dst = result[index] >>> 0
      const dstA = dst >>> 24
      const outA = srcA + (dstA * (255 - srcA)) / 255
      if (outA <= 0) {
        result[index] = 0
        continue
      }
      const srcR = src & 0xff
      const srcG = (src >>> 8) & 0xff
      const srcB = (src >>> 16) & 0xff
      const dstR = dst & 0xff
      const dstG = (dst >>> 8) & 0xff
      const dstB = (dst >>> 16) & 0xff
      const r = (srcR * srcA + dstR * dstA * (1 - srcA / 255)) / outA
      const g = (srcG * srcA + dstG * dstA * (1 - srcA / 255)) / outA
      const b = (srcB * srcA + dstB * dstA * (1 - srcA / 255)) / outA
      result[index] = packColor(rgba(r, g, b, outA))
    }
  }
  return result
}

export function packedToRgba(pixels: Uint32Array, index: number): RGBA {
  return unpackColor(pixels[index] ?? 0)
}

export function countOpaque(pixels: Uint32Array): number {
  let count = 0
  for (let index = 0; index < pixels.length; index += 1) {
    if ((pixels[index] >>> 24) > 0) count += 1
  }
  return count
}
