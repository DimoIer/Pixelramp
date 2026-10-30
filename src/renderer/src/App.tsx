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
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { onCloseRequested } from './platform'
import { requestWindowCloseCommand } from './commands'

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [layersOpen, setLayersOpen] = useState(true)
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
          <ToolRail />
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
          <PalettePanel open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </div>
        <StatusBar />
        <DialogMount />
        <Toasts />
        <BusyIndicator />
      </div>
    </TooltipProvider>
  )
}
