import type { ColorRole, RampParams, RGBA } from '@shared/types'
import {
  clamp,
  clamp01,
  hslToRgba,
  oklabDistance,
  oklchToOklab,
  oklchToSrgb,
  rgbaToOklab,
  rgbaToOklch,
  rgbaToHex,
  rgbToHsl
} from './color'

export interface RampColor {
  rgba: RGBA
  role: ColorRole
  clipped: boolean
  /** Position on the generated lightness ramp, 0 = darkest. */
  position: number
  /** Normalized distance from the base lightness. */
  influence: number
  oklch: { L: number; C: number; h: number }
}

export interface RampWarning {
  code: 'too-close' | 'gamut' | 'range'
  message: string
}

export interface RampResult {
  colors: RampColor[]
  warnings: RampWarning[]
  clippedCount: number
  minStepDeltaE: number
  baseLightness: number
  isNeutral: boolean
}

const COOL_TINT_HUE = 256
const WARM_TINT_HUE = 78

const easeInOut = (t: number): number => t * t * (3 - 2 * t)

export function clampRampParams(params: RampParams): RampParams {
  const baseColor = params.baseColor
  const count = clamp(Math.round(params.count), 3, 15)
  let low = clamp(params.lightnessRange[0], 0.01, 0.98)
  let high = clamp(params.lightnessRange[1], 0.01, 0.98)
  if (low > high) [low, high] = [high, low]
  if (high - low < 0.02) {
    high = clamp(low + 0.02, 0.02, 0.99)
    low = clamp(high - 0.02, 0.01, 0.98)
  }
  return {
    ...params,
    baseColor,
    count,
    lightnessRange: [low, high],
    hueShift: {
      shadows: clamp(params.hueShift.shadows, -60, 0),
      highlights: clamp(params.hueShift.highlights, 0, 60)
    }
  }
}

/** The default range from the spec: roughly ±0.35 OKLCh L around the base. */
export function autoLightnessRange(baseColor: RGBA): [number, number] {
  const baseL = rgbaToOklch(baseColor).L
  const low = Math.max(0.08, baseL - 0.35)
  const high = Math.min(0.95, baseL + 0.35)
  return [Number(low.toFixed(3)), Number(high.toFixed(3))]
}

export function defaultRampParams(baseColor: RGBA, count = 7): RampParams {
  return {
    baseColor,
    count,
    lightnessRange: autoLightnessRange(baseColor),
    chromaTaper: true,
    hueShift: { shadows: -15, highlights: 10 },
    colorSpace: 'OKLCh',
    interpolation: 'linear'
  }
}

function lightnessValues(params: RampParams): number[] {
  const [low, high] = params.lightnessRange
  const values: number[] = []
  for (let index = 0; index < params.count; index += 1) {
    const raw = params.count === 1 ? 0.5 : index / (params.count - 1)
    const t = params.interpolation === 'eased' ? easeInOut(raw) : raw
    values.push(low + (high - low) * t)
  }
  return values
}

function roleFor(index: number, lightness: number, baseLightness: number, values: number[]): ColorRole {
  let closest = 0
  let closestDelta = Infinity
  values.forEach((value, i) => {
    const delta = Math.abs(value - baseLightness)
    if (delta < closestDelta) {
      closest = i
      closestDelta = delta
    }
  })
  if (index === closest && closestDelta <= 0.06) return 'base'
  if (lightness < baseLightness - 0.005) return 'shadow'
  if (lightness > baseLightness + 0.005) return 'highlight'
  return 'neutral'
}

/**
 * Builds a ramp in OKLCh. Pixel-art rules are applied in this order:
 * 1. equal perceptual lightness steps across the requested range;
 * 2. shadows gain chroma and take a cool bias, highlights taper toward warm;
 * 3. near-neutral bases receive a deliberate cool/warm tint so a grey base
 *    produces blue-grey shadows and cream highlights instead of a flat grey ramp.
 */
