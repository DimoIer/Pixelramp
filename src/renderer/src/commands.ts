import type { OpenedFile, Palette, RecentFile } from '@shared/types'
import {
  clearRegion,
  clonePixels,
  extractRegion,
  flattenLayers,
  normalizeRect,
  prepareImportedPixels,
  toRgbaBytes,
  type Rect
} from './core/pixels'
import { DEFAULT_EXTRACT_OPTIONS, normalizePalette, paletteToExportJson } from './core/palette'
import {
  decodeImageBytes,
  paletteStripPngBytes,
  pixelsToPngBytes,
  type PaletteStripOptions
} from './core/image'
import { buildProjectBytes, parseProjectBytes } from './core/project'
import * as platform from './platform'
import { paletteWorker } from './workers/paletteClient'
import { normalizeSelection, useWorkbench, type ExtractSummary } from './store/workbench'
import { useUi } from './store/ui'
import { tr } from './i18n'

function baseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1)
}

export function stripExtension(name: string): string {
  const base = baseName(name)
  const index = base.lastIndexOf('.')
  return index > 0 ? base.slice(0, index) : base
}

function reportError(error: unknown, fallback: string): void {
  const detail = error instanceof Error ? error.message : String(error)
  useUi.getState().toast(fallback, 'error', detail && detail !== fallback ? detail : undefined)
}

async function withBusy<T>(label: string, task: () => Promise<T>): Promise<T> {
  const ui = useUi.getState()
  ui.setBusy(label)
  try {
    return await task()
  } finally {
    if (useUi.getState().busy === label) useUi.getState().setBusy(null)
  }
}

export async function ensureCanDiscard(): Promise<boolean> {
  const { doc } = useWorkbench.getState()
  if (!doc.dirty) return true
  return useUi.getState().askConfirm({
    title: '放弃当前画布？',
    description: '当前画布有尚未保存的像素修改。继续操作会丢弃这些修改，调色卡不受影响。',
    confirmLabel: '放弃并继续',
    cancelLabel: '返回画布',
    tone: 'danger'
  })
}

export async function closeDocumentTabCommand(id: string): Promise<void> {
  const state = useWorkbench.getState()
  const tab = state.tabs.find((entry) => entry.id === id)
  if (!tab) return
  const dirty = id === state.activeTabId ? state.doc.dirty : tab.doc.dirty
  if (dirty) {
    const confirmed = await useUi.getState().askConfirm({
      title: tr('关闭「{name}」？', { name: tab.doc.name }),
      description: tr('这个标签页有尚未保存的像素修改。关闭会丢失这些修改。'),
      confirmLabel: tr('放弃并关闭'),
      cancelLabel: tr('返回标签页'),
      tone: 'danger'
    })
    if (!confirmed) return
  }
  useWorkbench.getState().closeTab(id)
}

export async function createNewCanvasCommand(width: number, height: number): Promise<boolean> {
  useWorkbench.getState().newDocumentTab(width, height)
  useUi.getState().closeDialog()
  useUi.getState().toast(tr('已新建 {width} × {height} 画布', { width, height }), 'success')
  return true
}

export function openNewCanvasDialog(): void {
  useUi.getState().openDialog('new-canvas')
}
interface LoadOptions {
  askDiscard?: boolean
}

export async function loadOpenedFile(
  opened: OpenedFile,
  _options: LoadOptions = {}
): Promise<void> {
  if (opened.kind === 'project') {
    let project: ReturnType<typeof parseProjectBytes>
    try {
      project = parseProjectBytes(opened.bytes)
    } catch (error) {
      reportError(error, '无法打开该工程')
      return
    }
    const palette = project.manifest.palette
    useWorkbench.getState().loadDocumentTab({
      pixels: project.pixels,
      width: project.width,
      height: project.height,
      name: project.manifest.name,
      kind: 'project',
      sourcePath: opened.path,
      projectPath: opened.path,
      layers: project.layers,
      activeLayer: project.activeLayer,
      ...(palette ? { palette } : {})
    })
    useUi.getState().toast('工程已打开', 'success', `${project.width} × ${project.height}`)
    return
  }

  if (opened.kind === 'image') {
    let decoded: Awaited<ReturnType<typeof decodeImageBytes>>
    try {
      decoded = await withBusy('正在解码图像…', () => decodeImageBytes(opened.bytes, opened.name))
    } catch (error) {
      reportError(error, '无法解码这张图像')
      return
    }
    if (decoded.width === decoded.height && decoded.width <= 256) {
      useWorkbench.getState().loadDocumentTab({
        pixels: decoded.pixels,
        width: decoded.width,
        height: decoded.height,
        name: stripExtension(opened.name),
        kind: 'image',
        sourcePath: opened.path,
        projectPath: null
      })
      useUi.getState().toast('图像已打开', 'success', `${decoded.width} × ${decoded.height}`)
      return
    }
    useUi.getState().setPendingImage({
      path: opened.path,
      name: opened.name,
      width: decoded.width,
      height: decoded.height,
      pixels: decoded.pixels
    })
    useUi.getState().openDialog('image-import')
    return
  }

  if (opened.kind === 'json') {
    await importPaletteJsonCommand()
    return
  }
  useUi.getState().toast('不支持的文件类型', 'error')
}

