import type { Palette, ProjectLayerMeta, ProjectManifest, RGBA } from '@shared/types'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { normalizePalette } from './palette'
import { flattenLayers, toRgbaBytes } from './pixels'

export interface ProjectLayerData {
  id: string
  name: string
  visible: boolean
  opacity: number
  pixels: Uint32Array
}

export interface ProjectData {
  manifest: ProjectManifest
  width: number
  height: number
  pixels: Uint32Array
  layers: ProjectLayerData[]
  activeLayer: number
  palette: Palette | null
}

export function buildProjectBytes(input: {
  width: number
  height: number
  name: string
  pixels: Uint32Array
  layers?: ProjectLayerData[]
  activeLayer?: number
  palette: Palette | null
  createdAt?: number
}): Uint8Array {
  const layers = input.layers?.length ? input.layers : null
  const manifest: ProjectManifest = {
    format: 'pixelramp-project',
    version: layers ? 2 : 1,
    app: 'PixelRamp',
    width: input.width,
    height: input.height,
    name: input.name,
    createdAt: input.createdAt ?? Date.now(),
    savedAt: Date.now(),
    palette: input.palette ? (JSON.parse(JSON.stringify(input.palette)) as Palette) : null,
    ...(layers
      ? {
          layers: layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity
          })),
          activeLayer: Math.max(0, Math.min(layers.length - 1, input.activeLayer ?? layers.length - 1))
        }
      : {})
  }
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'pixels.rgba': toRgbaBytes(input.pixels)
  }
  if (layers) {
    layers.forEach((layer, index) => {
      entries[`layers/${index}.rgba`] = toRgbaBytes(layer.pixels)
    })
  }
  const zipped = zipSync(entries, { level: 6 })
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
  if (!manifestBytes) {
    throw new Error('The project is missing its manifest.')
  }

  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new Error('The project manifest is not valid JSON.')
  }
  if (!isRecord(raw) || raw.format !== 'pixelramp-project' || (raw.version !== 1 && raw.version !== 2)) {
    throw new Error('This project format is not supported.')
  }
  const version = raw.version as 1 | 2
  const width = Number(raw.width)
  const height = Number(raw.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256) {
    throw new Error('The project has invalid dimensions.')
  }

  const readPixels = (entry: Uint8Array | undefined, label: string): Uint32Array => {
    if (!entry || entry.byteLength !== width * height * 4) {
      throw new Error(`The project ${label} pixel data does not match its dimensions.`)
    }
    const copy = new Uint8Array(entry.byteLength)
    copy.set(entry)
    return new Uint32Array(copy.buffer)
  }

  const layers: ProjectLayerData[] = []
  if (version === 2 && Array.isArray(raw.layers) && raw.layers.length > 0) {
    raw.layers.forEach((entry, index) => {
      if (!isRecord(entry)) throw new Error('The project has invalid layer metadata.')
      layers.push({
        id: typeof entry.id === 'string' && entry.id ? entry.id : `layer-${index}`,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `Layer ${index + 1}`,
        visible: entry.visible !== false,
        opacity:
          typeof entry.opacity === 'number' ? Math.max(0, Math.min(1, entry.opacity)) : 1,
        pixels: readPixels(entries[`layers/${index}.rgba`], `layer ${index + 1}`)
      })
    })
  }
  if (layers.length === 0) {
    layers.push({
      id: 'layer-0',
      name: 'Layer 1',
      visible: true,
      opacity: 1,
      pixels: readPixels(pixelBytes, '')
    })
  }

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

  const activeLayer = Math.max(
    0,
    Math.min(
      layers.length - 1,
      typeof raw.activeLayer === 'number' && Number.isInteger(raw.activeLayer)
        ? raw.activeLayer
        : layers.length - 1
    )
  )

  const manifest: ProjectManifest = {
    format: 'pixelramp-project',
    version,
    app: 'PixelRamp',
    width,
    height,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Imported project',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
    palette,
    ...(version === 2
      ? { layers: layers.map(({ pixels: _pixels, ...meta }) => meta), activeLayer }
      : {})
  }

  const pixels = pixelBytes
    ? readPixels(pixelBytes, '')
    : flattenLayers(layers, width, height)

  return { manifest, width, height, pixels, layers, activeLayer, palette }
}
