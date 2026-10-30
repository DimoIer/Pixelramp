import { describe, expect, it } from 'vitest'
import {
  adjustBrightnessContrast,
  adjustHueSaturation,
  adjustOpacity,
  applyCurve,
  buildCurveLut,
  invertPixels,
  scalePixels
} from './adjustments'
import { packColor, unpackColor } from './pixels'

const red = { r: 255, g: 0, b: 0, a: 255 }

function one(color = red): Uint32Array {
  return new Uint32Array([packColor(color)])
}

describe('pixel adjustments', () => {
  it('inverts RGB and preserves alpha', () => {
    const out = invertPixels(one({ ...red, a: 128 }))
    expect(unpackColor(out[0])).toEqual({ r: 0, g: 255, b: 255, a: 128 })
  })

  it('multiplies alpha without changing RGB', () => {
    const out = adjustOpacity(one({ ...red, a: 200 }), 50)
    expect(unpackColor(out[0])).toEqual({ ...red, a: 100 })
  })

  it('adjusts brightness and contrast', () => {
    const bright = unpackColor(adjustBrightnessContrast(one({ ...red, a: 255 }), 20, 0)[0])
    expect(bright.r).toBe(255)
    const gray = unpackColor(
      adjustBrightnessContrast(one({ r: 160, g: 160, b: 160, a: 255 }), 0, 50)[0]
    )
    expect(gray.r).toBeGreaterThan(160)
    expect(gray.r).toBe(gray.g)
    expect(gray.g).toBe(gray.b)
  })

  it('shifts hue and saturation', () => {
    const out = unpackColor(adjustHueSaturation(one(red), 120, 0)[0])
    expect(out.g).toBeGreaterThan(200)
    expect(out.b).toBeLessThan(40)
  })

  it('builds an identity curve and applies it', () => {
    const lut = buildCurveLut([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 }
    ])
    expect(lut[0]).toBe(0)
    expect(lut[128]).toBe(128)
    expect(lut[255]).toBe(255)
    const color = { r: 32, g: 64, b: 128, a: 200 }
    expect(unpackColor(applyCurve(one(color), lut)[0])).toEqual(color)
  })

  it('scales with nearest neighbor', () => {
    const source = new Uint32Array([packColor(red), 0, 0, 0])
    const out = scalePixels(source, 2, 2, 4, 4)
    expect(out).toHaveLength(16)
    expect(out[0]).toBe(packColor(red))
    expect(out[1]).toBe(packColor(red))
    expect(out[2]).toBe(0)
  })
})
