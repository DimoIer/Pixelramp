import type { Palette, ProjectManifest, RGBA } from '@shared/types'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { normalizePalette } from './palette'
import { toRgbaBytes } from './pixels'

export interface ProjectData {
  manifest: ProjectManifest
  width: number
  height: number
  pixels: Uint32Array
  palette: Palette | null
}

export function buildProjectBytes(input: {
  width: number
  height: number
  name: string
  pixels: Uint32Array
  palette: Palette | null
  createdAt?: number
}): Uint8Array {
  const manifest: ProjectManifest = {
    format: 'pixelramp-project',
    version: 1,
    app: 'PixelRamp',
    width: input.width,
    height: input.height,
    name: input.name,
    createdAt: input.createdAt ?? Date.now(),
    savedAt: Date.now(),
    palette: input.palette ? (JSON.parse(JSON.stringify(input.palette)) as Palette) : null
  }
  const raw = toRgbaBytes(input.pixels)
  const zipped = zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'pixels.rgba': raw
    },
    { level: 6 }
  )
  return new Uint8Array(zipped)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseProjectBytes(bytes: Uint8Array): ProjectData {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new Error('This is not a valid PixelRamp project archive.')
  }
  const manifestBytes = entries['manifest.json']
  const pixelBytes = entries['pixels.rgba']
  if (!manifestBytes || !pixelBytes) {
    throw new Error('The project is missing its manifest or pixel data.')
  }

  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new Error('The project manifest is not valid JSON.')
  }
  if (!isRecord(raw) || raw.format !== 'pixelramp-project' || raw.version !== 1) {
    throw new Error('This project format is not supported.')
  }
  const width = Number(raw.width)
  const height = Number(raw.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256) {
    throw new Error('The project has invalid dimensions.')
  }
  if (pixelBytes.byteLength !== width * height * 4) {
    throw new Error('The project pixel data does not match its dimensions.')
  }

  const copy = new Uint8Array(pixelBytes.byteLength)
  copy.set(pixelBytes)
  const pixels = new Uint32Array(copy.buffer)

  let palette: Palette | null = null
  if (raw.palette != null) {
    const normalized = normalizePalette(raw.palette, 'Project palette')
    if (normalized) {
      const p = raw.palette as Record<string, unknown>
      if (typeof p.id === 'string' && p.id.length > 0) normalized.id = p.id
      if (typeof p.createdAt === 'number') normalized.createdAt = p.createdAt
      if (typeof p.updatedAt === 'number') normalized.updatedAt = p.updatedAt
      const base = p.baseColor
      if (isRecord(base)) normalized.baseColor = base as unknown as RGBA
      palette = normalized
    }
  }

  const manifest: ProjectManifest = {
    format: 'pixelramp-project',
    version: 1,
    app: 'PixelRamp',
    width,
    height,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Imported project',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
    palette
  }

  return { manifest, width, height, pixels, palette }
}
