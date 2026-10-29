import { Focus, Minus, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { rgbaToHex } from '../../core/color'
import { useWorkbench } from '../../store/workbench'
import { ColorSwatch } from '../ui/ColorSwatch'
import { Tooltip } from '../ui/Tooltip'
import { TOOL_BY_ID } from '../tools/tools'

export function StatusBar() {
  const {
    cursor,
    foreground,
    doc,
    zoom,
    selection,
    tool,
    fitView,
    zoomStep
  } = useWorkbench(
    useShallow((state) => ({
      cursor: state.cursor,
      foreground: state.foreground,
      doc: state.doc,
      zoom: state.zoom,
      selection: state.selection,
      tool: state.tool,
      fitView: state.fitView,
      zoomStep: state.zoomStep
    }))
  )
  const definition = TOOL_BY_ID[tool]
  const hex = rgbaToHex(foreground, true)

  return (
    <footer className="statusbar">
      <div className="statusbar__left">
        <span className="status-item status-item--coords mono">
          <span className="status-key">X</span>
          <span className="status-val">{cursor ? String(cursor.x).padStart(2, "0") : "--"}</span>
          <span className="status-key">Y</span>
          <span className="status-val">{cursor ? String(cursor.y).padStart(2, "0") : "--"}</span>
        </span>
        <span className="status-divider" />
        <span className="status-item status-item--color">
          <ColorSwatch color={foreground} size={12} />
          <span className="mono">{hex.toUpperCase()}</span>
        </span>
        <span className="status-divider" />
        <span className="status-item status-item--hint">
          {selection ? `选区 ${selection.w} × ${selection.h}` : definition.detail}
        </span>
      </div>

      <div className="statusbar__center">
        <span className="status-state">
          <span className={`status-state__dot ${doc.dirty ? "is-dirty" : ""}`} />
          {doc.dirty ? "画布未保存" : "画布已同步"}
        </span>
        <span className="statusbar__center-slash">/</span>
        <span className="mono statusbar__mode">NEAREST · 1:1 PIXELS</span>
      </div>

      <div className="statusbar__right">
        <span className="status-item mono status-item--size">
          {doc.width} × {doc.height}
        </span>
        <span className="status-divider" />
        <div className="status-zoom">
          <Tooltip content="缩小" shortcut="−">
            <button type="button" className="status-zoom__button" onClick={() => zoomStep(-1)} aria-label="缩小">
              <Minus size={12} />
            </button>
          </Tooltip>
          <Tooltip content="适合窗口" shortcut="Ctrl 0">
            <button type="button" className="status-zoom__value mono" onClick={fitView}>
              {Math.round(zoom * 100)}%
            </button>
          </Tooltip>
          <Tooltip content="放大" shortcut="+">
            <button type="button" className="status-zoom__button" onClick={() => zoomStep(1)} aria-label="放大">
              <Plus size={12} />
            </button>
          </Tooltip>
          <Tooltip content="适合窗口" shortcut="Ctrl 0">
            <button type="button" className="status-zoom__button" onClick={fitView} aria-label="适合窗口">
              <Focus size={12} />
            </button>
          </Tooltip>
        </div>
      </div>
    </footer>
  )
}