export async function openFileCommand(): Promise<void> {
  try {
    const opened = await platform.openFile('any')
    if (!opened) return
    await loadOpenedFile(opened)
  } catch (error) {
    reportError(error, '打开文件失败')
  }
}

export async function openRecentCommand(entry: RecentFile): Promise<void> {
  try {
    const opened = await platform.openPath(entry.path)
    if (!opened) {
      useUi.getState().toast('文件已移动或不存在', 'error', entry.path)
      await useUi.getState().refreshRecent()
      return
    }
    await loadOpenedFile(opened)
  } catch (error) {
    reportError(error, '打开最近文件失败')
  }
}

export async function confirmPendingImage(
  mode: 'crop' | 'scale',
  size: number
): Promise<boolean> {
  const pending = useUi.getState().pendingImage
  if (!pending) return false
  const pixels = prepareImportedPixels(pending.pixels, pending.width, pending.height, size, mode)
  useWorkbench.getState().loadDocumentTab({
    pixels,
    width: size,
    height: size,
    name: stripExtension(pending.name),
    kind: 'image',
    sourcePath: pending.path,
    projectPath: null
  })
  useUi.getState().setPendingImage(null)
  useUi.getState().closeDialog()
  useUi.getState().toast(
    '图像已载入',
    'success',
    `${pending.width} × ${pending.height} → ${size} × ${size}`
  )
  return true
}

export async function saveProjectCommand(saveAs = false): Promise<boolean> {
  const state = useWorkbench.getState()
  if (state.transaction) {
    useUi.getState().toast('请先结束当前绘制', 'info')
    return false
  }
  try {
    const pixels = flattenLayers(state.doc.layers, state.doc.width, state.doc.height)
    const bytes = buildProjectBytes({
      width: state.doc.width,
      height: state.doc.height,
      name: state.doc.name,
      pixels,
      layers: state.doc.layers,
      activeLayer: state.doc.activeLayer,
      palette: state.activePalette
    })
    const filePath = await withBusy('正在保存工程…', () =>
      platform.saveFile({
        bytes,
        suggestedName: platform.suggestedFileName(state.doc.name, 'pxramp'),
        title: '保存 PixelRamp 工程',
        filters: platform.fileFiltersFor('project'),
        currentPath: saveAs ? null : state.doc.projectPath,
        saveAs
      })
    )
    if (!filePath) return false
    useWorkbench.getState().markSaved(filePath, stripExtension(filePath))
    useUi.getState().toast('工程已保存', 'success', baseName(filePath))
    return true
  } catch (error) {
    reportError(error, '保存工程失败')
    return false
  }
}

export async function exportPngCommand(scale = 1): Promise<void> {
  const state = useWorkbench.getState()
  try {
    const pixels = flattenLayers(state.doc.layers, state.doc.width, state.doc.height)
    const bytes = await withBusy('正在编码 PNG…', () =>
      pixelsToPngBytes(pixels, state.doc.width, state.doc.height, scale)
    )
    const suffix = scale > 1 ? `@${scale}x` : ''
    const filePath = await platform.saveFile({
      bytes,
      suggestedName: platform.suggestedFileName(`${state.doc.name}${suffix}`, 'png'),
      title: '导出 PNG',
      filters: platform.fileFiltersFor('image')
    })
    if (!filePath) return
    useUi.getState().toast(
      'PNG 已导出',
      'success',
      `${baseName(filePath)} · ${state.doc.width * scale} × ${state.doc.height * scale}`
    )
  } catch (error) {
    reportError(error, '导出 PNG 失败')
  }
}

export async function savePaletteJsonCommand(palette: Palette): Promise<boolean> {
  try {
    const bytes = new TextEncoder().encode(paletteToExportJson(palette))
    const filePath = await platform.saveFile({
      bytes,
      suggestedName: platform.suggestedFileName(palette.name, 'json'),
      title: '导出调色卡 JSON',
      filters: platform.fileFiltersFor('json')
    })
    if (!filePath) return false
    useUi.getState().toast('调色卡 JSON 已导出', 'success', baseName(filePath))
    return true
  } catch (error) {
    reportError(error, '导出 JSON 失败')
    return false
  }
}

