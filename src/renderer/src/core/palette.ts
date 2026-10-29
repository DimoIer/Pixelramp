import type {
  ColorRole,
  ExtractOptions,
  Palette,
  PaletteColor,
  PaletteSource,
  RampParams,
  RGBA
} from '@shared/types'
import { clamp, normalizeRgba, rgbaToHex, rgbaToOklch } from './color'
import type { RampResult } from './ramp'
import type { ExtractResult } from './extract'

export const ROLE_LABELS: Record<ColorRole, string> = {
  shadow: 'Shadow',
  base: 'Base',
  highlight: 'Highlight',
  neutral: 'Neutral'
}

export const DEFAULT_EXTRACT_OPTIONS: ExtractOptions = {
  includeSemiTransparent: true,
  mergeThreshold: 0,
  ignoreTransparent: true
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createPalette(input: {
  name: string
  colors: PaletteColor[]
  source: PaletteSource
  baseColor?: RGBA
  generationParams?: RampParams
  extractionOptions?: ExtractOptions
}): Palette {
  const now = Date.now()
  return {
    id: makeId(),
    name: input.name,
    colors: input.colors,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    ...(input.baseColor ? { baseColor: input.baseColor } : {}),
    ...(input.generationParams ? { generationParams: input.generationParams } : {}),
    ...(input.extractionOptions ? { extractionOptions: input.extractionOptions } : {})
  }
}

export function defaultRampName(base: RGBA, count: number): string {
  return `${rgbaToHex(base).toUpperCase()} · ${count} 阶`
}

export function paletteFromRamp(ramp: RampResult, params: RampParams, name?: string): Palette {
  return createPalette({
    name: name ?? defaultRampName(params.baseColor, params.count),
    colors: ramp.colors.map((color) => ({ rgba: color.rgba, role: color.role })),
    source: 'generated',
    baseColor: params.baseColor,
    generationParams: params
  })
}

export function paletteColorsFromExtraction(result: ExtractResult): PaletteColor[] {
  return result.colors.map((color) => ({ rgba: color.rgba, count: color.count }))
}

export function paletteFromExtraction(
  result: ExtractResult,
  name: string,
  options?: ExtractOptions
): Palette {
  return createPalette({
    name,
    colors: paletteColorsFromExtraction(result),
    source: 'extracted',
    ...(options ? { extractionOptions: options } : {})
  })
}

export function copyPalette(palette: Palette, name?: string): Palette {
  const now = Date.now()
  return {
    ...palette,
    id: makeId(),
    name: name ?? `${palette.name} copy`,
    colors: palette.colors.map((color) => ({ ...color, rgba: { ...color.rgba } })),
    createdAt: now,
    updatedAt: now
  }
}

export function touchPalette(palette: Palette): Palette {
  return { ...palette, updatedAt: Date.now() }
}

export function defaultPaletteName(index: number): string {
  return `Palette ${String(index).padStart(2, '0')}`
}

export function paletteAccent(palette: Palette | null | undefined): string {
  if (!palette || palette.colors.length === 0) return '#34372e'
  const mid = palette.colors[Math.floor(palette.colors.length / 2)] ?? palette.colors[0]
  return rgbaToHex(mid.rgba)
}

export function sortPaletteByLightness(colors: PaletteColor[]): PaletteColor[] {
  return [...colors].sort((a, b) => rgbaToOklch(a.rgba).L - rgbaToOklch(b.rgba).L)
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeColor(raw: unknown): PaletteColor | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const source = (record.rgba ?? record) as Record<string, unknown>
  if (
    typeof source.r !== 'number' ||
    typeof source.g !== 'number' ||
    typeof source.b !== 'number'
  ) {
    return null
  }
  const rgba = normalizeRgba({
    r: source.r,
    g: source.g,
    b: source.b,
    a: typeof source.a === 'number' ? source.a : 255
  })
  const role = ['shadow', 'base', 'highlight', 'neutral'].includes(String(record.role))
    ? (record.role as ColorRole)
    : undefined
  const count =
    typeof record.count === 'number' && Number.isFinite(record.count)
      ? Math.max(0, Math.round(record.count))
      : undefined
  return { rgba, ...(role ? { role } : {}), ...(count !== undefined ? { count } : {}) }
}

export interface NormalizePaletteOptions {
  preserveIdentity?: boolean
}

/** Lenient palette JSON import that still refuses structurally invalid data. */
export function normalizePalette(
  input: unknown,
  fallbackName = 'Imported palette',
  options: NormalizePaletteOptions = {}
): Palette | null {
  if (!input || typeof input !== 'object') return null
  const root = input as Record<string, unknown>
  const record =
    root.palette && typeof root.palette === 'object'
      ? (root.palette as Record<string, unknown>)
      : root
  const rawColors = Array.isArray(record.colors)
    ? record.colors
    : Array.isArray(record.swatches)
      ? record.swatches
      : null
  if (!rawColors) return null
  const colors = rawColors
    .map(normalizeColor)
    .filter((color): color is PaletteColor => color !== null)
  if (colors.length === 0) return null

  const source: PaletteSource = ['generated', 'extracted', 'manual'].includes(String(record.source))
    ? (record.source as PaletteSource)
    : 'manual'
  const now = Date.now()
  const baseColorRaw = record.baseColor as Record<string, unknown> | undefined
  const baseColor = baseColorRaw && typeof baseColorRaw.r === 'number' ? normalizeRgba(baseColorRaw) : undefined
  const generationParams =
    record.generationParams && typeof record.generationParams === 'object'
      ? (record.generationParams as RampParams)
      : undefined
  const preserveIdentity = options.preserveIdentity === true
  const validId =
    typeof record.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(record.id)
  const createdAt =
    preserveIdentity && typeof record.createdAt === 'number' ? record.createdAt : now
  const updatedAt =
    preserveIdentity && typeof record.updatedAt === 'number' ? record.updatedAt : now
  return {
    id: preserveIdentity && validId ? (record.id as string) : makeId(),
    name:
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : fallbackName,
    colors,
    source,
    createdAt,
    updatedAt,
    ...(baseColor ? { baseColor } : {}),
    ...(generationParams ? { generationParams } : {})
  }
}

export function paletteToExportJson(palette: Palette): string {
  const clean = {
    id: palette.id,
    name: palette.name,
    source: palette.source,
    colors: palette.colors.map((color) => ({
      rgba: { ...color.rgba },
      ...(color.role ? { role: color.role } : {}),
      ...(color.count !== undefined ? { count: color.count } : {})
    })),
    createdAt: palette.createdAt,
    updatedAt: palette.updatedAt,
    ...(palette.baseColor ? { baseColor: { ...palette.baseColor } } : {}),
    ...(palette.generationParams ? { generationParams: palette.generationParams } : {})
  }
  return JSON.stringify(clean, null, 2)
}

export function colorTemperatureLabel(color: PaletteColor): string {
  const lch = rgbaToOklch(color.rgba)
  if (lch.C < 0.02) return 'Neutral'
  if (lch.h >= 190 && lch.h <= 320) return 'Cool'
  if (lch.h >= 35 && lch.h <= 130) return 'Warm'
  return 'Chromatic'
}

export function clampColorChannel(value: number): number {
  return Math.round(clamp(value, 0, 255))
}
