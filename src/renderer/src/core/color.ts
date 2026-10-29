import type { RGBA } from '@shared/types'

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const clamp01 = (value: number): number => clamp(value, 0, 1)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const DEG = Math.PI / 180

export interface OKLab {
  L: number
  a: number
  b: number
}

export interface OKLCh {
  L: number
  C: number
  h: number
}

export interface HSL {
  h: number
  s: number
  l: number
}

export interface GamutColor {
  rgba: RGBA
  clipped: boolean
}

const EPSILON = 0.00002

export function byte(value: number): number {
  return Math.round(clamp(value, 0, 255))
}

export function rgba(r: number, g: number, b: number, a = 255): RGBA {
  return { r: byte(r), g: byte(g), b: byte(b), a: byte(a) }
}

export function alphaRatio(color: RGBA): number {
  return clamp(color.a, 0, 255) / 255
}

export function normalizeRgba(value: Partial<RGBA> | null | undefined): RGBA {
  return rgba(value?.r ?? 0, value?.g ?? 0, value?.b ?? 0, value?.a ?? 255)
}

export function colorsEqual(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a
}

export function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function linearToSrgb(channel: number): number {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055
  return c * 255
}

/** Björn Ottosson's OKLab transform, from sRGB bytes. */
export function rgbaToOklab(color: RGBA): OKLab {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l3 = Math.cbrt(l)
  const m3 = Math.cbrt(m)
  const s3 = Math.cbrt(s)

  return {
    L: 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3,
    a: 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3,
    b: 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3
  }
}

export function oklabToLinearRgb(lab: OKLab): [number, number, number] {
  const l3 = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b
  const m3 = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b
  const s3 = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b

  const l = l3 * l3 * l3
  const m = m3 * m3 * m3
  const s = s3 * s3 * s3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
}

/** Returns sRGB bytes and whether any channel had to be clipped into gamut. */
export function oklabToSrgb(lab: OKLab, alpha = 255): GamutColor {
  const [lr, lg, lb] = oklabToLinearRgb(lab)
  const sr = linearToSrgb(lr)
  const sg = linearToSrgb(lg)
  const sb = linearToSrgb(lb)

  const clipped =
    sr < -EPSILON * 255 ||
    sr > 255 + EPSILON * 255 ||
    sg < -EPSILON * 255 ||
    sg > 255 + EPSILON * 255 ||
    sb < -EPSILON * 255 ||
    sb > 255 + EPSILON * 255

  return {
    rgba: rgba(sr, sg, sb, alpha),
    clipped
  }
}

export function oklabToOklch(lab: OKLab): OKLCh {
  const C = Math.hypot(lab.a, lab.b)
  let h = Math.atan2(lab.b, lab.a) / DEG
  if (h < 0) h += 360
  return { L: lab.L, C, h }
}

export function oklchToOklab(lch: OKLCh): OKLab {
  const rad = lch.h * DEG
  return {
    L: lch.L,
    a: Math.cos(rad) * lch.C,
    b: Math.sin(rad) * lch.C
  }
}

export function rgbaToOklch(color: RGBA): OKLCh {
  return oklabToOklch(rgbaToOklab(color))
}

export function oklchToSrgb(lch: OKLCh, alpha = 255): GamutColor {
  return oklabToSrgb(oklchToOklab(lch), alpha)
}

export function oklabDistance(a: OKLab, b: OKLab): number {
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b)
}

export function rgbaDistance(a: RGBA, b: RGBA): number {
  return oklabDistance(rgbaToOklab(a), rgbaToOklab(b))
}

export function rgbToHsl(color: RGBA): HSL {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360
  return { h, s: clamp01(s), l: clamp01(l) }
}

export function hslToRgba(hsl: HSL, alpha = 255): RGBA {
  const h = ((hsl.h % 360) + 360) % 360
  const s = clamp01(hsl.s)
  const l = clamp01(hsl.l)
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  return rgba((r + m) * 255, (g + m) * 255, (b + m) * 255, alpha)
}

export function parseHex(input: string): RGBA | null {
  let value = input.trim().replace(/^#/, '')
  if (![3, 4, 6, 8].includes(value.length) || !/^[0-9a-f]+$/i.test(value)) return null
  if (value.length === 3 || value.length === 4) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  }
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const a = value.length === 8 ? parseInt(value.slice(6, 8), 16) : 255
  return { r, g, b, a }
}

export function rgbaToHex(color: RGBA, includeAlpha = false): string {
  const part = (value: number): string => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  const base = `#${part(color.r)}${part(color.g)}${part(color.b)}`
  return includeAlpha && color.a < 255 ? `${base}${part(color.a)}` : base
}

export function rgbaToHex8(color: RGBA): string {
  return rgbaToHex(color, true)
}

export function cssColor(color: RGBA): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${(color.a / 255).toFixed(3)})`
}

export function relativeLuminance(color: RGBA): number {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastInk(color: RGBA): string {
  return relativeLuminance(color) > 0.42 ? 'rgba(16, 17, 14, 0.82)' : 'rgba(247, 246, 238, 0.9)'
}

export function rotateHue(hue: number, amount: number): number {
  return ((hue + amount) % 360 + 360) % 360
}

export function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180
}

export function mixHue(from: number, to: number, t: number): number {
  return rotateHue(from, shortestAngleDelta(from, to) * clamp01(t))
}
