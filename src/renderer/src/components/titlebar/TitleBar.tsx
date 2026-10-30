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
  PanelLeft,
  PanelRight,
  PictureInPicture2,
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
  Settings2,
  Palette,
  SlidersHorizontal,
  SunMedium,
  Droplets,
  Blend,
  Spline,
  Scaling
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { usePreferences, type Language, type UiTheme } from '../../store/preferences'
import { useT } from '../../i18n'
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
  selectAllCommand,
  invertActiveLayerCommand
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
  icon,
  onSelect
}: {
  checked: boolean
  label: string
  shortcut?: string
  icon?: ReactNode
  onSelect: () => void
}) {
  return (
    <DropdownMenu.CheckboxItem
      className="menu-item"
      checked={checked}
      onCheckedChange={() => onSelect()}
    >
      <span className="menu-item__icon">{icon ?? (checked ? <Check size={13} /> : null)}</span>
      <span className="menu-item__label">{label}</span>
      {shortcut ? <span className="menu-item__shortcut">{shortcut}</span> : null}
      {checked ? (
        <span className="menu-item__indicator">
          <Check size={12} />
        </span>
      ) : null}
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
  const t = useT()
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
        <span className="menu-item__label">{t('最近打开')}</span>
        <span className="menu-item__chevron">
          <ChevronRight size={13} />
        </span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="menu-content menu-content--sub" sideOffset={5} alignOffset={-5}>
          {recentFiles.length === 0 ? (
            <div className="menu-empty">{t('还没有最近打开的文件')}</div>
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
              <MenuAction label={t('清空最近记录')} onSelect={() => void clearRecent()} />
            </>
          ) : null}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  )
}