export async function savePalettePngCommand(
  palette: Palette,
  options: PaletteStripOptions
): Promise<boolean> {
  try {
    const bytes = await withBusy('正在生成色卡条…', () => paletteStripPngBytes(palette, options))
    const filePath = await platform.saveFile({
      bytes,
      suggestedName: platform.suggestedFileName(palette.name, 'png'),
      title: '导出 PNG 色卡条',
      filters: platform.fileFiltersFor('palette')
    })
    if (!filePath) return false
    useUi.getState().toast('PNG 色卡条已导出', 'success', baseName(filePath))
    return true
  } catch (error) {
    reportError(error, '导出 PNG 失败')
    return false
  }
}

export async function saveActivePaletteCommand(quiet = false): Promise<Palette | null> {
  try {
    const palette = await useWorkbench.getState().saveActivePalette()
    if (!quiet) useUi.getState().toast('调色卡已保存到库', 'success', palette.name)
    return palette
  } catch (error) {
    reportError(error, '保存调色卡失败')
    return null
  }
}

export function loadPaletteFromLibraryCommand(id: string): void {
  const palette = useWorkbench.getState().library.find((entry) => entry.id === id)
  if (!palette) {
    useUi.getState().toast('没有找到这张调色卡', 'error')
    return
  }
  useWorkbench.getState().openPalette(palette)
  useUi.getState().closeDialog()
  useUi.getState().toast('调色卡已载入', 'success', palette.name)
}

export async function duplicatePaletteCommand(id: string): Promise<void> {
  try {
    const copy = await useWorkbench.getState().duplicateLibraryPalette(id)
    useUi.getState().toast('调色卡已复制', 'success', copy.name)
  } catch (error) {
    reportError(error, '复制调色卡失败')
  }
}

export async function deletePaletteCommand(id: string): Promise<void> {
  const confirmed = await useUi.getState().askConfirm({
    title: '删除这张调色卡？',
    description: '这会将它从本地调色卡库中移除。当前画布上的工作副本不会被删除。',
    confirmLabel: '删除',
    tone: 'danger'
  })
  if (!confirmed) return
  try {
    await useWorkbench.getState().deleteLibraryPalette(id)
    useUi.getState().toast('调色卡已从库中删除', 'success')
  } catch (error) {
    reportError(error, '删除调色卡失败')
  }
}

export async function importPaletteJsonCommand(): Promise<void> {
  try {
    const opened = await platform.openFile('json')
    if (!opened) return
    let parsed: unknown
    try {
      parsed = JSON.parse(new TextDecoder().decode(opened.bytes))
    } catch {
      throw new Error('文件不是合法 JSON')
    }
    const palette = normalizePalette(parsed, stripExtension(opened.name))
    if (!palette) throw new Error('没有在该文件中找到调色卡颜色')
    useWorkbench.getState().importPalette(palette)
    const saved = await saveActivePaletteCommand(true)
    if (saved) useUi.getState().toast('调色卡已导入并保存', 'success', palette.name)
  } catch (error) {
    reportError(error, '导入调色卡 JSON 失败')
  }
}

export async function importPalettePngCommand(): Promise<void> {
  try {
    const opened = await platform.openFile('paletteImage')
    if (!opened) return
    const decoded = await withBusy('正在读取色卡图像…', () =>
      decodeImageBytes(opened.bytes, opened.name)
    )
    const imported = await withBusy<Palette | null>('正在去重颜色…', async () => {
      const result = await paletteWorker.extract(toRgbaBytes(decoded.pixels), {
        ...DEFAULT_EXTRACT_OPTIONS
      })
      if (result.colors.length === 0) throw new Error('图像中没有可见像素')
      return useWorkbench
        .getState()
        .adoptExtraction(result, stripExtension(opened.name), { ...DEFAULT_EXTRACT_OPTIONS })
    })
    if (!imported) return
    const saved = await saveActivePaletteCommand(true)
    if (saved) useUi.getState().toast('调色卡已从图像导入', 'success', imported.name)
  } catch (error) {
    reportError(error, '从图像导入调色卡失败')
  }
}

export async function extractColorsCommand(): Promise<ExtractSummary | null> {
  try {
    const summary = await useWorkbench.getState().extractFromCanvas()
    const mergeNote = summary.result.mergeApplied
      ? ` · 合并 ${summary.result.uniqueCount} → ${summary.result.mergedCount}`
      : ''
    useUi.getState().toast(
      `提取了 ${summary.result.colors.length} 种颜色`,
      'success',
      `${summary.result.totalPixels} 像素${mergeNote}`
    )
    return summary
  } catch (error) {
    reportError(error, '提取颜色失败')
    return null
  }
}

