import { describe, expect, it } from 'vitest'
import type { PaletteColor } from '@shared/types'
import { extractColors } from './extract'
import { DEFAULT_EXTRACT_OPTIONS } from './palette'
import { sortPaletteColors } from './sort'

function bytes(colors: Array<[number, number, number, number]>): Uint8Array {
  const result = new Uint8Array(colors.length * 4)
  colors.forEach(([r, g, b, a], index) => {
    result[index * 4] = r
    result[index * 4 + 1] = g
    result[index * 4 + 2] = b
    result[index * 4 + 3] = a
  })
  return result
}

describe('palette extraction', () => {
  it('keeps exact unique colors and frequencies', () => {
    const data = bytes([
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 128],
      [10, 10, 10, 0]
    ])
    const result = extractColors(data, DEFAULT_EXTRACT_OPTIONS)
    expect(result.uniqueCount).toBe(3)
    expect(result.ignoredTransparent).toBe(1)
    const red = result.colors.find((color) => color.rgba.r === 255 && color.rgba.g === 0)
    expect(red?.count).toBe(2)
    expect(result.colors.some((color) => color.rgba.a === 128)).toBe(true)
  })

  it('excludes semi-transparent pixels when asked', () => {
    const data = bytes([
      [255, 0, 0, 255],
      [0, 0, 0, 127]
    ])
    const result = extractColors(data, { ...DEFAULT_EXTRACT_OPTIONS, includeSemiTransparent: false })
    expect(result.ignoredSemiTransparent).toBe(1)
    expect(result.colors).toHaveLength(1)
  })

  it('merges perceptually close colors without losing frequency totals', () => {
    const data = bytes([
      [128, 128, 128, 255],
      [129, 129, 129, 255],
      [200, 50, 50, 255],
      [128, 128, 128, 255]
    ])
    const exact = extractColors(data, DEFAULT_EXTRACT_OPTIONS)
    const merged = extractColors(data, { ...DEFAULT_EXTRACT_OPTIONS, mergeThreshold: 0.02 })
    expect(exact.colors).toHaveLength(3)
    expect(merged.colors).toHaveLength(2)
    const total = merged.colors.reduce((sum, color) => sum + color.count, 0)
    expect(total).toBe(4)
  })

  it('sorts colors by each perceptual dimension', () => {
    const colors: PaletteColor[] = [
      { rgba: { r: 20, g: 20, b: 20, a: 255 }, count: 3 },
      { rgba: { r: 220, g: 200, b: 30, a: 255 }, count: 1 },
      { rgba: { r: 30, g: 80, b: 210, a: 255 }, count: 8 }
    ]
    const byLightness = sortPaletteColors(colors, 'lightness', 'asc')
    expect(byLightness[0].rgba.r).toBe(20)
    const byFrequency = sortPaletteColors(colors, 'frequency', 'desc')
    expect(byFrequency[0].count).toBe(8)
    const byHue = sortPaletteColors(colors, 'hue', 'asc')
    expect(byHue).toHaveLength(3)
  })
})
