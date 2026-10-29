import { ArrowLeftRight, CircleHelp, Redo2, Undo2 } from 'lucide-react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Tooltip } from '../ui/Tooltip'
import { ColorSwatch } from '../ui/ColorSwatch'
import { ColorPickerPopover } from '../ui/ColorPickerPopover'
import { TOOLS } from './tools'

export function ToolRail() {
  const {
    tool,
    setTool,
    foreground,
    background,
    setForeground,
    setBackground,
    swapColors,
    undo,
    redo,
    canUndo,
    canRedo
  } = useWorkbench(
    useShallow((state) => ({
      tool: state.tool,
      setTool: state.setTool,
      foreground: state.foreground,
      background: state.background,
      setForeground: state.setForeground,
      setBackground: state.setBackground,
      swapColors: state.swapColors,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.history.length > 0,
      canRedo: state.redoStack.length > 0
    }))
  )
  const openDialog = useUi((state) => state.openDialog)

  return (
    <aside className="tool-rail" aria-label="工具与颜色">
      <div className="tool-rail__group">
        <span className="tool-rail__label eyebrow">TOOL</span>
        {TOOLS.map((entry) => {
          const Icon = entry.icon
          return (
            <Tooltip
              key={entry.id}
              content={`${entry.label} — ${entry.detail}`}
              shortcut={entry.shortcut}
              side="right"
            >
              <button
                type="button"
                className={clsx('rail-tool', tool === entry.id && 'is-active')}
                aria-label={entry.label}
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
          title="前景色"
          side="right"
          align="start"
        >
          <button type="button" className="color-slot color-slot--foreground" aria-label="选择前景色">
            <ColorSwatch color={foreground} size={36} />
            <span className="color-slot__tag mono">FG</span>
          </button>
        </ColorPickerPopover>

        <Tooltip content="交换前景 / 背景色" shortcut="X" side="right">
          <button type="button" className="color-swap" onClick={swapColors} aria-label="交换颜色">
            <ArrowLeftRight size={12} />
          </button>
        </Tooltip>

        <ColorPickerPopover
          color={background}
          onChange={setBackground}
          title="背景色"
          side="right"
          align="start"
        >
          <button type="button" className="color-slot color-slot--background" aria-label="选择背景色">
            <ColorSwatch color={background} size={30} />
            <span className="color-slot__tag mono">BG</span>
          </button>
        </ColorPickerPopover>
      </div>

      <div className="tool-rail__rule" />

      <div className="tool-rail__group tool-rail__group--history">
        <Tooltip content="撤销" shortcut="Ctrl Z" side="right">
          <button
            type="button"
            className="rail-tool rail-tool--small"
            aria-label="撤销"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 size={17} strokeWidth={1.8} />
          </button>
        </Tooltip>
        <Tooltip content="重做" shortcut="Ctrl Shift Z" side="right">
          <button
            type="button"
            className="rail-tool rail-tool--small"
            aria-label="重做"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 size={17} strokeWidth={1.8} />
          </button>
        </Tooltip>
      </div>

      <div className="tool-rail__spacer" />

      <div className="tool-rail__footer">
        <div className="rail-status mono">
          <span className="rail-status__dot" />
          1 LAYER
        </div>
        <Tooltip content="键盘快捷键" shortcut="?" side="right">
          <button
            type="button"
            className="rail-tool rail-tool--small"
            aria-label="键盘快捷键"
            onClick={() => openDialog('shortcuts')}
          >
            <CircleHelp size={16} strokeWidth={1.8} />
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
