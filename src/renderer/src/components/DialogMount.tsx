import { useUi } from '../store/ui'
import { AboutDialog } from './dialogs/AboutDialog'
import { ExportImageDialog } from './dialogs/ExportImageDialog'
import { ExportPaletteDialog } from './dialogs/ExportPaletteDialog'
import { ImageImportDialog } from './dialogs/ImageImportDialog'
import { NewCanvasDialog } from './dialogs/NewCanvasDialog'
import { ResizeCanvasDialog } from './dialogs/ResizeCanvasDialog'
import { AdjustmentDialog } from './dialogs/AdjustmentDialog'
import { CurvesDialog } from './dialogs/CurvesDialog'
import { ScaleTextureDialog } from './dialogs/ScaleTextureDialog'
import { PaletteLibraryDialog } from './dialogs/PaletteLibraryDialog'
import { ShortcutsDialog } from './dialogs/ShortcutsDialog'
import { ConfirmDialog } from './ui/ConfirmDialog'

export function DialogMount() {
  const dialog = useUi((state) => state.dialog)
  return (
    <>
      {dialog === 'new-canvas' ? <NewCanvasDialog /> : null}
      {dialog === 'resize-canvas' ? <ResizeCanvasDialog /> : null}
      {dialog === 'brightness-contrast' ? <AdjustmentDialog mode="brightness-contrast" /> : null}
      {dialog === 'hue-saturation' ? <AdjustmentDialog mode="hue-saturation" /> : null}
      {dialog === 'opacity' ? <AdjustmentDialog mode="opacity" /> : null}
      {dialog === 'curves' ? <CurvesDialog /> : null}
      {dialog === 'texture-scale' ? <ScaleTextureDialog /> : null}
      {dialog === 'image-import' ? <ImageImportDialog /> : null}
      {dialog === 'shortcuts' ? <ShortcutsDialog /> : null}
      {dialog === 'library' ? <PaletteLibraryDialog /> : null}
      {dialog === 'export-image' ? <ExportImageDialog /> : null}
      {dialog === 'export-palette' ? <ExportPaletteDialog /> : null}
      {dialog === 'about' ? <AboutDialog /> : null}
      <ConfirmDialog />
    </>
  )
}
