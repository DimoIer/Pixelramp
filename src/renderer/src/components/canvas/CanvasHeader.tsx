import {
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  Layers2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Scaling,
  Sparkles,
  X
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TOOL_BY_ID } from '../tools/tools'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { IconButton } from '../ui/Button'
import { deselectCommand, extractColorsCommand } from '../../commands'
import { useT } from '../../i18n'

interface CanvasHeaderProps {
  paletteOpen: boolean
  onTogglePalette: () => void
  layersOpen: boolean
  onToggleLayers: () => void
  floatLayersOpen: boolean
  onToggleFloatLayers: () => void
}

export function CanvasHeader({
  paletteOpen,
  onTogglePalette,
  layersOpen,
  onToggleLayers,
  floatLayersOpen,
  onToggleFloatLayers
}: CanvasHeaderProps) {
  const {
    tool,
    brushSize,
    setBrushSize,
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
      brushSize: state.brushSize,
      setBrushSize: state.setBrushSize,
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
  const openDialog = useUi((state) => state.openDialog)
  const t = useT()
  const definition = TOOL_BY_ID[tool]
  const Icon = definition.icon
  const detail =
    tool === 'pencil' || tool === 'eraser'
      ? `${brushSize}px · ${t('硬边')}${pixelPerfect && tool === 'pencil' ? ` · ${t('像素完美')}` : ''}`
      : t(definition.detail)

  return (
    <div className="canvas-header">
      <div className="canvas-header__tool">
        <span className="canvas-header__tool-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <div className="canvas-header__tool-copy">
          <div className="eyebrow">
            {definition.shortcut} <span className="canvas-header__slash">/</span> {detail}
          </div>
          <div className="canvas-header__tool-name">{t(definition.label)}</div>
        </div>
      </div>

      <div className="canvas-header__options">
        {(tool === 'pencil' || tool === 'eraser') && (
          <>
            <div className="option-chip option-chip--size" title={t('笔刷大小')}>
              <button
                type="button"
                className="option-chip__step"
                onClick={() => setBrushSize(brushSize - 1)}
                disabled={brushSize <= 1}
                aria-label={t('减小笔刷')}
              >
                <Minus size={11} />
              </button>
              <span className="option-chip__value mono">{brushSize}px</span>
              <button
                type="button"
                className="option-chip__step"
                onClick={() => setBrushSize(brushSize + 1)}
                disabled={brushSize >= 32}
                aria-label={t('增大笔刷')}
              >
                <Plus size={11} />
              </button>
            </div>
            <button
              type="button"
              className={`option-chip ${pixelPerfect ? 'is-on' : ''}`}
              aria-pressed={pixelPerfect}
              onClick={togglePixelPerfect}
            >
              <span className="option-chip__dot" />
              {t('像素完美')}
            </button>
          </>
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
              {t('仅连续区域')}
            </button>
            <span className="option-chip option-chip--static">{t('容差 0')}</span>
          </>
        )}
        {(tool === 'line' || tool === 'rectangle') && (
          <span className="option-chip option-chip--static">{t('按住 Shift 约束像素')}</span>
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
                  {t('提取选区')}
                </button>
                <button
                  type="button"
                  className="option-chip option-chip--ghost"
                  onClick={deselectCommand}
                >
                  <X size={11} />
                  {t('取消')}
                </button>
              </>
            ) : (
              <span className="option-chip option-chip--static">{t('拖拽框选 · 区内拖拽移动')}</span>
            )}
          </>
        )}
        {tool === 'eyedropper' && (
          <span className="option-chip option-chip--static">{t('左键取前景 · Shift 取背景')}</span>
        )}
        {tool !== 'select' && selection ? (
          <button
            type="button"
            className="option-chip option-chip--action"
            onClick={() => void extractColorsCommand()}
            disabled={extracting}
          >
            <Sparkles size={11} />
            {t('提取选区颜色')}
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
            label={layersOpen ? t('收起图层面板') : t('展开图层面板')}
            active={layersOpen}
            size="sm"
            onClick={onToggleLayers}
          >
            <Layers2 size={15} />
          </IconButton>
          <IconButton
            className="float-layer-trigger"
            label={floatLayersOpen ? t('关闭浮动图层面板') : t('浮动图层面板')}
            active={floatLayersOpen}
            size="sm"
            onClick={onToggleFloatLayers}
          >
            <Layers2 size={15} />
            <span className="float-layer-trigger__dot" aria-hidden />
          </IconButton>
          <IconButton
            label={t('调整画布大小')}
            size="sm"
            onClick={() => openDialog('resize-canvas')}
          >
            <Scaling size={15} />
          </IconButton>
          <IconButton
            label={t('水平镜像对称')}
            active={symmetryX}
            size="sm"
            onClick={() => toggleSymmetry('x')}
          >
            <FlipHorizontal2 size={15} />
          </IconButton>
          <IconButton
            label={t('垂直镜像对称')}
            active={symmetryY}
            size="sm"
            onClick={() => toggleSymmetry('y')}
          >
            <FlipVertical2 size={15} />
          </IconButton>
          <IconButton
            label={t('像素网格')}
            active={showGrid}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3X3 size={15} />
          </IconButton>
        </div>
        <span className="canvas-header__divider" />
        <IconButton
          label={paletteOpen ? t('收起调色卡面板') : t('展开调色卡面板')}
          size="sm"
          onClick={onTogglePalette}
        >
          {paletteOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
        </IconButton>
      </div>
    </div>
  )
}