function clipboardSource(): { rect: Rect; pixels: Uint32Array } {
  const state = useWorkbench.getState()
  const rect = state.selection ?? {
    x: 0,
    y: 0,
    w: state.doc.width,
    h: state.doc.height
  }
  const normalized = normalizeRect(rect)
  const composite = flattenLayers(state.doc.layers, state.doc.width, state.doc.height)
  return {
    rect: normalized,
    pixels: extractRegion(composite, state.doc.width, state.doc.height, normalized)
  }
}

export function copySelectionCommand(): void {
  const { rect, pixels } = clipboardSource()
  useWorkbench.getState().setClipboard({ width: rect.w, height: rect.h, pixels })
  useUi.getState().toast('已复制', 'success', `${rect.w} × ${rect.h}`)
}

export function cutSelectionCommand(): void {
  const state = useWorkbench.getState()
  if (!state.selection) {
    useUi.getState().toast('请先框选区域', 'info')
    return
  }
  const { rect, pixels: copied } = clipboardSource()
  state.setClipboard({ width: rect.w, height: rect.h, pixels: copied })
  const layer = state.doc.layers[state.doc.activeLayer]
  const pixels = clonePixels(layer.pixels)
  clearRegion(pixels, state.doc.width, state.doc.height, rect)
  state.beginTransaction('剪切选区')
  state.setDraftPixels(pixels)
  state.commitTransaction()
  useUi.getState().toast('已剪切', 'success', `${rect.w} × ${rect.h}`)
}

export function deleteSelectionCommand(): void {
  const state = useWorkbench.getState()
  if (!state.selection) {
    useUi.getState().toast('请先框选区域', 'info')
    return
  }
  const selection = state.selection
  const layer = state.doc.layers[state.doc.activeLayer]
  const pixels = clonePixels(layer.pixels)
  clearRegion(pixels, state.doc.width, state.doc.height, selection)
  state.beginTransaction('删除选区')
  state.setDraftPixels(pixels)
  state.commitTransaction()
}

export function pasteCommand(): void {
  const state = useWorkbench.getState()
  if (!state.clipboard) {
    useUi.getState().toast('剪贴板为空', 'info')
    return
  }
  const clipboard = state.clipboard
  const x = state.selection ? state.selection.x : Math.floor((state.doc.width - clipboard.width) / 2)
  const y = state.selection ? state.selection.y : Math.floor((state.doc.height - clipboard.height) / 2)
  const layer = state.doc.layers[state.doc.activeLayer]
  const pixels = clonePixels(layer.pixels)
  for (let sy = 0; sy < clipboard.height; sy += 1) {
    for (let sx = 0; sx < clipboard.width; sx += 1) {
      const value = clipboard.pixels[sy * clipboard.width + sx]
      if ((value >>> 24) === 0) continue
      const tx = x + sx
      const ty = y + sy
      if (tx < 0 || ty < 0 || tx >= state.doc.width || ty >= state.doc.height) continue
      pixels[ty * state.doc.width + tx] = value
    }
  }
  const selection = normalizeSelection(
    { x, y, w: clipboard.width, h: clipboard.height },
    state.doc.width,
    state.doc.height
  )
  state.beginTransaction('粘贴')
  state.setDraftPixels(pixels, selection)
  state.commitTransaction()
  useUi.getState().toast('已粘贴', 'success', `${clipboard.width} × ${clipboard.height}`)
}

export function selectAllCommand(): void {
  const state = useWorkbench.getState()
  state.setSelection({ x: 0, y: 0, w: state.doc.width, h: state.doc.height })
}

export function deselectCommand(): void {
  useWorkbench.getState().setSelection(null)
}

let closeRequestPending = false

export async function requestWindowCloseCommand(): Promise<void> {
  if (closeRequestPending) return
  closeRequestPending = true
  try {
    const state = useWorkbench.getState()
    const inactiveDirty = state.tabs.filter(
      (tab) => tab.id !== state.activeTabId && tab.doc.dirty
    ).length
    const dirtyCount = (state.doc.dirty ? 1 : 0) + inactiveDirty
    if (dirtyCount > 0) {
      const confirmed = await useUi.getState().askConfirm({
        title: tr('退出 PixelRamp？'),
        description:
          dirtyCount === 1
            ? tr('当前有 1 个标签页包含尚未保存的像素修改。退出会丢失这些修改。')
            : tr('当前有 {count} 个标签页包含尚未保存的像素修改。退出会丢失这些修改。', {
                count: dirtyCount
              }),
        confirmLabel: tr('放弃并退出'),
        cancelLabel: tr('继续编辑'),
        tone: 'danger'
      })
      if (!confirmed) return
    }
    platform.windowControls.forceClose()
  } finally {
    closeRequestPending = false
  }
}

export function applyForegroundFromPalette(index: number): void {
  const state = useWorkbench.getState()
  const color = state.activePalette?.colors[index]
  if (!color) return
  state.setSelectedColorIndex(index)
  state.setForeground(color.rgba)
}
