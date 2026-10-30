import { ArrowLeftRight, CircleHelp, GripHorizontal, Layers2, PanelLeftClose, PictureInPicture2 } from 'lucide-react'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Tooltip } from '../ui/Tooltip'
import { ColorSwatch } from '../ui/ColorSwatch'
import { ColorPickerPopover } from '../ui/ColorPickerPopover'
import { createDragGhost, type DragGhost } from '../layout/dragGhost'
import { TOOLS } from './tools'
import { useT } from '../../i18n'

interface ToolRailProps {
  floating?: boolean
  horizontal?: boolean
  onCollapse?: () => void
  onFloat?: (point?: { x: number; y: number }) => void
  onToggleOrientation?: () => void
  layersOpen?: boolean
  onToggleLayers?: () => void
}

export function ToolRail({
  floating = false,
  horizontal = false,
  onCollapse,
  onFloat,
  layersOpen = false,
  onToggleLayers
}: ToolRailProps) {
  const t = useT()
  const {
    tool,
    setTool,
    foreground,
    background,
    setForeground,
    setBackground,
    swapColors,
    layerCount
  } = useWorkbench(
    useShallow((state) => ({
      tool: state.tool,
      setTool: state.setTool,
      foreground: state.foreground,
      background: state.background,
      setForeground: state.setForeground,
      setBackground: state.setBackground,
      swapColors: state.swapColors,
      layerCount: state.doc.layers.length
    }))
  )
  const openDialog = useUi((state) => state.openDialog)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    source: HTMLElement
    ghost: DragGhost | null
  } | null>(null)

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!onFloat) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      source: event.currentTarget.closest('.tool-rail') as HTMLElement,
      ghost: null
    }
  }

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    if (!current) return
    if (!current.ghost) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return
      current.ghost = createDragGhost(
        current.source,
        event.clientX,
        event.clientY,
        horizontal ? { width: 560, height: 96 } : { width: 158, height: 660 }
      )
      current.source.classList.add('panel-drag-source')
    }
    current.ghost.move(event.clientX, event.clientY)
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    drag.current = null
    if (!current) return
    if (event.currentTarget.hasPointerCapture(current.pointerId)) {
      event.currentTarget.releasePointerCapture(current.pointerId)
    }
    if (!current.ghost) return
    current.ghost.remove()
    current.source.classList.remove('panel-drag-source')
    if (event.clientX > 105) {
      onFloat?.({ x: event.clientX, y: event.clientY })
    }
  }

  return (
    <aside
      className={clsx('tool-rail', floating && 'is-floating', horizontal && 'is-horizontal')}
      aria-label={t('工具与颜色')}
    >
      {!floating ? (
        <>
          <div
            className="tool-rail__grip"
            title={t('拖动以悬浮工具栏')}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <GripHorizontal size={13} />
          </div>
          <div className="tool-rail__controls">
          {onCollapse ? (
            <Tooltip content={t('收起工具栏')} side="right">
              <button type="button" className="rail-control" aria-label={t('收起工具栏')} onClick={onCollapse}>
                <PanelLeftClose size={14} />
              </button>
            </Tooltip>
          ) : null}
          {onFloat ? (
            <Tooltip content={t('悬浮工具栏')} side="right">
              <button
                type="button"
                className="rail-control"
                aria-label={t('悬浮工具栏')}
                onClick={() => onFloat()}
              >
                <PictureInPicture2 size={14} />
              </button>
            </Tooltip>
          ) : null}
        </div>
        </>
      ) : null}
      <div className="tool-rail__group">
        <span className="tool-rail__label eyebrow">{t('工具')}</span>
        {TOOLS.map((entry) => {
          const Icon = entry.icon
          return (
            <Tooltip
              key={entry.id}
              content={`${t(entry.label)} — ${t(entry.detail)}`}
              shortcut={entry.shortcut}
              side="right"
            >
              <button
                type="button"
                className={clsx('rail-tool', tool === entry.id && 'is-active')}
                aria-label={t(entry.label)}
                aria-pressed={tool === entry.id}
                onClick={() => setTool(entry.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="rail-tool__key mono">{entry.shortcut}</span>
              </button>
            </Tooltip>
          )
        })}
      </div>

      <div className="tool-rail__rule" />

      <div className="tool-rail__colors">
        <ColorPickerPopover
          color={foreground}
          onChange={setForeground}
          title={t('前景色')}
          side="right"
          align="start"
        >
          <button type="button" className="color-slot color-slot--foreground" aria-label={t('选择前景色')}>
            <ColorSwatch color={foreground} size={36} />
            <span className="color-slot__tag mono">FG</span>
          </button>
        </ColorPickerPopover>

        <Tooltip content={t('交换前景 / 背景色')} shortcut="X" side="right">
          <button type="button" className="color-swap" onClick={swapColors} aria-label={t('交换颜色')}>
            <ArrowLeftRight size={12} />
          </button>
        </Tooltip>

        <ColorPickerPopover
          color={background}
          onChange={setBackground}
          title={t('背景色')}
          side="right"
          align="start"
        >
          <button type="button" className="color-slot color-slot--background" aria-label={t('选择背景色')}>
            <ColorSwatch color={background} size={30} />
            <span className="color-slot__tag mono">BG</span>
          </button>
        </ColorPickerPopover>
      </div>

      <div className="tool-rail__spacer" />

      <div className="tool-rail__footer">
        <div className="rail-status mono">
          <span className="rail-status__dot" />
          {layerCount} LAYER{layerCount === 1 ? '' : 'S'}
        </div>
        {onToggleLayers ? (
          <Tooltip content={layersOpen ? t('关闭图层面板') : t('打开图层面板')} side="right">
            <button
              type="button"
              className={clsx('rail-tool', 'rail-tool--small', layersOpen && 'is-active')}
              aria-label={layersOpen ? t('关闭图层面板') : t('打开图层面板')}
              onClick={onToggleLayers}
            >
              <Layers2 size={16} strokeWidth={1.8} />
            </button>
          </Tooltip>
        ) : null}
        <Tooltip content={t('键盘快捷键')} shortcut="?" side="right">
          <button
            type="button"
            className="rail-tool rail-tool--small"
            aria-label={t('键盘快捷键')}
            onClick={() => openDialog('shortcuts')}
          >
            <CircleHelp size={16} strokeWidth={1.8} />
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
