import type { ExtractOptions, RGBA } from '@shared/types'
import { clamp, oklabDistance, oklabToSrgb, rgbaToOklab, rgbaToOklch, type OKLab } from './color'

export interface ExtractedColor {
  rgba: RGBA
  count: number
}

export interface ExtractResult {
  colors: ExtractedColor[]
  totalPixels: number
  uniqueCount: number
  mergedCount: number
  ignoredTransparent: number
  ignoredSemiTransparent: number
  mergeApplied: boolean
}

interface Cluster {
  lab: OKLab
  count: number
  alphaSum: number
}

const cellKey = (x: number, y: number, z: number): string => `${x},${y},${z}`

function clusterCell(lab: OKLab, size: number): [number, number, number] {
  return [
    Math.floor(lab.L / size),
    Math.floor((lab.a + 0.5) / size),
    Math.floor((lab.b + 0.5) / size)
  ]
}

/**
 * Exact unique-color extraction with optional OKLab perceptual merging.
 * Pixel frequencies are preserved exactly when merging is disabled.
 */
export function extractColors(bytes: Uint8Array, options: ExtractOptions): ExtractResult {
  const counts = new Map<number, number>()
  let totalPixels = 0
  let ignoredTransparent = 0
  let ignoredSemiTransparent = 0

  for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
    const r = bytes[offset]
    const g = bytes[offset + 1]
    const b = bytes[offset + 2]
    const a = bytes[offset + 3]
    totalPixels += 1
    if (a === 0) {
      ignoredTransparent += 1
      continue
    }
    if (!options.includeSemiTransparent && a < 255) {
      ignoredSemiTransparent += 1
      continue
    }
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const uniqueCount = counts.size
  const direct: ExtractedColor[] = []
  for (const [key, count] of counts) {
    const rgba: RGBA = {
      r: (key >>> 24) & 0xff,
      g: (key >>> 16) & 0xff,
      b: (key >>> 8) & 0xff,
      a: key & 0xff
    }
    direct.push({ rgba, count })
  }

  const mergeThreshold = Math.max(0, options.mergeThreshold)
  let colors = direct
  if (mergeThreshold > 0 && direct.length > 1) {
    colors = mergeSnowball(direct, mergeThreshold)
  }

  colors.sort((a, b) => {
    const lA = rgbaToOklch(a.rgba).L
    const lB = rgbaToOklch(b.rgba).L
    if (lA !== lB) return lA - lB
    if (b.count !== a.count) return b.count - a.count
    return a.rgba.r - b.rgba.r || a.rgba.g - b.rgba.g || a.rgba.b - b.rgba.b
  })

  return {
    colors,
    totalPixels,
    uniqueCount,
    mergedCount: colors.length,
    ignoredTransparent,
    ignoredSemiTransparent,
    mergeApplied: mergeThreshold > 0 && direct.length > 1
  }
}

/**
 * A weighted, greedy perceptual merge. Colors are processed by frequency so
 * dominant texture colors act as anchors. A spatial hash keyed by the merge
 * threshold keeps the search near-linear on large images.
 */
function mergeSnowball(direct: ExtractedColor[], threshold: number): ExtractedColor[] {
  const size = Math.max(0.002, threshold)
  const sorted = [...direct].sort((a, b) => b.count - a.count)
  const clusters: Cluster[] = []
  const buckets = new Map<string, Set<number>>()
  const thresholdSq = threshold * threshold

  const addToBucket = (index: number, lab: OKLab): void => {
    const [x, y, z] = clusterCell(lab, size)
    const key = cellKey(x, y, z)
    const bucket = buckets.get(key)
    if (bucket) bucket.add(index)
    else buckets.set(key, new Set([index]))
  }

  const removeFromBucket = (index: number, lab: OKLab): void => {
    const [x, y, z] = clusterCell(lab, size)
    const key = cellKey(x, y, z)
    const bucket = buckets.get(key)
    if (!bucket) return
    bucket.delete(index)
    if (bucket.size === 0) buckets.delete(key)
  }

  for (const color of sorted) {
    const lab = rgbaToOklab(color.rgba)
    const [x, y, z] = clusterCell(lab, size)
    let nearest = -1
    let nearestDistance = thresholdSq
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const bucket = buckets.get(cellKey(x + dx, y + dy, z + dz))
          if (!bucket) continue
          for (const index of bucket) {
            const cluster = clusters[index]
            const dL = cluster.lab.L - lab.L
            const da = cluster.lab.a - lab.a
            const db = cluster.lab.b - lab.b
            const distance = dL * dL + da * da + db * db
            if (distance <= nearestDistance) {
              nearestDistance = distance
              nearest = index
            }
          }
        }
      }
    }

    if (nearest >= 0) {
      const cluster = clusters[nearest]
      const oldLab = cluster.lab
      const total = cluster.count + color.count
      const newLab: OKLab = {
        L: (oldLab.L * cluster.count + lab.L * color.count) / total,
        a: (oldLab.a * cluster.count + lab.a * color.count) / total,
        b: (oldLab.b * cluster.count + lab.b * color.count) / total
      }
      cluster.lab = newLab
      cluster.count = total
      cluster.alphaSum += color.rgba.a * color.count
      const oldCell = clusterCell(oldLab, size)
      const newCell = clusterCell(newLab, size)
      if (oldCell[0] !== newCell[0] || oldCell[1] !== newCell[1] || oldCell[2] !== newCell[2]) {
        removeFromBucket(nearest, oldLab)
        addToBucket(nearest, newLab)
      }
    } else {
      const index = clusters.length
      clusters.push({ lab, count: color.count, alphaSum: color.rgba.a * color.count })
      addToBucket(index, lab)
    }
  }

  return clusters.map((cluster) => {
    const rgb = oklabToSrgb(cluster.lab, Math.round(clamp(cluster.alphaSum / cluster.count, 0, 255)))
    return {
      rgba: rgb.rgba,
      count: cluster.count
    }
  })
}

/** Extract from a packed ABGR buffer (the editor's native layer format). */
export function extractFromPacked(pixels: Uint32Array, options: ExtractOptions): ExtractResult {
  const bytes = new Uint8Array(pixels.length * 4)
  bytes.set(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength))
  return extractColors(bytes, options)
}

export function estimatedMergeCount(unique: number, threshold: number): number {
  if (threshold <= 0) return unique
  const cell = Math.max(0.002, threshold)
  return Math.max(1, Math.ceil(unique / Math.max(1, Math.round(1 / (cell * 60)))))
}

export function colorKey(rgba: RGBA): number {
  return ((rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | rgba.a) >>> 0
}

export function countMapFromResult(result: ExtractResult): Map<number, number> {
  const map = new Map<number, number>()
  for (const color of result.colors) {
    map.set(colorKey(color.rgba), color.count)
  }
  return map
}

export function distanceIsNear(a: RGBA, b: RGBA, threshold: number): boolean {
  return oklabDistance(rgbaToOklab(a), rgbaToOklab(b)) <= threshold
}
