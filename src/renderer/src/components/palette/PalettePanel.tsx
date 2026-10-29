import { FolderOpen, PanelRightClose } from 'lucide-react'
import clsx from 'clsx'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Tooltip } from '../ui/Tooltip'
import { GeneratorPanel } from './GeneratorPanel'
import { ActivePalettePanel } from './ActivePalettePanel'

interface PalettePanelProps {
  open: boolean
  onClose: () => void
}

export function PalettePanel({ open, onClose }: PalettePanelProps) {
  const library = useWorkbench((state) => state.library)
  const activePalette = useWorkbench((state) => state.activePalette)
  const openDialog = useUi((state) => state.openDialog)

  return (
    <aside className={clsx('palette-panel', !open && 'is-collapsed')} aria-label="调色卡工作区">
      <header className="palette-panel__header">
        <div className="palette-panel__brand">
          <span className="palette-panel__spine" aria-hidden>
            <span style={{ background: activePalette?.colors[0] ? `rgb(${activePalette.colors[0].rgba.r},${activePalette.colors[0].rgba.g},${activePalette.colors[0].rgba.b})` : '#343a2c' }} />
            <span style={{ background: activePalette?.colors[1] ? `rgb(${activePalette.colors[1].rgba.r},${activePalette.colors[1].rgba.g},${activePalette.colors[1].rgba.b})` : '#59654a' }} />
            <span style={{ background: activePalette?.colors[Math.floor((activePalette?.colors.length ?? 1) / 2)] ? `rgb(${activePalette.colors[Math.floor(activePalette.colors.length / 2)].rgba.r},${activePalette.colors[Math.floor(activePalette.colors.length / 2)].rgba.g},${activePalette.colors[Math.floor(activePalette.colors.length / 2)].rgba.b})` : '#9ca372' }} />
            <span style={{ background: activePalette?.colors[activePalette.colors.length - 1] ? `rgb(${activePalette.colors[activePalette.colors.length - 1].rgba.r},${activePalette.colors[activePalette.colors.length - 1].rgba.g},${activePalette.colors[activePalette.colors.length - 1].rgba.b})` : '#d8c79b' }} />
          </span>
          <div>
            <div className="eyebrow">COLOR WORKBENCH</div>
            <h1 className="palette-panel__title">调色卡工作台</h1>
          </div>
        </div>
        <div className="palette-panel__actions">
          <Tooltip content="打开调色卡库" side="bottom">
            <button type="button" className="library-button" onClick={() => openDialog('library')}>
              <FolderOpen size={13} />
              <span>库</span>
              <span className="library-button__count mono">{library.length}</span>
            </button>
          </Tooltip>
          <Tooltip content="收起面板" side="bottom">
            <button type="button" className="panel-collapse" aria-label="收起调色卡面板" onClick={onClose}>
              <PanelRightClose size={15} />
            </button>
          </Tooltip>
        </div>
      </header>
      <div className="palette-panel__scroll">
        <GeneratorPanel />
        <ActivePalettePanel />
      </div>
    </aside>
  )
}
