import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Archive,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileArchive,
  FileImage,
  FilePlus2,
  FolderOpen,
  Grid3X3,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Save,
  Scan,
  Square,
  Undo2,
  X,
  FlipHorizontal2,
  FlipVertical2,
  ZoomIn,
  ZoomOut,
  Focus,
  Scissors,
  ClipboardPaste,
  Trash2,
  MousePointerSquareDashed,
  FileJson,
  Settings2
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { platformVersion, isDesktop, onMaximizedChange, windowControls } from '../../platform'
import {
  copySelectionCommand,
  cutSelectionCommand,
  deleteSelectionCommand,
  deselectCommand,
  openFileCommand,
  openNewCanvasDialog,
  openRecentCommand,
  pasteCommand,
  requestWindowCloseCommand,
  saveProjectCommand,
  selectAllCommand
} from '../../commands'

interface TitleBarProps {
  paletteOpen: boolean
  onTogglePalette: () => void
}

function Divider() {
  return <DropdownMenu.Separator className="menu-separator" />
}

interface MenuActionProps {
  icon?: ReactNode
  label: string
  shortcut?: string
  onSelect?: () => void
  disabled?: boolean
  danger?: boolean
}

function MenuAction({ icon, label, shortcut, onSelect, disabled, danger }: MenuActionProps) {
  return (
    <DropdownMenu.Item
      className={clsx('menu-item', danger && 'menu-item--danger')}
      disabled={disabled}
      onSelect={() => onSelect?.()}
    >
      <span className="menu-item__icon">{icon}</span>
      <span className="menu-item__label">{label}</span>
      {shortcut ? <span className="menu-item__shortcut">{shortcut}</span> : null}
    </DropdownMenu.Item>
  )
}

function CheckAction({
  checked,
  label,
  shortcut,
  onSelect
}: {
  checked: boolean
  label: string
  shortcut?: string
  onSelect: () => void
}) {
  return (
    <DropdownMenu.CheckboxItem
      className="menu-item"
      checked={checked}
      onCheckedChange={() => onSelect()}
    >
      <span className="menu-item__icon">{checked ? <Check size={13} /> : null}</span>
      <span className="menu-item__label">{label}</span>
      {shortcut ? <span className="menu-item__shortcut">{shortcut}</span> : null}
    </DropdownMenu.CheckboxItem>
  )
}

function MenuTrigger({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Trigger asChild>
      <button type="button" className="menubar__trigger">
        {children}
      </button>
    </DropdownMenu.Trigger>
  )
}

function RecentMenu() {
  const { recentFiles, refreshRecent, clearRecent } = useUi(
    useShallow((state) => ({
      recentFiles: state.recentFiles,
      refreshRecent: state.refreshRecent,
      clearRecent: state.clearRecent
    }))
  )

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="menu-item">
        <span className="menu-item__icon">
          <Archive size={14} />
        </span>
        <span className="menu-item__label">最近打开</span>
        <span className="menu-item__chevron">
          <ChevronRight size={13} />
        </span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="menu-content menu-content--sub" sideOffset={5} alignOffset={-5}>
          {recentFiles.length === 0 ? (
            <div className="menu-empty">还没有最近打开的文件</div>
          ) : (
            recentFiles.map((entry) => (
              <DropdownMenu.Item
                key={entry.path}
                className="menu-item menu-item--recent"
                onSelect={() => void openRecentCommand(entry)}
                title={entry.path}
              >
                <span className="menu-item__icon">
                  {entry.kind === 'project' ? <FileArchive size={14} /> : <FileImage size={14} />}
                </span>
                <span className="menu-item__recent-copy">
                  <span className="menu-item__label">{entry.name}</span>
                  <span className="menu-item__recent-path">{entry.path}</span>
                </span>
              </DropdownMenu.Item>
            ))
          )}
          {recentFiles.length > 0 ? (
            <>
              <Divider />
              <MenuAction label="清空最近记录" onSelect={() => void clearRecent()} />
            </>
          ) : null}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  )
}