function FileMenu() {
  const t = useT()
  const openDialog = useUi((state) => state.openDialog)
  const refreshRecent = useUi((state) => state.refreshRecent)
  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open) void refreshRecent()
      }}
    >
      <MenuTrigger>{t('文件')}</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<FilePlus2 size={14} />}
            label={t('新建画布…')}
            shortcut="Ctrl N"
            onSelect={openNewCanvasDialog}
          />
          <MenuAction
            icon={<FolderOpen size={14} />}
            label={t('打开图像 / 工程…')}
            shortcut="Ctrl O"
            onSelect={() => void openFileCommand()}
          />
          <RecentMenu />
          <Divider />
          <MenuAction
            icon={<Save size={14} />}
            label={t('保存工程')}
            shortcut="Ctrl S"
            onSelect={() => void saveProjectCommand(false)}
          />
          <MenuAction
            icon={<Save size={14} />}
            label={t('工程另存为…')}
            shortcut="Ctrl Shift S"
            onSelect={() => void saveProjectCommand(true)}
          />
          <MenuAction
            icon={<Download size={14} />}
            label={t('导出 PNG…')}
            shortcut="Ctrl Shift E"
            onSelect={() => openDialog('export-image')}
          />
          <Divider />
          <MenuAction
            icon={<FolderOpen size={14} />}
            label={t('调色卡库…')}
            onSelect={() => openDialog('library')}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function EditMenu() {
  const t = useT()
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
      <MenuTrigger>{t('编辑')}</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<Undo2 size={14} />}
            label={t('撤销')}
            shortcut="Ctrl Z"
            disabled={history === 0}
            onSelect={undo}
          />
          <MenuAction
            icon={<Redo2 size={14} />}
            label={t('重做')}
            shortcut="Ctrl Shift Z"
            disabled={redoStack === 0}
            onSelect={redo}
          />
          <Divider />
          <MenuAction
            icon={<Scissors size={14} />}
            label={t('剪切选区')}
            shortcut="Ctrl X"
            disabled={!selection}
            onSelect={cutSelectionCommand}
          />
          <MenuAction
            icon={<Copy size={14} />}
            label={t('复制')}
            shortcut="Ctrl C"
            onSelect={copySelectionCommand}
          />
          <MenuAction
            icon={<ClipboardPaste size={14} />}
            label={t('粘贴')}
            shortcut="Ctrl V"
            disabled={!clipboard}
            onSelect={pasteCommand}
          />
          <MenuAction
            icon={<Trash2 size={14} />}
            label={t('删除选区')}
            shortcut="Del"
            disabled={!selection}
            onSelect={deleteSelectionCommand}
          />
          <Divider />
          <MenuAction
            icon={<MousePointerSquareDashed size={14} />}
            label={t('全选')}
            shortcut="Ctrl A"
            onSelect={selectAllCommand}
          />
          <MenuAction
            label={t('取消选择')}
            shortcut="Esc"
            disabled={!selection}
            onSelect={deselectCommand}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function AdjustMenu() {
  const t = useT()
  const openDialog = useUi((state) => state.openDialog)
  const { hasLayer } = useWorkbench(
    useShallow((state) => ({ hasLayer: !!state.doc.layers[state.doc.activeLayer] }))
  )
  return (
    <DropdownMenu.Root>
      <MenuTrigger>{t('调整')}</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<SunMedium size={14} />}
            label={t('调整亮度和对比度…')}
            onSelect={() => openDialog('brightness-contrast')}
            disabled={!hasLayer}
          />
          <MenuAction
            icon={<Droplets size={14} />}
            label={t('调整饱和度和色调…')}
            onSelect={() => openDialog('hue-saturation')}
            disabled={!hasLayer}
          />
          <MenuAction
            icon={<Blend size={14} />}
            label={t('调整不透明度…')}
            onSelect={() => openDialog('opacity')}
            disabled={!hasLayer}
          />
          <MenuAction
            icon={<SlidersHorizontal size={14} />}
            label={t('反转颜色')}
            onSelect={invertActiveLayerCommand}
            disabled={!hasLayer}
          />
          <MenuAction
            icon={<Spline size={14} />}
            label={t('调整曲线…')}
            onSelect={() => openDialog('curves')}
            disabled={!hasLayer}
          />
          <Divider />
          <MenuAction
            icon={<Scaling size={14} />}
            label={t('纹理缩放…')}
            onSelect={() => openDialog('texture-scale')}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function ViewMenu({ paletteOpen, onTogglePalette }: TitleBarProps) {
  const t = useT()
  const {
    floatToolbar,
    floatPalette,
    setFloatToolbar,
    setFloatPalette,
    toolbarOpen,
    setToolbarOpen
  } = usePreferences()
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
      <MenuTrigger>{t('视图')}</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<ZoomIn size={14} />}
            label={t('放大')}
            shortcut="+"
            onSelect={() => zoomStep(1)}
          />
          <MenuAction
            icon={<ZoomOut size={14} />}
            label={t('缩小')}
            shortcut="−"
            onSelect={() => zoomStep(-1)}
          />
          <MenuAction
            icon={<Focus size={14} />}
            label={t('适合窗口')}
            shortcut="Ctrl 0"
            onSelect={fitView}
          />
          <Divider />
          <CheckAction
            checked={showGrid}
            label={t('显示像素网格')}
            shortcut="Shift G"
            onSelect={() => setShowGrid(!showGrid)}
          />
          <CheckAction
            checked={symmetryX}
            label={t('水平镜像对称')}
            onSelect={() => toggleSymmetry('x')}
          />
          <CheckAction
            checked={symmetryY}
            label={t('垂直镜像对称')}
            onSelect={() => toggleSymmetry('y')}
          />
          <Divider />
          <CheckAction
            checked={toolbarOpen}
            icon={<PanelLeft size={14} />}
            label={t('显示工具栏')}
            onSelect={() => setToolbarOpen(!toolbarOpen)}
          />
          <CheckAction
            checked={floatToolbar}
            icon={<PictureInPicture2 size={14} />}
            label={t('浮动工具栏')}
            onSelect={() => {
              setFloatToolbar(!floatToolbar)
              if (!floatToolbar) setToolbarOpen(true)
            }}
          />
          <CheckAction
            checked={paletteOpen}
            icon={<PanelRight size={14} />}
            label={t('显示调色卡工作台')}
            onSelect={onTogglePalette}
          />
          <CheckAction
            checked={floatPalette}
            icon={<PictureInPicture2 size={14} />}
            label={t('浮动调色卡工作台')}
            onSelect={() => {
              setFloatPalette(!floatPalette)
              if (!paletteOpen) onTogglePalette()
            }}
          />
          <Divider />
          <MenuAction
            icon={<Keyboard size={14} />}
            label={t('键盘快捷键')}
            shortcut="?"
            onSelect={() => openDialog('shortcuts')}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function HelpMenu() {
  const t = useT()
  const openDialog = useUi((state) => state.openDialog)
  return (
    <DropdownMenu.Root>
      <MenuTrigger>{t('帮助')}</MenuTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
          <MenuAction
            icon={<Keyboard size={14} />}
            label={t('键盘快捷键')}
            shortcut="?"
            onSelect={() => openDialog('shortcuts')}
          />
          <MenuAction
            icon={<HelpCircle size={14} />}
            label={t('使用提示')}
            onSelect={() => openDialog('shortcuts')}
          />
          <Divider />
          <MenuAction
            icon={<Info size={14} />}
            label={t('关于 PixelRamp')}
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
  const t = useT()
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
        aria-label={t('最小化')}
        onClick={() => windowControls.minimize()}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        className="window-control"
        aria-label={maximized ? t('还原') : t('最大化')}
        onClick={() => windowControls.toggleMaximize()}
      >
        {maximized ? <Copy size={11} /> : <Square size={11} />}
      </button>
      <button
        type="button"
        className="window-control window-control--close"
        aria-label={t('关闭')}
        onClick={() => void requestWindowCloseCommand()}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ThemeMenu() {
  const { theme, canvasLight, language, setTheme, setCanvasLight, setLanguage } = usePreferences()
  const t = useT()
  const themes: Array<{ id: UiTheme; label: string }> = [
    { id: 'moss', label: t('苔绿') },
    { id: 'cobalt', label: t('钴蓝') },
    { id: 'ember', label: t('余烬') },
    { id: 'paper', label: t('纸白') }
  ]
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="theme-trigger" aria-label={t('外观设置')} title={t('外观设置')}>
          <Palette size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content theme-menu" align="end" sideOffset={6}>
          <div className="menu-section-label">{t('界面主题')}</div>
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as UiTheme)}
          >
            {themes.map((entry) => (
              <DropdownMenu.RadioItem
                key={entry.id}
                value={entry.id}
                className="menu-item theme-menu__item"
              >
                <span className={`theme-swatch theme-swatch--${entry.id}`} aria-hidden />
                <span className="menu-item__label">{entry.label}</span>
                <DropdownMenu.ItemIndicator className="menu-item__indicator">
                  <Check size={12} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <Divider />
          <DropdownMenu.CheckboxItem
            className="menu-item"
            checked={canvasLight}
            onCheckedChange={(checked) => setCanvasLight(checked)}
          >
            <span className="menu-item__icon">{canvasLight ? <Check size={13} /> : null}</span>
            <span className="menu-item__label">{t('浅色画布背景')}</span>
          </DropdownMenu.CheckboxItem>
          <Divider />
          <div className="menu-section-label">{t('界面语言')}</div>
          <DropdownMenu.RadioGroup
            value={language}
            onValueChange={(value) => setLanguage(value as Language)}
          >
            <DropdownMenu.RadioItem value="zh" className="menu-item theme-menu__item">
              <span className="language-mark">中</span>
              <span className="menu-item__label">中文</span>
              <DropdownMenu.ItemIndicator className="menu-item__indicator">
                <Check size={12} />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="en" className="menu-item theme-menu__item">
              <span className="language-mark">EN</span>
              <span className="menu-item__label">English</span>
              <DropdownMenu.ItemIndicator className="menu-item__indicator">
                <Check size={12} />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function TitleBar({ paletteOpen, onTogglePalette }: TitleBarProps) {
  const t = useT()
  const { doc } = useWorkbench(useShallow((state) => ({ doc: state.doc })))
  const version = platformVersion()
  const docIcon = doc.kind === 'project' ? <FileArchive size={12} /> : doc.kind === 'image' ? <FileImage size={12} /> : <FilePlus2 size={12} />

  return (
    <header className="titlebar" data-tauri-drag-region>
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
        <nav className="menubar" aria-label={t('主菜单')}>
          <FileMenu />
          <EditMenu />
          <AdjustMenu />
          <ViewMenu paletteOpen={paletteOpen} onTogglePalette={onTogglePalette} />
          <HelpMenu />
        </nav>
      </div>

      <div className="titlebar__center" data-tauri-drag-region>
        <div className={clsx('doc-chip', doc.dirty && 'is-dirty')}>
          <span className="doc-chip__icon">{docIcon}</span>
          <span className="doc-chip__name">{doc.name}</span>
          <span className="doc-chip__size mono">
            {doc.width}×{doc.height}
          </span>
          {doc.dirty ? <span className="doc-chip__dot" aria-label={t('未保存')} /> : null}
        </div>
      </div>

      <div className="titlebar__right no-drag">
        {!isDesktop ? <span className="web-preview-badge mono">WEB PREVIEW</span> : null}
        <ThemeMenu />
        <span className="build-chip mono">v{version || "0.2.3"}</span>
        <WindowControls />
      </div>
    </header>
  )
}
