import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, Palette, SaveFileRequest } from '../shared/types'

const versionArgument = process.argv.find((argument) => argument.startsWith('--pixelramp-version='))
const version = versionArgument ? versionArgument.split('=')[1] : ''

const api: DesktopApi = {
  platform: 'electron',
  version,
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    forceClose: () => ipcRenderer.send('window:force-close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    onMaximizedChange: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('window:maximized', listener)
      return () => ipcRenderer.removeListener('window:maximized', listener)
    },
    onCloseRequested: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on('window:close-requested', listener)
      return () => ipcRenderer.removeListener('window:close-requested', listener)
    }
  },
  files: {
    open: (kind) => ipcRenderer.invoke('files:open', kind),
    openPath: (filePath) => ipcRenderer.invoke('files:open-path', filePath),
    save: (request: SaveFileRequest) => ipcRenderer.invoke('files:save', request) as Promise<string | null>,
    reveal: (filePath) => ipcRenderer.send('files:reveal', filePath)
  },
  palettes: {
    list: () => ipcRenderer.invoke('palettes:list') as Promise<Palette[]>,
    save: (palette: Palette) => ipcRenderer.invoke('palettes:save', palette) as Promise<Palette[]>,
    remove: (id: string) => ipcRenderer.invoke('palettes:remove', id) as Promise<Palette[]>
  },
  recent: {
    list: () => ipcRenderer.invoke('recent:list'),
    clear: () => ipcRenderer.invoke('recent:clear') as Promise<void>
  }
}

contextBridge.exposeInMainWorld('pixelramp', api)
