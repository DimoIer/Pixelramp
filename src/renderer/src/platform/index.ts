import type {
  DesktopApi,
  FileFilter,
  FileKind,
  OpenedFile,
  Palette,
  RecentFile,
  SaveFileRequest
} from '@shared/types'
import { normalizePalette } from '../core/palette'

export type OpenKind = 'image' | 'project' | 'any' | 'json' | 'paletteImage'

const PALETTE_KEY = 'pixelramp.palettes.v1'
const RECENT_KEY = 'pixelramp.recent.v1'

const desktop: DesktopApi | undefined =
  typeof window !== 'undefined' ? window.pixelramp : undefined

export const isDesktop = !!desktop

export const platformVersion = (): string => desktop?.version || '0.1.0'

export function onMaximizedChange(callback: (maximized: boolean) => void): () => void {
  return desktop?.window.onMaximizedChange(callback) ?? (() => undefined)
}

export function onCloseRequested(callback: () => void): () => void {
  return desktop?.window.onCloseRequested(callback) ?? (() => undefined)
}

export const windowControls = {
  minimize: (): void => desktop?.window.minimize(),
  toggleMaximize: (): void => desktop?.window.toggleMaximize(),
  close: (): void => desktop?.window.close(),
  forceClose: (): void => {
    if (desktop) {
      desktop.window.forceClose()
    } else {
      window.close()
    }
  },
  isMaximized: async (): Promise<boolean> => (desktop ? desktop.window.isMaximized() : false)
}

function kindForName(name: string): FileKind {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  if (extension === 'pxramp') return 'project'
  if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(extension)) return 'image'
  if (extension === 'json') return 'json'
  return 'unknown'
}

function acceptFor(kind: OpenKind): string {
  switch (kind) {
    case 'project':
      return '.pxramp'
    case 'json':
      return '.json'
    case 'image':
    case 'paletteImage':
      return 'image/png,image/jpeg,image/bmp,image/gif'
    case 'any':
    default:
      return '.pxramp,image/png,image/jpeg,image/bmp,image/gif'
  }
}

async function openInBrowser(kind: OpenKind): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = acceptFor(kind)
    input.style.display = 'none'
    let settled = false
    const finish = (value: OpenedFile | null): void => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        finish(null)
        return
      }
      void file
        .arrayBuffer()
        .then((buffer) => {
          finish({
            path: file.name,
            name: file.name,
            kind: kindForName(file.name),
            bytes: new Uint8Array(buffer)
          })
        })
        .catch(() => finish(null))
    })
    input.addEventListener('cancel', () => finish(null))
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) finish(null)
        }, 500)
      },
      { once: true }
    )
    document.body.appendChild(input)
    input.click()
  })
}

export async function openFile(kind: OpenKind): Promise<OpenedFile | null> {
  if (desktop) return desktop.files.open(kind)
  return openInBrowser(kind)
}

export async function openPath(filePath: string): Promise<OpenedFile | null> {
  if (desktop) return desktop.files.openPath(filePath)
  return null
}

function downloadBytes(bytes: Uint8Array, name: string, mime: string): string {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return name
}

function extensionOf(name: string): string {
  return name.toLowerCase().split('.').pop() ?? ''
}

function mimeForName(name: string): string {
  const ext = extensionOf(name)
  if (ext === 'png') return 'image/png'
  if (ext === 'json') return 'application/json'
  if (ext === 'pxramp') return 'application/zip'
  return 'application/octet-stream'
}

export async function saveFile(request: SaveFileRequest): Promise<string | null> {
  if (desktop) return desktop.files.save(request)
  const suggested = request.suggestedName || 'pixelramp-export'
  return downloadBytes(request.bytes, suggested, mimeForName(suggested))
}

export function revealPath(filePath: string): void {
  desktop?.files.reveal(filePath)
}

function readLocalPalettes(): Palette[] {
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => normalizePalette(value, 'Stored palette', { preserveIdentity: true }))
      .filter((palette): palette is Palette => palette !== null)
  } catch {
    return []
  }
}

function writeLocalPalettes(palettes: Palette[]): void {
  localStorage.setItem(PALETTE_KEY, JSON.stringify(palettes))
}

export async function listPalettes(): Promise<Palette[]> {
  if (desktop) return desktop.palettes.list()
  return readLocalPalettes().sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function savePalette(palette: Palette): Promise<Palette[]> {
  if (desktop) return desktop.palettes.save(palette)
  const palettes = readLocalPalettes()
  const next = [palette, ...palettes.filter((entry) => entry.id !== palette.id)]
  writeLocalPalettes(next)
  return next.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function removePalette(id: string): Promise<Palette[]> {
  if (desktop) return desktop.palettes.remove(id)
  const palettes = readLocalPalettes().filter((entry) => entry.id !== id)
  writeLocalPalettes(palettes)
  return palettes
}

function readLocalRecent(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentFile[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function listRecent(): Promise<RecentFile[]> {
  if (desktop) return desktop.recent.list()
  return readLocalRecent()
}

export async function clearRecent(): Promise<void> {
  if (desktop) {
    await desktop.recent.clear()
    return
  }
  localStorage.removeItem(RECENT_KEY)
}

export function fileFiltersFor(kind: 'image' | 'project' | 'json' | 'palette'): FileFilter[] {
  switch (kind) {
    case 'project':
      return [{ name: 'PixelRamp project', extensions: ['pxramp'] }]
    case 'json':
      return [{ name: 'Palette JSON', extensions: ['json'] }]
    case 'image':
      return [{ name: 'PNG image', extensions: ['png'] }]
    case 'palette':
    default:
      return [{ name: 'PNG palette strip', extensions: ['png'] }]
  }
}

export function suggestedFileName(base: string, extension: string): string {
  const trimmed = base.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ')
  return `${trimmed || 'untitled'}.${extension}`
}
