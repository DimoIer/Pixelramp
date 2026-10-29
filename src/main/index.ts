import { existsSync } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron'
import { PaletteStore } from './palettes'
import { RecentStore } from './recent'
import { FileBridge } from './files'
import type { Palette, SaveFileRequest } from '../shared/types'

app.setName('PixelRamp')
if (process.env.PIXELRAMP_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.PIXELRAMP_USER_DATA))
}

let mainWindow: BrowserWindow | null = null
let paletteStore: PaletteStore
let recentStore: RecentStore
let files: FileBridge
let allowClose = false

function createWindow(): void {
  const iconPath = path.join(__dirname, '../../build/icon.ico')
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const width = Math.max(860, Math.min(1480, Math.floor(workArea.width * 0.94)))
  const height = Math.max(620, Math.min(940, Math.floor(workArea.height * 0.94)))
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(1040, width),
    minHeight: Math.min(650, height),
    center: true,
    show: false,
    frame: false,
    title: 'PixelRamp',
    backgroundColor: '#0f100d',
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      additionalArguments: [`--pixelramp-version=${app.getVersion()}`]
    }
  })

  Menu.setApplicationMenu(null)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))
  mainWindow.on('close', (event) => {
    if (!allowClose && mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault()
      mainWindow.webContents.send('window:close-requested')
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      if (!app.isPackaged) {
        mainWindow?.webContents.toggleDevTools()
        event.preventDefault()
      }
    }
  })

  const developmentUrl = process.env['ELECTRON_RENDERER_URL']
  if (developmentUrl) {
    void mainWindow.loadURL(developmentUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function windowFor(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function registerIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())
  ipcMain.on('window:force-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    allowClose = true
    window.close()
  })
  ipcMain.handle('window:is-maximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  ipcMain.handle('files:open', (_event, kind: 'image' | 'project' | 'any' | 'json' | 'paletteImage') => {
    return files.open(mainWindow, kind)
  })
  ipcMain.handle('files:open-path', (_event, filePath: string) => files.openPath(filePath))
  ipcMain.handle('files:save', (_event, request: SaveFileRequest) => {
    return files.save(windowFor(_event), request)
  })
  ipcMain.handle('files:reveal', (_event, filePath: string) => {
    files.reveal(filePath)
  })

  ipcMain.handle('palettes:list', () => paletteStore.list())
  ipcMain.handle('palettes:save', (_event, palette: Palette) => paletteStore.save(palette))
  ipcMain.handle('palettes:remove', (_event, id: string) => paletteStore.remove(id))

  ipcMain.handle('recent:list', () => recentStore.list())
  ipcMain.handle('recent:clear', () => recentStore.clear())
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('studio.pixelramp.app')
    paletteStore = new PaletteStore(app.getPath('userData'))
    recentStore = new RecentStore(app.getPath('userData'))
    files = new FileBridge(recentStore)
    await paletteStore.init()
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
