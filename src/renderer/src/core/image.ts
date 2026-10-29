import type { Palette } from '@shared/types'
import { rgbaToHex } from './color'
import { imageDataToPacked } from './pixels'

export interface DecodedImage {
  width: number
  height: number
  pixels: Uint32Array
}

function sniffMime(bytes: Uint8Array, name = ''): string {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length > 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif'
  }
  if (bytes.length > 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp'
  }
  const extension = name.toLowerCase().split('.').pop()
  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'bmp':
      return 'image/bmp'
    default:
      return ''
  }
}

function readCanvas(image: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true, alpha: true })
  if (!context) throw new Error('Could not create a 2D canvas context.')
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

export async function decodeImageBytes(bytes: Uint8Array, name = ''): Promise<DecodedImage> {
  const mime = sniffMime(bytes, name)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], mime ? { type: mime } : undefined)
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob, {
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none'
    })
  } catch {
    bitmap = await loadWithImageElement(blob)
  }

  if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
    throw new Error('The image could not be decoded. Use PNG, JPEG, BMP, or a GIF first frame.')
  }

  const imageData = readCanvas(bitmap, bitmap.width, bitmap.height)
  const pixels = imageDataToPacked(imageData)
  const width = bitmap.width
  const height = bitmap.height
  if ('close' in bitmap) bitmap.close()
  return { width, height, pixels }
}

async function loadWithImageElement(blob: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(blob)
  try {
    const element = new Image()
    element.decoding = 'sync'
    element.src = url
    await element.decode()
    return await createImageBitmap(element)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Could not create a 2D canvas context.')
  return { canvas, context }
}

async function canvasBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed.')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Encode an editor layer to PNG. Scaling (when requested) is done with
 * imageSmoothingEnabled explicitly disabled on every draw call.
 */
export async function pixelsToPngBytes(
  pixels: Uint32Array,
  width: number,
  height: number,
  scale = 1
): Promise<Uint8Array> {
  const native = makeCanvas(width, height)
  const imageData = new ImageData(width, height)
  const view = new Uint32Array(imageData.data.buffer)
  view.set(pixels.subarray(0, width * height))
  native.context.putImageData(imageData, 0, 0)

  const factor = Math.max(1, Math.round(scale))
  if (factor === 1) {
    native.context.imageSmoothingEnabled = false
    return canvasBytes(native.canvas)
  }

  const scaled = makeCanvas(width * factor, height * factor)
  scaled.context.imageSmoothingEnabled = false
  scaled.context.drawImage(native.canvas, 0, 0, width * factor, height * factor)
  return canvasBytes(scaled.canvas)
}

export interface PaletteStripOptions {
  swatchSize: number
  showHex: boolean
  showName: boolean
}

export const DEFAULT_STRIP_OPTIONS: PaletteStripOptions = {
  swatchSize: 72,
  showHex: true,
  showName: true
}

export async function paletteStripPngBytes(
  palette: Palette,
  options: PaletteStripOptions
): Promise<Uint8Array> {
  await document.fonts.ready
  const size = Math.round(Math.max(24, Math.min(160, options.swatchSize)))
  const gap = 6
  const padding = 20
  const titleHeight = options.showName ? 36 : 0
  const labelHeight = options.showHex ? 24 : 0
  const count = Math.max(1, palette.colors.length)
  const width = padding * 2 + count * size + (count - 1) * gap
  const height = padding * 2 + titleHeight + size + labelHeight
  const { canvas, context } = makeCanvas(width, height)

  context.fillStyle = '#12130f'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = false

  if (options.showName) {
    context.fillStyle = '#f2f0e7'
    context.font = '600 15px "Space Grotesk Variable", "Segoe UI", sans-serif'
    context.textBaseline = 'middle'
    context.fillText(palette.name, padding, padding + 6)
    context.fillStyle = '#74786c'
    context.font = '10px "JetBrains Mono Variable", Consolas, monospace'
    context.textAlign = 'right'
    context.fillText(`${palette.source.toUpperCase()} · ${palette.colors.length}`, width - padding, padding + 7)
    context.textAlign = 'left'
  }

  const top = padding + titleHeight
  palette.colors.forEach((color, index) => {
    const x = padding + index * (size + gap)
    context.fillStyle = rgbaToHex(color.rgba)
    context.fillRect(x, top, size, size)
    context.strokeStyle = 'rgba(255,255,255,0.08)'
    context.lineWidth = 1
    context.strokeRect(x + 0.5, top + 0.5, size - 1, size - 1)
    if (options.showHex) {
      context.fillStyle = '#a5a99b'
      context.font = '10px "JetBrains Mono Variable", Consolas, monospace'
      context.textAlign = 'left'
      context.fillText(rgbaToHex(color.rgba).toUpperCase(), x, top + size + 15)
    }
  })

  return canvasBytes(canvas)
}

export async function canvasFromPacked(
  pixels: Uint32Array,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const { canvas, context } = makeCanvas(width, height)
  const data = new ImageData(width, height)
  new Uint32Array(data.data.buffer).set(pixels.subarray(0, width * height))
  context.putImageData(data, 0, 0)
  return canvas
}
