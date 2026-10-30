import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { PanelLeftClose, PanelLeftOpen, Rows3, Columns3, X } from 'lucide-react'
import { TooltipProvider } from './components/ui/Tooltip'
import { TitleBar } from './components/titlebar/TitleBar'
import { ToolRail } from './components/tools/ToolRail'
import { CanvasHeader } from './components/canvas/CanvasHeader'
import { DocumentTabs } from './components/canvas/DocumentTabs'
import { PixelCanvas } from './components/canvas/PixelCanvas'
import { StatusBar } from './components/canvas/StatusBar'
import { LayersPanel } from './components/layers/LayersPanel'
import { PalettePanel } from './components/palette/PalettePanel'
import { DialogMount } from './components/DialogMount'
import { Toasts } from './components/ui/Toasts'
import { BusyIndicator } from './components/ui/BusyIndicator'
import { useWorkbench } from './store/workbench'
import { useUi } from './store/ui'
import { usePreferences } from './store/preferences'
import { FloatingPanel } from './components/layout/FloatingPanel'
import { useT } from './i18n'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { onCloseRequested } from './platform'
import { requestWindowCloseCommand } from './commands'

export default function App() {
  const t = useT()
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [layersOpen, setLayersOpen] = useState(true)
  const [floatLayersOpen, setFloatLayersOpen] = useState(false)
  const [railWidth, setRailWidth] = useState(66)
  const [paletteWidth, setPaletteWidth] = useState(374)
  const [toolbarSpawn, setToolbarSpawn] = useState<{ x: number; y: number } | null>(null)
  const [dockHint, setDockHint] = useState<'toolbar' | 'palette' | null>(null)
  const [columnDrag, setColumnDrag] = useState<{
    side: 'rail' | 'palette'
    startX: number
    startWidth: number
  } | null>(null)
  const floatToolbar = usePreferences((state) => state.floatToolbar)
  const floatPalette = usePreferences((state) => state.floatPalette)
  const toolbarOpen = usePreferences((state) => state.toolbarOpen)
  const toolbarOrientation = usePreferences((state) => state.toolbarOrientation)
  const setFloatToolbar = usePreferences((state) => state.setFloatToolbar)
  const setFloatPalette = usePreferences((state) => state.setFloatPalette)
  const setToolbarOpen = usePreferences((state) => state.setToolbarOpen)
  const setToolbarOrientation = usePreferences((state) => state.setToolbarOrientation)
  const loadLibrary = useWorkbench((state) => state.loadLibrary)
  const refreshRecent = useUi((state) => state.refreshRecent)
  const docName = useWorkbench((state) => state.doc.name)
  useGlobalShortcuts()

  useEffect(() => {
    void loadLibrary()
    void refreshRecent()
  }, [loadLibrary, refreshRecent])

  useEffect(() => {
    return onCloseRequested(() => {
      void requestWindowCloseCommand()
    })
  }, [])

  useEffect(() => {
    document.title = `${docName} — PixelRamp`
  }, [docName])

  const beginColumnDrag = (
    side: 'rail' | 'palette',
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setColumnDrag({
      side,
      startX: event.clientX,
      startWidth: side === 'rail' ? railWidth : paletteWidth
    })
  }

  const moveColumnDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!columnDrag) return
    const delta = event.clientX - columnDrag.startX
    if (columnDrag.side === 'rail') {
      setRailWidth(Math.max(52, Math.min(140, columnDrag.startWidth + delta)))
    } else {
      setPaletteWidth(Math.max(290, Math.min(560, columnDrag.startWidth - delta)))
    }
  }

  const endColumnDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    setColumnDrag(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  useEffect(() => {
    const preventWindowDrop = (event: DragEvent): void => {
      if (!(event.target as HTMLElement)?.closest('.canvas-stage')) event.preventDefault()
    }
    window.addEventListener('dragover', preventWindowDrop)
    window.addEventListener('drop', preventWindowDrop)
    return () => {
      window.removeEventListener('dragover', preventWindowDrop)
      window.removeEventListener('drop', preventWindowDrop)
    }
  }, [])

  return (
    <TooltipProvider delayDuration={320} skipDelayDuration={180}>
      <div className={toolbarOpen ? 'app-shell' : 'app-shell is-toolbar-collapsed'}>
        <TitleBar paletteOpen={paletteOpen} onTogglePalette={() => setPaletteOpen((open) => !open)} />
        <div
          className="app-body"
          style={
            {
              '--rail-width': `${railWidth}px`,
              '--right-panel-width': `${paletteWidth}px`
            } as CSSProperties
          }
        >
          {!floatToolbar && toolbarOpen ? (
            <ToolRail
              onCollapse={() => setToolbarOpen(false)}
              onFloat={(point) => {
                setToolbarOpen(true)
                setToolbarSpawn(point ?? null)
                setFloatToolbar(true)
              }}
            />
          ) : null}
          {!floatToolbar && toolbarOpen ? (
            <div
              className="column-resizer column-resizer--rail"
              onPointerDown={(event) => beginColumnDrag('rail', event)}
              onPointerMove={moveColumnDrag}
              onPointerUp={endColumnDrag}
              onPointerCancel={endColumnDrag}
              aria-hidden
            />
          ) : null}
          {dockHint === 'toolbar' ? (
            <div className="dock-slot dock-slot--left" style={{ width: railWidth }}>
              <div className="dock-placeholder dock-placeholder--toolbar" aria-hidden>
                <span className="dock-placeholder__title">{t('工具栏')}</span>
                <span className="dock-placeholder__hint">{t('松开以停靠')}</span>
              </div>
            </div>
          ) : null}
          <main className="workspace">
            <CanvasHeader
              paletteOpen={paletteOpen}
              onTogglePalette={() => setPaletteOpen((open) => !open)}
              layersOpen={layersOpen}
              onToggleLayers={() => setLayersOpen((open) => !open)}
              floatLayersOpen={floatLayersOpen}
              onToggleFloatLayers={() => setFloatLayersOpen((open) => !open)}
            />
            <DocumentTabs />
            <div className="workspace__canvas">
              <PixelCanvas />
              <LayersPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
            </div>
          </main>
          {!floatPalette && paletteOpen ? (
            <div
              className="column-resizer column-resizer--palette"
              onPointerDown={(event) => beginColumnDrag('palette', event)}
              onPointerMove={moveColumnDrag}
              onPointerUp={endColumnDrag}
              onPointerCancel={endColumnDrag}
              aria-hidden
            />
          ) : null}
          {!floatPalette && paletteOpen ? (
            <PalettePanel
              open={paletteOpen}
              onClose={() => setPaletteOpen(false)}
              onFloat={() => {
                setPaletteOpen(true)
                setFloatPalette(true)
              }}
            />
          ) : null}
          {dockHint === 'palette' ? (
            <div className="dock-slot dock-slot--right" style={{ width: paletteWidth }}>
              <div className="dock-placeholder dock-placeholder--palette" aria-hidden>
                <span className="dock-placeholder__title">{t('调色卡工作台')}</span>
                <span className="dock-placeholder__hint">{t('松开以停靠')}</span>
              </div>
            </div>
          ) : null}
        </div>
        {floatLayersOpen ? (
          <FloatingPanel
            id="layers-float"
            title={t('图层')}
            initial={{
              x: 14,
              y: Math.max(120, window.innerHeight - 500),
              width: 286,
              height: 440
            }}
            minWidth={240}
            minHeight={300}
            hideDock
            onDock={() => setFloatLayersOpen(false)}
            actions={
              <button
                type="button"
                className="floating-panel__action"
                aria-label={t('关闭浮动图层面板')}
                title={t('关闭浮动图层面板')}
                onClick={() => setFloatLayersOpen(false)}
              >
                <X size={13} />
              </button>
            }
          >
            <LayersPanel floating open onClose={() => setFloatLayersOpen(false)} />
          </FloatingPanel>
        ) : null}
        {!toolbarOpen ? (
          <button
            type="button"
            className="toolbar-reopen"
            aria-label={t('显示工具栏')}
            title={t('显示工具栏')}
            onClick={() => setToolbarOpen(true)}
          >
            <PanelLeftOpen size={15} />
          </button>
        ) : null}
        {floatToolbar && toolbarOpen ? (
          <FloatingPanel
            key={`toolbar-${toolbarOrientation}`}
            id={`toolbar-${toolbarOrientation}`}
            title={t('工具栏')}
            initial={
              toolbarSpawn
                ? {
                    x: toolbarSpawn.x - 34,
                    y: toolbarSpawn.y - 18,
                    width: toolbarOrientation === 'horizontal' ? 560 : 158,
                    height: toolbarOrientation === 'horizontal' ? 96 : 660
                  }
                : toolbarOrientation === 'horizontal'
                  ? { x: 110, y: 88, width: 560, height: 96 }
                  : { x: 82, y: 88, width: 158, height: 660 }
            }
            initialOnly={!!toolbarSpawn}
            minWidth={toolbarOrientation === 'horizontal' ? 280 : 148}
            minHeight={toolbarOrientation === 'horizontal' ? 68 : 320}
            onDock={() => {
              setFloatToolbar(false)
              setToolbarSpawn(null)
            }}
            shouldDock={(_rect, clientX) => clientX < 100}
            onDragStart={() => setDockHint(null)}
            onDragMove={(clientX) => setDockHint(clientX < 115 ? 'toolbar' : null)}
            onDragEnd={() => setDockHint(null)}
            actions={
              <>
                <button
                  type="button"
                  className="floating-panel__action"
                  aria-label={t('收起工具栏')}
                  title={t('收起工具栏')}
                  onClick={() => setToolbarOpen(false)}
                >
                  <PanelLeftClose size={13} />
                </button>
                <button
                  type="button"
                  className="floating-panel__action"
                  aria-label={toolbarOrientation === 'horizontal' ? t('纵向排列') : t('横向排列')}
                  title={toolbarOrientation === 'horizontal' ? t('纵向排列') : t('横向排列')}
                  onClick={() =>
                    setToolbarOrientation(
                      toolbarOrientation === 'horizontal' ? 'vertical' : 'horizontal'
                    )
                  }
                >
                  {toolbarOrientation === 'horizontal' ? (
                    <Columns3 size={13} />
                  ) : (
                    <Rows3 size={13} />
                  )}
                </button>
              </>
            }
          >
            <ToolRail
              floating
              horizontal={toolbarOrientation === 'horizontal'}
            />
          </FloatingPanel>
        ) : null}
        {floatPalette && paletteOpen ? (
          <FloatingPanel
            id="palette"
            title={t('调色卡工作台')}
            initial={{
              x: Math.max(24, window.innerWidth - 430),
              y: 88,
              width: 390,
              height: 700
            }}
            minWidth={310}
            minHeight={380}
            onDock={() => {
              setFloatPalette(false)
              setPaletteOpen(true)
            }}
            shouldDock={(_rect, clientX) => clientX > window.innerWidth - 440}
            onDragStart={() => setDockHint(null)}
            onDragMove={(clientX) =>
              setDockHint(clientX > window.innerWidth - 460 ? 'palette' : null)
            }
            onDragEnd={() => setDockHint(null)}
          >
            <PalettePanel
              open
              floating
              onFloat={() => setFloatPalette(false)}
              onClose={() => setPaletteOpen(false)}
            />
          </FloatingPanel>
        ) : null}
        <StatusBar />
        <DialogMount />
        <Toasts />
        <BusyIndicator />
      </div>
    </TooltipProvider>
  )
}
