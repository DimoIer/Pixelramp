import { describe, expect, it } from 'vitest'
import {
  oklabToSrgb,
  parseHex,
  rgbaToHex,
  rgbaToOklab,
  rgbaToOklch,
  oklchToSrgb,
  rgba
} from './color'

describe('color conversion', () => {
  it('round-trips representative sRGB colors through OKLab', () => {
    const samples = [
      rgba(0, 0, 0),
      rgba(255, 255, 255),
      rgba(128, 128, 128),
      rgba(210, 84, 39),
      rgba(63, 132, 196),
      rgba(94, 71, 119)
    ]
    for (const sample of samples) {
      const back = oklabToSrgb(rgbaToOklab(sample)).rgba
      expect(Math.abs(back.r - sample.r)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.g - sample.g)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.b - sample.b)).toBeLessThanOrEqual(1)
    }
  })

  it('places achromatic colors on the OKLab L axis', () => {
    expect(rgbaToOklab(rgba(0, 0, 0)).L).toBeCloseTo(0, 4)
    expect(rgbaToOklab(rgba(255, 255, 255)).L).toBeCloseTo(1, 3)
    expect(rgbaToOklab(rgba(128, 128, 128)).L).toBeCloseTo(0.5999, 2)
    expect(rgbaToOklch(rgba(128, 128, 128)).C).toBeLessThan(0.002)
  })

  it('parses and serializes hex colors', () => {
    expect(parseHex('#ff8800')).toEqual({ r: 255, g: 136, b: 0, a: 255 })
    expect(parseHex('abc')).toEqual({ r: 170, g: 187, b: 204, a: 255 })
    expect(parseHex('#11223344')).toEqual({ r: 17, g: 34, b: 51, a: 68 })
    expect(rgbaToHex({ r: 17, g: 34, b: 51, a: 255 })).toBe('#112233')
    expect(parseHex('nope')).toBeNull()
  })

  it('clips out-of-gamut OKLCh colors and reports it', () => {
    const extreme = oklchToSrgb({ L: 0.6, C: 0.4, h: 20 }, 255)
    expect(extreme.clipped).toBe(true)
    expect(extreme.rgba.r).toBeGreaterThanOrEqual(0)
    expect(extreme.rgba.r).toBeLessThanOrEqual(255)
  })
})
