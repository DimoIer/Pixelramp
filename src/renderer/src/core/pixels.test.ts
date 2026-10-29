import { describe, expect, it } from 'vitest'
import {
  bresenham,
  clearRegion,
  extractRegion,
  floodFill,
  mirrorPoints,
  packColor,
  paintPoints,
  pasteRegion,
  pixelPerfectPath,
  prepareImportedPixels,
  rectFromPoints,
  rectPoints,
  unpackColor,
  resizeNearest
} from './pixels'
import { parseProjectBytes, buildProjectBytes } from './project'

const red = { r: 255, g: 0, b: 0, a: 255 }
const blue = { r: 0, g: 0, b: 255, a: 255 }

describe('raster primitives', () => {
  it('packs and unpacks colors', () => {
    expect(unpackColor(packColor(red))).toEqual(red)
    expect(unpackColor(packColor(blue))).toEqual(blue)
  })

  it('draws a connected Bresenham line with no gaps', () => {
    const line = bresenham(0, 0, 5, 3)
    expect(line[0]).toEqual({ x: 0, y: 0 })
    expect(line[line.length - 1]).toEqual({ x: 5, y: 3 })
    for (let index = 1; index < line.length; index += 1) {
      const dx = Math.abs(line[index].x - line[index - 1].x)
      const dy = Math.abs(line[index].y - line[index - 1].y)
      expect(Math.max(dx, dy)).toBe(1)
    }
  })

  it('removes redundant L corners in pixel-perfect mode', () => {
    const path = pixelPerfectPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ])
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ])
  })

  it('creates outline and filled rectangles', () => {
    const outline = rectPoints(0, 0, 2, 2, false)
    expect(outline).toHaveLength(8)
    const filled = rectPoints(0, 0, 2, 2, true)
    expect(filled).toHaveLength(9)
    expect(rectFromPoints({ x: 4, y: 4 }, { x: 2, y: 2 })).toEqual({ x: 2, y: 2, w: 3, h: 3 })
  })

  it('applies mirror symmetry without duplicates', () => {
    const points = mirrorPoints([{ x: 0, y: 0 }], 4, 4, true, true)
    expect(points).toHaveLength(4)
    expect(new Set(points.map((point) => `${point.x},${point.y}`)).size).toBe(4)
  })

  it('flood fills only the contiguous region', () => {
    const pixels = new Uint32Array(5 * 5)
    pixels[0] = packColor(red)
    pixels[4] = packColor(red)
    const changed = floodFill(pixels, 5, 5, 0, 0, packColor(blue), true)
    expect(changed).toBe(1)
    expect(pixels[4]).toBe(packColor(red))
    const global = floodFill(pixels, 5, 5, 4, 0, packColor(blue), false)
    expect(global).toBe(1)
    expect(pixels[4]).toBe(packColor(blue))
  })

  it('copies and pastes regions', () => {
    const pixels = new Uint32Array(4 * 4)
    pixels[0] = packColor(red)
    const region = extractRegion(pixels, 4, 4, { x: 0, y: 0, w: 2, h: 2 })
    expect(region[0]).toBe(packColor(red))
    const target = new Uint32Array(4 * 4)
    pasteRegion(target, 4, 4, region, 2, 2, 2, 2)
    expect(target[10]).toBe(packColor(red))
    clearRegion(target, 4, 4, { x: 2, y: 2, w: 2, h: 2 })
    expect(target[10]).toBe(0)
  })

  it('resizes with nearest neighbor only', () => {
    const source = new Uint32Array([packColor(red), packColor(blue)])
    const scaled = resizeNearest(source, 2, 1, 4, 1)
    expect(scaled[0]).toBe(packColor(red))
    expect(scaled[1]).toBe(packColor(red))
    expect(scaled[2]).toBe(packColor(blue))
    expect(scaled[3]).toBe(packColor(blue))
  })

  it('crops non-square imports to the center', () => {
    const source = new Uint32Array(4 * 2)
    source[0] = packColor(red)
    source[1] = packColor(blue)
    const out = prepareImportedPixels(source, 4, 2, 2, 'crop')
    expect(out).toHaveLength(4)
  })

  it('paints only points inside the canvas', () => {
    const target = new Uint32Array(2 * 2)
    paintPoints(target, 2, 2, [{ x: -1, y: 0 }, { x: 0, y: 1 }], packColor(red))
    expect(target[2]).toBe(packColor(red))
    expect(target[0]).toBe(0)
  })
})

describe('project archive', () => {
  it('round-trips pixels and the palette snapshot exactly', () => {
    const pixels = new Uint32Array([packColor(red), 0, packColor(blue), packColor(red)])
    const bytes = buildProjectBytes({
      width: 2,
      height: 2,
      name: 'Test pattern',
      pixels,
      palette: {
        id: 'palette-1',
        name: 'Test ramp',
        colors: [{ rgba: red, role: 'base' }],
        source: 'generated',
        createdAt: 1,
        updatedAt: 2
      }
    })
    const project = parseProjectBytes(bytes)
    expect(project.width).toBe(2)
    expect(project.height).toBe(2)
    expect(Array.from(project.pixels)).toEqual(Array.from(pixels))
    expect(project.palette?.name).toBe('Test ramp')
    expect(project.palette?.id).toBe('palette-1')
  })
})
