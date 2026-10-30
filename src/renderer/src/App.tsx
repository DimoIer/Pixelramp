import { useEffect, useState } from 'react'
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
  const floatToolbar = usePreferences((state) => state.floatToolbar)
  const floatPalette = usePreferences((state) => state.floatPalette)
  const setFloatToolbar = usePreferences((state) => state.setFloatToolbar)
  const setFloatPalette = usePreferences((state) => state.setFloatPalette)
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
      <div className="app-shell">
        <TitleBar paletteOpen={paletteOpen} onTogglePalette={() => setPaletteOpen((open) => !open)} />
        <div className="app-body">
          {!floatToolbar ? <ToolRail /> : null}
          <main className="workspace">
            <CanvasHeader
              paletteOpen={paletteOpen}
              onTogglePalette={() => setPaletteOpen((open) => !open)}
              layersOpen={layersOpen}
              onToggleLayers={() => setLayersOpen((open) => !open)}
            />
            <DocumentTabs />
            <div className="workspace__canvas">
              <PixelCanvas />
              <LayersPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
            </div>
          </main>
          {!floatPalette && paletteOpen ? (
            <PalettePanel open={paletteOpen} onClose={() => setPaletteOpen(false)} />
          ) : null}
        </div>
        {floatToolbar ? (
          <FloatingPanel
            id="toolbar"
            title={t('工具栏')}
            initial={{ x: 82, y: 88, width: 72, height: 660 }}
            minWidth={66}
            minHeight={320}
            onDock={() => setFloatToolbar(false)}
          >
            <ToolRail />
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
          >
            <PalettePanel open onClose={() => setPaletteOpen(false)} />
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
