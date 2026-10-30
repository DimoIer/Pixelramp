import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import type {
  DesktopApi,
  FileFilter,
  FileKind,
  OpenedFile,
  Palette,
  RecentFile,
  SaveFileRequest
} from '@shared/types'

interface TauriOpenedFile {
  path: string
  name: string
  kind: string
  bytes: number[]
}

const IMAGE_FILTERS: FileFilter[] = [
  { name: '图片 / Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] }
]
const PROJECT_FILTERS: FileFilter[] = [
  { name: 'PixelRamp 工程', extensions: ['pxramp'] }
]
const JSON_FILTERS: FileFilter[] = [{ name: '调色卡 JSON', extensions: ['json'] }]

type OpenKind = 'image' | 'project' | 'any' | 'json' | 'paletteImage'

function kindForName(name: string): FileKind {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  if (extension === 'pxramp') return 'project'
  if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(extension)) return 'image'
  if (extension === 'json') return 'json'
  return 'unknown'
}

function filtersFor(kind: OpenKind): FileFilter[] {
  switch (kind) {
    case 'project':
      return PROJECT_FILTERS
    case 'json':
      return JSON_FILTERS
    case 'image':
    case 'paletteImage':
      return IMAGE_FILTERS
    case 'any':
    default:
      return [...IMAGE_FILTERS, ...PROJECT_FILTERS]
  }
}

function titleFor(kind: OpenKind): string {
  switch (kind) {
    case 'project':
      return '打开 PixelRamp 工程'
    case 'json':
      return '导入调色卡 JSON'
    case 'paletteImage':
      return '从图像导入调色卡'
    case 'image':
      return '打开图像'
    case 'any':
    default:
      return '打开图像或工程'
  }
}

function normalizeSelected(value: string | string[] | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function extensionOf(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  const index = base.lastIndexOf('.')
  return index > 0 ? base.slice(index + 1).toLowerCase() : ''
}

function ensureExtension(filePath: string, filters: FileFilter[]): string {
  if (extensionOf(filePath)) return filePath
  const extension = filters[0]?.extensions[0]
  return extension ? `${filePath}.${extension}` : filePath
}

async function readOpened(path: string): Promise<OpenedFile> {
  const opened = await invoke<TauriOpenedFile>('read_file', { path })
  return {
    path: opened.path,
    name: opened.name,
    kind: (opened.kind as FileKind) || kindForName(opened.name),
    bytes: Uint8Array.from(opened.bytes)
  }
}

async function rememberRecent(filePath: string, kind: FileKind): Promise<void> {
  if (kind !== 'image' && kind !== 'project') return
  try {
    await invoke('add_recent', { path: filePath, kind })
  } catch {
    // Recents are a convenience; failing to update them should not fail opening.
  }
}

export function createTauriDesktop(): DesktopApi {
  const win = getCurrentWindow()
  let allowClose = false

  return {
    platform: 'tauri',
    version: '0.2.2',
    window: {
      minimize: () => {
        void win.minimize()
      },
      toggleMaximize: () => {
        void win.toggleMaximize()
      },
      close: () => {
        void win.close()
      },
      forceClose: () => {
        allowClose = true
        void win.close()
      },
      isMaximized: () => win.isMaximized(),
      onMaximizedChange: (callback) => {
        let disposed = false
        let unlisten: (() => void) | undefined
        void win
          .onResized(async () => {
            if (disposed) return
            try {
              const maximized = await win.isMaximized()
              if (!disposed) callback(maximized)
            } catch {
              // Ignore transient resize races while the window is closing.
            }
          })
          .then((stop) => {
            if (disposed) stop()
            else unlisten = stop
          })
          .catch(() => undefined)
        return () => {
          disposed = true
          unlisten?.()
        }
      },
      onCloseRequested: (callback) => {
        let disposed = false
        let unlisten: (() => void) | undefined
        void win
          .onCloseRequested((event) => {
            if (allowClose) return
            event.preventDefault()
            callback()
          })
          .then((stop) => {
            if (disposed) stop()
            else unlisten = stop
          })
          .catch(() => undefined)
        return () => {
          disposed = true
          unlisten?.()
        }
      }
    },
    files: {
      open: async (kind) => {
        const selected = normalizeSelected(
          await openDialog({
            multiple: false,
            directory: false,
            title: titleFor(kind),
            filters: filtersFor(kind)
          })
        )
        if (!selected) return null
        const opened = await readOpened(selected)
        if (kind !== 'json' && kind !== 'paletteImage') {
          await rememberRecent(opened.path, opened.kind)
        }
        return opened
      },
      openPath: async (filePath) => {
        const opened = await readOpened(filePath)
        await rememberRecent(opened.path, opened.kind)
        return opened
      },
      save: async (request: SaveFileRequest) => {
        const filters =
          request.filters && request.filters.length > 0 ? request.filters : IMAGE_FILTERS
        let target = request.currentPath && !request.saveAs ? request.currentPath : null

        if (!target) {
          const selected = await saveDialog({
            title: request.title ?? '保存文件',
            defaultPath: request.currentPath ?? request.suggestedName,
            filters
          })
          if (!selected) return null
          target = selected
        }

        target = ensureExtension(target, filters)
        await invoke('write_file', { path: target, bytes: Array.from(request.bytes) })
        return target
      },
      reveal: (filePath) => {
        void invoke('reveal_path', { path: filePath }).catch(() => undefined)
      }
    },
    palettes: {
      list: () => invoke<Palette[]>('list_palettes'),
      save: (palette) => invoke<Palette[]>('save_palette', { palette }),
      remove: (id) => invoke<Palette[]>('remove_palette', { id })
    },
    recent: {
      list: () => invoke<RecentFile[]>('list_recent'),
      clear: async () => {
        await invoke('clear_recent')
      }
    }
  }
}