export function generateRamp(input: RampParams): RampResult {
  const params = clampRampParams(input)
  const base = params.baseColor
  const alpha = base.a
  const values = lightnessValues(params)
  const warnings: RampWarning[] = []

  if (params.colorSpace === 'HSL') {
    return generateHslRamp(params, values, alpha, warnings)
  }

  const baseLch = rgbaToOklch(base)
  const baseL = baseLch.L
  const baseC = baseLch.C
  const isNeutral = baseC < 0.018
  const maxDistance = Math.max(
    0.02,
    Math.abs(values[0] - baseL),
    Math.abs(values[values.length - 1] - baseL)
  )
  const shadowStrength = Math.abs(params.hueShift.shadows) / 15
  const highlightStrength = Math.abs(params.hueShift.highlights) / 15
  const shadowAmount = clamp01(Math.abs(params.hueShift.shadows) / 40)
  const highlightAmount = clamp01(Math.abs(params.hueShift.highlights) / 40)

  const colors: RampColor[] = values.map((lightness, index) => {
    const darker = lightness < baseL
    const rawDistance = Math.abs(lightness - baseL)
    const influence = clamp01(rawDistance / maxDistance)
    const t = influence
    const neutralFactor = clamp01((0.055 - baseC) / 0.055)

    const targetHue = darker ? COOL_TINT_HUE : WARM_TINT_HUE
    const shiftAmount = darker ? shadowAmount : highlightAmount
    const neutralWeight = 0.55 + 0.35 * neutralFactor
    const hue = isNeutral
      ? targetHue
      : mixHueAngles(baseLch.h, targetHue, shiftAmount * t * neutralWeight)

    let chroma: number
    if (darker) {
      chroma = baseC * (1 + 0.16 * t)
      const coolTint = 0.047 * t * (0.55 + 0.45 * shadowStrength)
      if (isNeutral) chroma = Math.max(chroma, coolTint * shiftAmount)
      else if (neutralFactor > 0.25) chroma = Math.max(chroma, coolTint * neutralFactor)
    } else {
      const taper = params.chromaTaper ? 1 - 0.54 * t : 1
      chroma = baseC * taper
      const warmTint = 0.03 * t * (0.55 + 0.45 * highlightStrength)
      if (isNeutral) chroma = Math.max(chroma, warmTint * shiftAmount)
      else if (neutralFactor > 0.25) chroma = Math.max(chroma, warmTint * neutralFactor)
    }

    chroma = clamp(chroma, 0, 0.37)
    const converted = oklchToSrgb({ L: lightness, C: chroma, h: hue }, alpha)
    const role = roleFor(index, lightness, baseL, values)

    return {
      rgba: converted.rgba,
      role,
      clipped: converted.clipped,
      position: params.count === 1 ? 0.5 : index / (params.count - 1),
      influence,
      oklch: { L: lightness, C: chroma, h: hue }
    }
  })

  let minStepDeltaE = Infinity
  for (let index = 1; index < colors.length; index += 1) {
    minStepDeltaE = Math.min(
      minStepDeltaE,
      oklabDistance(rgbaToOklab(colors[index - 1].rgba), rgbaToOklab(colors[index].rgba))
    )
  }
  if (!Number.isFinite(minStepDeltaE)) minStepDeltaE = 0

  const clippedCount = colors.filter((color) => color.clipped).length
  if (colors.length > 2 && minStepDeltaE < 0.008) {
    warnings.push({
      code: 'too-close',
      message: 'Adjacent steps are perceptually very close. Widen the lightness range or reduce the step count.'
    })
  }
  if (clippedCount > 0) {
    warnings.push({
      code: 'gamut',
      message: `${clippedCount} color${clippedCount === 1 ? '' : 's'} clipped into sRGB. The swatches are marked with a notch.`
    })
  }

  return {
    colors,
    warnings,
    clippedCount,
    minStepDeltaE,
    baseLightness: baseL,
    isNeutral
  }
}

