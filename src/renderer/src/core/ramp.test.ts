import { describe, expect, it } from 'vitest'
import type { RGBA } from '@shared/types'
import { rgba, rgbaToOklab, rgbaToOklch } from './color'
import { autoLightnessRange, defaultRampParams, generateRamp } from './ramp'

const grey: RGBA = { r: 128, g: 128, b: 128, a: 255 }

describe('OKLCh ramp generation', () => {
  it('produces the requested step count in ascending lightness', () => {
    const result = generateRamp({ ...defaultRampParams(grey, 5) })
    expect(result.colors).toHaveLength(5)
    const lamp = result.colors.map((color) => rgbaToOklab(color.rgba).L)
    for (let i = 1; i < lamp.length; i += 1) {
      expect(lamp[i]).toBeGreaterThan(lamp[i - 1])
    }
  })

  it('gives a grey base blue-violet shadows and warm highlights', () => {
    const result = generateRamp({ ...defaultRampParams(grey, 5) })
    const shadow = rgbaToOklab(result.colors[0].rgba)
    const highlight = rgbaToOklab(result.colors[result.colors.length - 1].rgba)
    expect(shadow.b).toBeLessThan(-0.005)
    expect(highlight.b).toBeGreaterThan(0.003)
    expect(result.colors[0].role).toBe('shadow')
    expect(result.colors[2].role).toBe('base')
    expect(result.colors[4].role).toBe('highlight')
  })

  it('uses the auto range around the base', () => {
    const [low, high] = autoLightnessRange(grey)
    const baseL = rgbaToOklch(grey).L
    expect(low).toBeCloseTo(baseL - 0.35, 2)
    expect(high).toBeCloseTo(baseL + 0.35, 2)
  })

  it('moves shadow and highlight hue for a muted colored base', () => {
    const base = rgba(122, 139, 111)
    const flat = generateRamp({
      ...defaultRampParams(base, 5),
      hueShift: { shadows: 0, highlights: 0 }
    })
    const tinted = generateRamp({
      ...defaultRampParams(base, 5),
      hueShift: { shadows: -26, highlights: 14 }
    })
    const shadowA = rgbaToOklch(flat.colors[0].rgba)
    const shadowB = rgbaToOklch(tinted.colors[0].rgba)
    const highlightA = rgbaToOklch(flat.colors[4].rgba)
    const highlightB = rgbaToOklch(tinted.colors[4].rgba)
    const hueDelta = (a: number, b: number): number =>
      Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
    expect(hueDelta(shadowA.h, shadowB.h)).toBeGreaterThan(3)
    expect(hueDelta(highlightA.h, highlightB.h)).toBeGreaterThan(3)
  })

  it('increases the cool tint as the shadow slider is increased', () => {
    const quiet = generateRamp({
      ...defaultRampParams(grey, 5),
      hueShift: { shadows: -4, highlights: 4 }
    })
    const strong = generateRamp({
      ...defaultRampParams(grey, 5),
      hueShift: { shadows: -30, highlights: 30 }
    })
    expect(Math.abs(rgbaToOklab(strong.colors[0].rgba).b)).toBeGreaterThan(
      Math.abs(rgbaToOklab(quiet.colors[0].rgba).b)
    )
  })

  it('respects HSL mode and will not return NaN', () => {
    const result = generateRamp({
      ...defaultRampParams(rgba(120, 84, 64), 7),
      colorSpace: 'HSL'
    })
    for (const color of result.colors) {
      expect(Number.isFinite(color.rgba.r)).toBe(true)
      expect(Number.isFinite(color.rgba.g)).toBe(true)
      expect(Number.isFinite(color.rgba.b)).toBe(true)
      expect(color.rgba.a).toBe(255)
    }
  })

  it('warns when steps are perceptually too close', () => {
    const result = generateRamp({
      ...defaultRampParams(grey, 15),
      lightnessRange: [0.48, 0.54]
    })
    expect(result.warnings.some((warning) => warning.code === 'too-close')).toBe(true)
  })

  it('clamps parameters into safe ranges', () => {
    const result = generateRamp({
      ...defaultRampParams(grey, 99),
      lightnessRange: [0.9, 0.1]
    })
    expect(result.colors).toHaveLength(15)
    expect(result.colors[0].rgba.a).toBe(255)
  })
})
