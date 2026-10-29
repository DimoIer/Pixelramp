import {
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  X
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TOOL_BY_ID } from '../tools/tools'
import { useWorkbench } from '../../store/workbench'
import { IconButton } from '../ui/Button'
import { deselectCommand, extractColorsCommand } from '../../commands'

interface CanvasHeaderProps {
  paletteOpen: boolean
  onTogglePalette: () => void
}

export function CanvasHeader({ paletteOpen, onTogglePalette }: CanvasHeaderProps) {
  const {
    tool,
    pixelPerfect,
    togglePixelPerfect,
    contiguous,
    toggleContiguous,
    symmetryX,
    symmetryY,
    toggleSymmetry,
    showGrid,
    setShowGrid,
    selection,
    extracting
  } = useWorkbench(
    useShallow((state) => ({
      tool: state.tool,
      pixelPerfect: state.pixelPerfect,
      togglePixelPerfect: state.togglePixelPerfect,
      contiguous: state.contiguous,
      toggleContiguous: state.toggleContiguous,
      symmetryX: state.symmetryX,
      symmetryY: state.symmetryY,
      toggleSymmetry: state.toggleSymmetry,
      showGrid: state.showGrid,
      setShowGrid: state.setShowGrid,
      selection: state.selection,
      extracting: state.extracting
    }))
  )
  const definition = TOOL_BY_ID[tool]
  const Icon = definition.icon

  return (
    <div className="canvas-header">
      <div className="canvas-header__tool">
        <span className="canvas-header__tool-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <div className="canvas-header__tool-copy">
          <div className="eyebrow">
            {definition.shortcut} <span className="canvas-header__slash">/</span> {definition.detail}
          </div>
          <div className="canvas-header__tool-name">{definition.label}</div>
        </div>
      </div>

      <div className="canvas-header__options">
        {(tool === 'pencil' || tool === 'eraser') && (
          <button
            type="button"
            className={`option-chip ${pixelPerfect ? 'is-on' : ''}`}
            aria-pressed={pixelPerfect}
            onClick={togglePixelPerfect}
          >
            <span className="option-chip__dot" />
            像素完美
          </button>
        )}
        {tool === 'bucket' && (
          <>
            <button
              type="button"
              className={`option-chip ${contiguous ? 'is-on' : ''}`}
              aria-pressed={contiguous}
              onClick={toggleContiguous}
            >
              <span className="option-chip__dot" />
              仅连续区域
            </button>
            <span className="option-chip option-chip--static">容差 0</span>
          </>
        )}
        {(tool === 'line' || tool === 'rectangle') && (
          <span className="option-chip option-chip--static">按住 Shift 约束像素</span>
        )}
        {tool === 'select' && (
          <>
            {selection ? (
              <>
                <span className="option-chip option-chip--static mono">
                  {selection.w} × {selection.h}
                </span>
                <button
                  type="button"
                  className="option-chip option-chip--action"
                  onClick={() => void extractColorsCommand()}
                  disabled={extracting}
                >
                  <Sparkles size={11} />
                  提取选区
                </button>
                <button
                  type="button"
                  className="option-chip option-chip--ghost"
                  onClick={deselectCommand}
                >
                  <X size={11} />
                  取消
                </button>
              </>
            ) : (
              <span className="option-chip option-chip--static">拖拽框选 · 区内拖拽移动</span>
            )}
          </>
        )}
        {tool === 'eyedropper' && (
          <span className="option-chip option-chip--static">左键取前景 · Shift 取背景</span>
        )}
        {tool !== 'select' && selection ? (
          <button
            type="button"
            className="option-chip option-chip--action"
            onClick={() => void extractColorsCommand()}
            disabled={extracting}
          >
            <Sparkles size={11} />
            提取选区颜色
          </button>
        ) : null}
      </div>

      <div className="canvas-header__right">
        <span className="nearest-badge mono">
          <span className="nearest-badge__dot" />
          NEAREST
        </span>
        <span className="canvas-header__divider" />
        <div className="canvas-header__icon-group">
          <IconButton
            label="水平镜像对称"
            active={symmetryX}
            size="sm"
            onClick={() => toggleSymmetry('x')}
          >
            <FlipHorizontal2 size={15} />
          </IconButton>
          <IconButton
            label="垂直镜像对称"
            active={symmetryY}
            size="sm"
            onClick={() => toggleSymmetry('y')}
          >
            <FlipVertical2 size={15} />
          </IconButton>
          <IconButton
            label="像素网格"
            active={showGrid}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3X3 size={15} />
          </IconButton>
        </div>
        <span className="canvas-header__divider" />
        <IconButton
          label={paletteOpen ? '收起调色卡面板' : '展开调色卡面板'}
          size="sm"
          onClick={onTogglePalette}
        >
          {paletteOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
        </IconButton>
      </div>
    </div>
  )
}