/** Blend hue toward a target along the shortest arc. */
function mixHueAngles(baseHue: number, targetHue: number, blend: number): number {
  const a = targetHue * (Math.PI / 180)
  const base = baseHue * (Math.PI / 180)
  const tx = Math.cos(a) * blend + Math.cos(base) * (1 - blend)
  const ty = Math.sin(a) * blend + Math.sin(base) * (1 - blend)
  const mixed = (Math.atan2(ty, tx) * 180) / Math.PI
  return (mixed + 360) % 360
}

function generateHslRamp(
  params: RampParams,
  values: number[],
  alpha: number,
  warnings: RampWarning[]
): RampResult {
  const base = params.baseColor
  const baseHsl = rgbToHsl(base)
  const baseLch = rgbaToOklch(base)
  const maxDistance = Math.max(
    0.02,
    Math.abs(values[0] - baseLch.L),
    Math.abs(values[values.length - 1] - baseLch.L)
  )
  const neutral = baseHsl.s < 0.06
  const shadowAmount = clamp01(Math.abs(params.hueShift.shadows) / 40)
  const highlightAmount = clamp01(Math.abs(params.hueShift.highlights) / 40)
  const colors: RampColor[] = values.map((lightness, index) => {
    const darker = lightness < baseLch.L
    const influence = clamp01(Math.abs(lightness - baseLch.L) / maxDistance)
    const shiftAmount = darker ? shadowAmount : highlightAmount
    const targetHue = darker ? COOL_TINT_HUE : WARM_TINT_HUE
    const hue = mixHueAngles(
      baseHsl.h,
      targetHue,
      shiftAmount * influence * (neutral ? 0.9 : 0.6)
    )
    let saturation = baseHsl.s
    if (darker) saturation = saturation * (1 + 0.08 * influence)
    else if (params.chromaTaper) saturation *= 1 - 0.42 * influence
    if (neutral) {
      saturation = Math.max(saturation, (darker ? 0.22 : 0.13) * influence * shiftAmount)
    }
    const converted = hslToRgba({ h: hue, s: clamp01(saturation), l: lightness }, alpha)
    return {
      rgba: converted,
      role: roleFor(index, lightness, baseLch.L, values),
      clipped: false,
      position: params.count === 1 ? 0.5 : index / (params.count - 1),
      influence,
      oklch: rgbaToOklch(converted)
    }
  })

  let minStepDeltaE = Infinity
  for (let index = 1; index < colors.length; index += 1) {
    minStepDeltaE = Math.min(
      minStepDeltaE,
      oklabDistance(rgbaToOklab(colors[index - 1].rgba), rgbaToOklab(colors[index].rgba))
    )
  }
  if (!Number.isFinite(minStepDeltaE)) minStepDeltaE = 0
  if (colors.length > 2 && minStepDeltaE < 0.008) {
    warnings.push({
      code: 'too-close',
      message: 'Adjacent steps are perceptually very close. Widen the lightness range or reduce the step count.'
    })
  }

  return {
    colors,
    warnings,
    clippedCount: 0,
    minStepDeltaE,
    baseLightness: baseLch.L,
    isNeutral: neutral
  }
}

export function describeRamp(ramp: RampResult): string {
  return ramp.colors.map((color) => `${rgbaToHex(color.rgba)} ${color.role}`).join('\n')
}

export function nearestRampIndex(colors: RampColor[], target: RGBA): number {
  const targetLab = rgbaToOklab(target)
  let best = 0
  let bestDistance = Infinity
  colors.forEach((color, index) => {
    const distance = oklabDistance(rgbaToOklab(color.rgba), targetLab)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

export function rampRoleForLightness(lightness: number, baseLightness: number): ColorRole {
  if (Math.abs(lightness - baseLightness) < 0.012) return 'base'
  return lightness < baseLightness ? 'shadow' : 'highlight'
}

export { oklchToOklab }
