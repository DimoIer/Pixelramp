import { clamp, hslToRgba, rgbToHsl } from './color'
import { resizeNearest, unpackColor } from './pixels'

export interface CurvePoint {
  x: number
  y: number
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function packedRgb(r: number, g: number, b: number, a: number): number {
  return (
    (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>>
    0
  )
}

export function adjustBrightnessContrast(
  pixels: Uint32Array,
  brightness: number,
  contrast: number
): Uint32Array {
  const shift = clamp(brightness, -100, 100) * 2.55
  const c = clamp(contrast, -100, 100) * 2.55
  const factor = (259 * (c + 255)) / (255 * (259 - c))
  const output = new Uint32Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index] >>> 0
    const a = value >>> 24
    const r = clampByte((((value & 0xff) + shift - 128) * factor) + 128)
    const g = clampByte(((((value >>> 8) & 0xff) + shift - 128) * factor) + 128)
    const b = clampByte(((((value >>> 16) & 0xff) + shift - 128) * factor) + 128)
    output[index] = packedRgb(r, g, b, a)
  }
  return output
}

export function adjustHueSaturation(
  pixels: Uint32Array,
  hueShift: number,
  saturation: number
): Uint32Array {
  const hue = clamp(hueShift, -180, 180)
  const saturationFactor = 1 + clamp(saturation, -100, 100) / 100
  const output = new Uint32Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const color = unpackColor(pixels[index] >>> 0)
    if (color.a === 0) {
      output[index] = 0
      continue
    }
    const hsl = rgbToHsl(color)
    const next = hslToRgba(
      {
        h: hsl.h + hue,
        s: clamp(hsl.s * saturationFactor, 0, 1),
        l: hsl.l
      },
      color.a
    )
    output[index] = packedRgb(next.r, next.g, next.b, next.a)
  }
  return output
}

export function adjustOpacity(pixels: Uint32Array, opacity: number): Uint32Array {
  const factor = clamp(opacity, 0, 100) / 100
  const output = new Uint32Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index] >>> 0
    const a = Math.round((value >>> 24) * factor)
    output[index] = a === 0 ? 0 : (value & 0x00ffffff) | (a << 24)
  }
  return output
}

export function invertPixels(pixels: Uint32Array): Uint32Array {
  const output = new Uint32Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index] >>> 0
    output[index] =
      (((value >>> 24) << 24) |
        ((255 - ((value >>> 16) & 0xff)) << 16) |
        ((255 - ((value >>> 8) & 0xff)) << 8) |
        (255 - (value & 0xff))) >>>
      0
  }
  return output
}

/** Monotone cubic interpolation through sorted control points. */
export function buildCurveLut(points: CurvePoint[], size = 256): Uint8Array {
  const sorted = [...points]
    .map((point) => ({
      x: clamp(point.x, 0, 1),
      y: clamp(point.y, 0, 1)
    }))
    .sort((a, b) => a.x - b.x)

  const clean: CurvePoint[] = []
  for (const point of sorted) {
    if (clean.length > 0 && Math.abs(clean[clean.length - 1].x - point.x) < 1e-6) {
      clean[clean.length - 1] = point
    } else {
      clean.push(point)
    }
  }
  if (clean.length === 0) return new Uint8Array(size).map((_, index) => index)
  if (clean[0].x > 0) clean.unshift({ x: 0, y: clean[0].y })
  if (clean[clean.length - 1].x < 1) clean.push({ x: 1, y: clean[clean.length - 1].y })
  if (clean.length === 2) {
    const [a, b] = clean
    const lut = new Uint8Array(size)
    for (let index = 0; index < size; index += 1) {
      const x = index / (size - 1)
      const t = x <= a.x ? 0 : x >= b.x ? 1 : (x - a.x) / (b.x - a.x)
      lut[index] = clampByte((a.y + (b.y - a.y) * t) * 255)
    }
    return lut
  }

  const n = clean.length
  const slopes = new Float64Array(n - 1)
  for (let index = 0; index < n - 1; index += 1) {
    slopes[index] = (clean[index + 1].y - clean[index].y) / (clean[index + 1].x - clean[index].x)
  }
  const tangents = new Float64Array(n)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let index = 1; index < n - 1; index += 1) {
    const a = slopes[index - 1]
    const b = slopes[index]
    tangents[index] = a * b <= 0 ? 0 : (a + b) / 2
  }
  for (let index = 0; index < n - 1; index += 1) {
    if (slopes[index] === 0) {
      tangents[index] = 0
      tangents[index + 1] = 0
      continue
    }
    const t0 = tangents[index] / slopes[index]
    const t1 = tangents[index + 1] / slopes[index]
    const length = t0 * t0 + t1 * t1
    if (length > 9) {
      const scale = 3 / Math.sqrt(length)
      tangents[index] = scale * t0 * slopes[index]
      tangents[index + 1] = scale * t1 * slopes[index]
    }
  }

  const lut = new Uint8Array(size)
  for (let index = 0; index < size; index += 1) {
    const x = index / (size - 1)
    let segment = 0
    while (segment < n - 2 && x > clean[segment + 1].x) segment += 1
    const left = clean[segment]
    const right = clean[segment + 1]
    const width = right.x - left.x
    const t = width <= 0 ? 0 : (x - left.x) / width
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    const y =
      h00 * left.y +
      h10 * width * tangents[segment] +
      h01 * right.y +
      h11 * width * tangents[segment + 1]
    lut[index] = clampByte(y * 255)
  }
  return lut
}

export function applyCurve(pixels: Uint32Array, lut: Uint8Array): Uint32Array {
  const output = new Uint32Array(pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index] >>> 0
    const a = value >>> 24
    output[index] = packedRgb(
      lut[value & 0xff] ?? (value & 0xff),
      lut[(value >>> 8) & 0xff] ?? ((value >>> 8) & 0xff),
      lut[(value >>> 16) & 0xff] ?? ((value >>> 16) & 0xff),
      a
    )
  }
  return output
}

export function scalePixels(
  pixels: Uint32Array,
  width: number,
  height: number,
  nextWidth: number,
  nextHeight: number
): Uint32Array {
  return resizeNearest(pixels, width, height, nextWidth, nextHeight)
}