function FileMenu() {
  const openDialog = useUi((state) => state.openDialog)
  const refreshRecent = useUi((state) => state.refreshRecent)
  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open) void refreshRecent()
      }}
    >
      <MenuTrigger>文件</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<FilePlus2 size={14} />}
            label="新建画布…"
            shortcut="Ctrl N"
            onSelect={openNewCanvasDialog}
          />
          <MenuAction
            icon={<FolderOpen size={14} />}
            label="打开图像 / 工程…"
            shortcut="Ctrl O"
            onSelect={() => void openFileCommand()}
          />
          <RecentMenu />
          <Divider />
          <MenuAction
            icon={<Save size={14} />}
            label="保存工程"
            shortcut="Ctrl S"
            onSelect={() => void saveProjectCommand(false)}
          />
          <MenuAction
            icon={<Save size={14} />}
            label="工程另存为…"
            shortcut="Ctrl Shift S"
            onSelect={() => void saveProjectCommand(true)}
          />
          <MenuAction
            icon={<Download size={14} />}
            label="导出 PNG…"
            shortcut="Ctrl Shift E"
            onSelect={() => openDialog('export-image')}
          />
          <Divider />
          <MenuAction
            icon={<FolderOpen size={14} />}
            label="调色卡库…"
            onSelect={() => openDialog('library')}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function EditMenu() {
  const {
    undo,
    redo,
    history,
    redoStack,
    selection,
    clipboard
  } = useWorkbench(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      history: state.history.length,
      redoStack: state.redoStack.length,
      selection: state.selection,
      clipboard: state.clipboard
    }))
  )

  return (
    <DropdownMenu.Root>
      <MenuTrigger>编辑</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<Undo2 size={14} />}
            label="撤销"
            shortcut="Ctrl Z"
            disabled={history === 0}
            onSelect={undo}
          />
          <MenuAction
            icon={<Redo2 size={14} />}
            label="重做"
            shortcut="Ctrl Shift Z"
            disabled={redoStack === 0}
            onSelect={redo}
          />
          <Divider />
          <MenuAction
            icon={<Scissors size={14} />}
            label="剪切选区"
            shortcut="Ctrl X"
            disabled={!selection}
            onSelect={cutSelectionCommand}
          />
          <MenuAction
            icon={<Copy size={14} />}
            label="复制"
            shortcut="Ctrl C"
            onSelect={copySelectionCommand}
          />
          <MenuAction
            icon={<ClipboardPaste size={14} />}
            label="粘贴"
            shortcut="Ctrl V"
            disabled={!clipboard}
            onSelect={pasteCommand}
          />
          <MenuAction
            icon={<Trash2 size={14} />}
            label="删除选区"
            shortcut="Del"
            disabled={!selection}
            onSelect={deleteSelectionCommand}
          />
          <Divider />
          <MenuAction
            icon={<MousePointerSquareDashed size={14} />}
            label="全选"
            shortcut="Ctrl A"
            onSelect={selectAllCommand}
          />
          <MenuAction
            label="取消选择"
            shortcut="Esc"
            disabled={!selection}
            onSelect={deselectCommand}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function ViewMenu({ paletteOpen, onTogglePalette }: TitleBarProps) {
  const {
    showGrid,
    setShowGrid,
    symmetryX,
    symmetryY,
    toggleSymmetry,
    zoomStep,
    fitView
  } = useWorkbench(
    useShallow((state) => ({
      showGrid: state.showGrid,
      setShowGrid: state.setShowGrid,
      symmetryX: state.symmetryX,
      symmetryY: state.symmetryY,
      toggleSymmetry: state.toggleSymmetry,
      zoomStep: state.zoomStep,
      fitView: state.fitView
    }))
  )
  const openDialog = useUi((state) => state.openDialog)
  return (
    <DropdownMenu.Root>
      <MenuTrigger>视图</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<ZoomIn size={14} />}
            label="放大"
            shortcut="+"
            onSelect={() => zoomStep(1)}
          />
          <MenuAction
            icon={<ZoomOut size={14} />}
            label="缩小"
            shortcut="−"
            onSelect={() => zoomStep(-1)}
          />
          <MenuAction
            icon={<Focus size={14} />}
            label="适合窗口"
            shortcut="Ctrl 0"
            onSelect={fitView}
          />
          <Divider />
          <CheckAction
            checked={showGrid}
            label="显示像素网格"
            shortcut="Shift G"
            onSelect={() => setShowGrid(!showGrid)}
          />
          <CheckAction
            checked={symmetryX}
            label="水平镜像对称"
            onSelect={() => toggleSymmetry('x')}
          />
          <CheckAction
            checked={symmetryY}
            label="垂直镜像对称"
            onSelect={() => toggleSymmetry('y')}
          />
          <Divider />
          <MenuAction
            icon={paletteOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            label={paletteOpen ? "收起调色卡面板" : "展开调色卡面板"}
            onSelect={onTogglePalette}
          />
          <MenuAction
            icon={<Keyboard size={14} />}
            label="键盘快捷键"
            shortcut="?"
            onSelect={() => openDialog('shortcuts')}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function HelpMenu() {
  const openDialog = useUi((state) => state.openDialog)
  return (
    <DropdownMenu.Root>
      <MenuTrigger>帮助</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<Keyboard size={14} />}
            label="键盘快捷键"
            shortcut="?"
            onSelect={() => openDialog('shortcuts')}
          />
          <MenuAction
            icon={<HelpCircle size={14} />}
            label="使用提示"
            onSelect={() => openDialog('shortcuts')}
          />
          <Divider />
          <MenuAction
            icon={<Info size={14} />}
            label="关于 PixelRamp"
            onSelect={() => openDialog('about')}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <span className="brand-mark__cell brand-mark__cell--1" />
      <span className="brand-mark__cell brand-mark__cell--2" />
      <span className="brand-mark__cell brand-mark__cell--3" />
      <span className="brand-mark__cell brand-mark__cell--4" />
    </span>
  )
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let alive = true
    void windowControls.isMaximized().then((value) => {
      if (alive) setMaximized(value)
    })
    const unsubscribe = onMaximizedChange((value) => setMaximized(value))
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="window-controls no-drag">
      <button
        type="button"
        className="window-control"
        aria-label="最小化"
        onClick={() => windowControls.minimize()}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        className="window-control"
        aria-label={maximized ? "还原" : "最大化"}
        onClick={() => windowControls.toggleMaximize()}
      >
        {maximized ? <Copy size={11} /> : <Square size={11} />}
      </button>
      <button
        type="button"
        className="window-control window-control--close"
        aria-label="关闭"
        onClick={() => void requestWindowCloseCommand()}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function TitleBar({ paletteOpen, onTogglePalette }: TitleBarProps) {
  const { doc } = useWorkbench(useShallow((state) => ({ doc: state.doc })))
  const version = platformVersion()
  const docIcon = doc.kind === 'project' ? <FileArchive size={12} /> : doc.kind === 'image' ? <FileImage size={12} /> : <FilePlus2 size={12} />

  return (
    <header
      className="titlebar"
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest('.no-drag')) windowControls.toggleMaximize()
      }}
    >
      <div className="titlebar__left no-drag">
        <div className="brand">
          <BrandMark />
          <div className="brand__copy">
            <span className="brand__name">
              PIXELRAMP<span className="brand__dot">.</span>
            </span>
            <span className="brand__sub">STUDIO</span>
          </div>
        </div>
        <span className="titlebar__divider" />
        <nav className="menubar" aria-label="主菜单">
          <FileMenu />
          <EditMenu />
          <ViewMenu paletteOpen={paletteOpen} onTogglePalette={onTogglePalette} />
          <HelpMenu />
        </nav>
      </div>

      <div className="titlebar__center">
        <div className={clsx('doc-chip', doc.dirty && 'is-dirty')}>
          <span className="doc-chip__icon">{docIcon}</span>
          <span className="doc-chip__name">{doc.name}</span>
          <span className="doc-chip__size mono">
            {doc.width}×{doc.height}
          </span>
          {doc.dirty ? <span className="doc-chip__dot" aria-label="未保存" /> : null}
        </div>
      </div>

      <div className="titlebar__right no-drag">
        {!isDesktop ? <span className="web-preview-badge mono">WEB PREVIEW</span> : null}
        <span className="build-chip mono">v{version || "0.1.0"}</span>
        <WindowControls />
      </div>
    </header>
  )
}
