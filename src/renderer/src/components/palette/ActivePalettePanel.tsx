import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  Copy,
  Download,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import type { ColorRole, PaletteColor, SortDimension, SortDirection } from '@shared/types'
import { parseHex, rgbaToHex } from '../../core/color'
import { makeId } from '../../core/palette'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import {
  applyForegroundFromPalette,
  deletePaletteCommand,
  extractColorsCommand,
  importPaletteJsonCommand,
  importPalettePngCommand,
  saveActivePaletteCommand
} from '../../commands'
import { Button, IconButton } from '../ui/Button'
import { ColorPickerPopover } from '../ui/ColorPickerPopover'
import { ColorSwatch } from '../ui/ColorSwatch'
import { RangeSlider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { Tooltip } from '../ui/Tooltip'
import { SectionHead } from './SectionHead'
import { useT } from '../../i18n'

const DIMENSION_LABEL: Record<SortDimension, string> = {
  lightness: '明度',
  hue: '色相',
  chroma: '饱和度',
  frequency: '出现频次'
}

const SOURCE_LABEL: Record<string, string> = {
  generated: '生成',
  extracted: '提取',
  manual: '手动'
}

const ROLE_LABEL: Record<ColorRole, string> = {
  shadow: '阴影',
  base: '基色',
  highlight: '高光',
  neutral: '中性'
}

const ROLE_DOT: Record<ColorRole, string> = {
  shadow: '#86b5df',
  base: '#d7f36b',
  highlight: '#edbd7e',
  neutral: '#9b9f92'
}

function SortMenu() {
  const t = useT()
  const { palette, sortState, sortActivePalette } = useWorkbench(
    useShallow((state) => ({
      palette: state.activePalette,
      sortState: state.sortState,
      sortActivePalette: state.sortActivePalette
    }))
  )
  if (!palette) return null
  const activeDimension = sortState === 'custom' ? null : sortState.dimension
  const direction: SortDirection = sortState === 'custom' ? 'asc' : sortState.direction

  const choose = (dimension: SortDimension): void => {
    sortActivePalette(dimension, direction)
  }

  const flipDirection = (): void => {
    if (!activeDimension) return
    sortActivePalette(activeDimension, direction === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className="palette-sort">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="sort-trigger">
            <ArrowUpDown size={12} />
            <span>{activeDimension ? t(DIMENSION_LABEL[activeDimension]) : t('手动顺序')}</span>
            <ChevronDown size={11} className="sort-trigger__chevron" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="menu-content" align="start" sideOffset={5}>
            <div className="menu-heading">{t('排序方式')}</div>
            {(['lightness', 'hue', 'chroma', 'frequency'] as SortDimension[]).map((dimension) => (
              <DropdownMenu.Item
                key={dimension}
                className="menu-item"
                onSelect={() => choose(dimension)}
              >
                <span className="menu-item__icon">
                  {activeDimension === dimension ? <Check size={13} /> : null}
                </span>
                <span className="menu-item__label">{t(DIMENSION_LABEL[dimension])}</span>
                <span className="menu-item__shortcut mono">
                  {activeDimension === dimension ? (direction === 'asc' ? '↑' : '↓') : ''}
                </span>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="menu-separator" />
            <div className="menu-hint">{t('拖拽色块可自定义顺序')}</div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Tooltip content={direction === 'asc' ? '升序' : '降序'} side="top">
        <button
          type="button"
          className="sort-direction"
          aria-label={direction === 'asc' ? '切换为降序' : '切换为升序'}
          disabled={!activeDimension}
          onClick={flipDirection}
        >
          {direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </button>
      </Tooltip>
    </div>
  )
}

function ExtractOptionsPopover() {
  const t = useT()
  const { extractOptions, setExtractOptions, extracting } = useWorkbench(
    useShallow((state) => ({
      extractOptions: state.extractOptions,
      setExtractOptions: state.setExtractOptions,
      extracting: state.extracting
    }))
  )

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="icon-text-button" aria-label={t('提取设置')}>
          <Settings2 size={13} />
          <span>{t('设置')}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="extract-popover" side="top" align="end" sideOffset={9}>
          <div className="extract-popover__head">
            <div>
              <span className="eyebrow">{t('提取')}</span>
              <div className="extract-popover__title">{t('颜色提取设置')}</div>
            </div>
          </div>
          <div className="extract-popover__body">
            <Switch
              checked={extractOptions.includeSemiTransparent}
              onChange={(checked) => setExtractOptions({ includeSemiTransparent: checked })}
              label={t('包含半透明像素')}
            />
            <p className="extract-popover__hint">{t('alpha = 0 的像素始终忽略。关闭后只统计完全不透明像素。')}</p>
            <div className="extract-merge">
              <div className="extract-merge__top">
                <span>{t('颜色合并阈值')}</span>
                <span className="mono">
                  ΔE {extractOptions.mergeThreshold === 0 ? 'OFF' : extractOptions.mergeThreshold.toFixed(3)}
                </span>
              </div>
              <RangeSlider
                min={0}
                max={0.12}
                step={0.005}
                value={extractOptions.mergeThreshold}
                onValueChange={(value) => setExtractOptions({ mergeThreshold: value })}
                aria-label={t('颜色合并阈值')}
              />
              <p className="extract-popover__hint">
                {t('0 为精确去重。大于 0 时在 OKLab 空间合并感知相近的颜色，频次会保留。')}
              </p>
            </div>
            <div className="extract-popover__note">
              {t('提取会创建一张新的当前调色卡，不覆盖已有调色卡。')}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm extract-popover__apply"
            onClick={() => {
              void extractColorsCommand()
            }}
            disabled={extracting}
          >
            <Sparkles size={13} />
            {t('从画布提取')}
          </button>
          <Popover.Arrow className="extract-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function SelectedColorEditor({ index }: { index: number }) {
  const { palette, setPaletteColor, removePaletteColor } = useWorkbench(
    useShallow((state) => ({
      palette: state.activePalette,
      setPaletteColor: state.setPaletteColor,
      removePaletteColor: state.removePaletteColor
    }))
  )
  const toast = useUi((state) => state.toast)
  const color = palette?.colors[index]
  const [hexDraft, setHexDraft] = useState(color ? rgbaToHex(color.rgba).slice(1).toUpperCase() : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (color) setHexDraft(rgbaToHex(color.rgba).slice(1).toUpperCase())
  }, [color?.rgba.r, color?.rgba.g, color?.rgba.b, index])

  if (!palette || !color) return null

  const commitHex = (): void => {
    const parsed = parseHex(hexDraft)
    if (parsed) {
      setPaletteColor(index, { ...parsed, a: color.rgba.a }, color.role)
    } else {
      setHexDraft(rgbaToHex(color.rgba).slice(1).toUpperCase())
    }
  }

  const copyHex = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rgbaToHex(color.rgba).toUpperCase())
      toast('色值已复制', 'success', rgbaToHex(color.rgba).toUpperCase())
    } catch {
      toast('无法访问剪贴板', 'error')
    }
  }

  return (
    <div className="palette-color-editor">
      <ColorPickerPopover
        color={color.rgba}
        onChange={(next) => setPaletteColor(index, next, color.role)}
        title="编辑调色卡颜色"
        side="top"
        align="start"
      >
        <button type="button" className="palette-color-editor__swatch" aria-label="编辑选中颜色">
          <ColorSwatch color={color.rgba} size={27} />
        </button>
      </ColorPickerPopover>
      <div className="palette-color-editor__main">
        <div className="palette-color-editor__field">
          <span className="hash">#</span>
          <input
            ref={inputRef}
            value={hexDraft}
            onChange={(event) => setHexDraft(event.target.value.toUpperCase())}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitHex()
                inputRef.current?.blur()
              }
              if (event.key === 'Escape') {
                setHexDraft(rgbaToHex(color.rgba).slice(1).toUpperCase())
                inputRef.current?.blur()
              }
            }}
            spellCheck={false}
            className="mono"
            aria-label="色值 hex"
          />
        </div>
        <div className="palette-color-editor__meta">
          {color.role ? (
            <span className="palette-role">
              <span className="role-dot" style={{ backgroundColor: ROLE_DOT[color.role] }} />
              {ROLE_LABEL[color.role]}
            </span>
          ) : (
            <span className="palette-role">
              <span className="role-dot" style={{ backgroundColor: '#9b9f92' }} />
              提取色
            </span>
          )}
          {color.count !== undefined ? <span className="mono">×{color.count}</span> : null}
          <span className="mono">{Math.round((color.rgba.a / 255) * 100)}% α</span>
        </div>
      </div>
      <div className="palette-color-editor__actions">
        <Tooltip content="复制 HEX" side="top">
          <button type="button" className="mini-icon-button" onClick={() => void copyHex()} aria-label="复制色值">
            <Copy size={12} />
          </button>
        </Tooltip>
        <Tooltip content="删除这个色块" side="top">
          <button
            type="button"
            className="mini-icon-button mini-icon-button--danger"
            onClick={() => removePaletteColor(index)}
            aria-label="删除色块"
          >
            <Trash2 size={12} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

function PaletteEmptyState() {
  const t = useT()
  const applyRampToPalette = useWorkbench((state) => state.applyRampToPalette)
  const openDialog = useUi((state) => state.openDialog)
  const toast = useUi((state) => state.toast)
  return (
    <div className="palette-empty">
      <div className="palette-empty__art" aria-hidden>
        <span style={{ background: '#212b38' }} />
        <span style={{ background: '#344b52' }} />
        <span style={{ background: '#6d806a' }} />
        <span style={{ background: '#b7ad87' }} />
        <span style={{ background: '#ead7ae' }} />
      </div>
      <div className="palette-empty__copy">
        <div className="eyebrow">{t('无当前调色卡')}</div>
        <h3>{t('还没有当前调色卡')}</h3>
        <p>{t('先从生成器创建一张，或从画布中提取纹理现有的颜色。')}</p>
      </div>
      <div className="palette-empty__actions">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const palette = applyRampToPalette('new')
            if (palette) toast(t('已创建调色卡'), 'success', palette.name)
          }}
        >
          {t('用生成器创建')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void extractColorsCommand()}>
          {t('从画布提取')}
        </Button>
        <button type="button" className="text-button" onClick={() => openDialog('library')}>
          {t('打开调色卡库')}
          <FolderOpen size={12} />
        </button>
      </div>
    </div>
  )
}

export function ActivePalettePanel({
  collapsed = false,
  floating = false,
  onCollapse,
  onFloat
}: {
  collapsed?: boolean
  floating?: boolean
  onCollapse?: () => void
  onFloat?: () => void
}) {
  const t = useT()
  const {
    palette,
    paletteDirty,
    library,
    selectedColorIndex,
    selectedColorSource,
    extractCount,
    extracting,
    renameActivePalette,
    setSelectedColorIndex,
    addPaletteColor,
    reorderPaletteColor,
    createEmptyPalette,
    openPalette
  } = useWorkbench(
    useShallow((state) => ({
      palette: state.activePalette,
      paletteDirty: state.paletteDirty,
      library: state.library,
      selectedColorIndex: state.selectedColorIndex,
      selectedColorSource: state.selectedColorSource,
      extractCount: state.selection,
      extracting: state.extracting,
      renameActivePalette: state.renameActivePalette,
      setSelectedColorIndex: state.setSelectedColorIndex,
      addPaletteColor: state.addPaletteColor,
      reorderPaletteColor: state.reorderPaletteColor,
      createEmptyPalette: state.createEmptyPalette,
      openPalette: state.openPalette
    }))
  )
  const toast = useUi((state) => state.toast)
  const openDialog = useUi((state) => state.openDialog)
  const [nameDraft, setNameDraft] = useState(palette?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const previousPaletteId = useRef<string | null>(null)

  useEffect(() => {
    setNameDraft(palette?.name ?? '')
  }, [palette?.id, palette?.name])

  useEffect(() => {
    const id = palette?.id ?? null
    if (previousPaletteId.current && id && id !== previousPaletteId.current) {
      const timer = window.setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
      previousPaletteId.current = id
      return () => window.clearTimeout(timer)
    }
    previousPaletteId.current = id
    return undefined
  }, [palette?.id])

  useEffect(() => {
    if (selectedColorIndex === null || selectedColorSource === 'wheel') return
    const timer = window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 90)
    return () => window.clearTimeout(timer)
  }, [selectedColorIndex, selectedColorSource])

  const inLibrary = palette ? library.some((entry) => entry.id === palette.id) : false
  const saved = !!palette && inLibrary && !paletteDirty

  const commitName = (): void => {
    if (!palette) return
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== palette.name) renameActivePalette(trimmed)
    else setNameDraft(palette.name)
  }

  const handleSave = async (): Promise<void> => {
    if (!palette) return
    commitName()
    setSaving(true)
    try {
      const savedPalette = await saveActivePaletteCommand()
      if (savedPalette) setNameDraft(savedPalette.name)
    } finally {
      setSaving(false)
    }
  }

  const handleAddColor = (): void => {
    addPaletteColor()
  }

  const selectedColor: PaletteColor | undefined =
    palette && selectedColorIndex !== null ? palette.colors[selectedColorIndex] : undefined
  const selectionLabel = extractCount
    ? t('提取选区 {w}×{h}', { w: extractCount.w, h: extractCount.h })
    : t('从画布提取')

  return (
    <section
      ref={sectionRef}
      className={clsx('panel-section active-palette', collapsed && 'is-collapsed')}
    >
      <SectionHead
        title={t('当前调色卡')}
        collapsed={collapsed}
        floating={floating}
        onCollapse={onCollapse}
        onFloat={onFloat}
        aside={
          palette ? (
            <span className="section-count mono">{t('{count} 色', { count: palette.colors.length })}</span>
          ) : (
            <span className="section-count mono">{t('空')}</span>
          )
        }
      />

      {!palette ? (
        <PaletteEmptyState />
      ) : (
        <div className="active-palette__body">
          <div className="palette-name-row">
            <div className="palette-name-wrap">
              <input
                className="palette-name-input"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitName()
                    ;(event.target as HTMLInputElement).blur()
                  }
                  if (event.key === 'Escape') {
                    setNameDraft(palette.name)
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
                aria-label="调色卡名称"
                spellCheck={false}
              />
              <div className="palette-meta">
                <span className={clsx('source-pill', `source-pill--${palette.source}`)}>
                  {t(SOURCE_LABEL[palette.source])}
                </span>
                <span className="palette-meta__sep">·</span>
                <span>{inLibrary ? (paletteDirty ? t('有未保存修改') : t('已保存到库')) : t('草稿未保存')}</span>
                {paletteDirty || !inLibrary ? <span className="unsaved-dot" /> : null}
              </div>
            </div>
            <Button
              variant={saved ? 'outline' : 'primary'}
              size="sm"
              loading={saving}
              disabled={palette.colors.length === 0}
              leadingIcon={saved ? <Check size={13} /> : <Save size={13} />}
              onClick={() => void handleSave()}
            >
              {saved ? t('已保存') : t('保存')}
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="btn btn--ghost btn--icon-sm" aria-label={t('更多调色卡操作')}>
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu-content" align="end" sideOffset={5}>
                  <DropdownMenu.Item
                    className="menu-item"
                    onSelect={() => {
                      const next = createEmptyPalette()
                      setNameDraft(next.name)
                      toast('已新建空调色卡', 'success')
                    }}
                  >
                    <span className="menu-item__icon"><Plus size={14} /></span>
                    <span className="menu-item__label">{t('新建调色卡')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="menu-item"
                    onSelect={() => {
                      setSelectedColorIndex(null)
                      if (palette) {
                        const copy = {
                          ...palette,
                          id: makeId(),
                          name: `${palette.name} copy`,
                          colors: palette.colors.map((color) => ({ ...color, rgba: { ...color.rgba } })),
                          createdAt: Date.now(),
                          updatedAt: Date.now()
                        }
                        openPalette(copy)
                        toast('已复制为新调色卡', 'success', copy.name)
                      }
                    }}
                  >
                    <span className="menu-item__icon"><Copy size={14} /></span>
                    <span className="menu-item__label">{t('复制为新调色卡')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="menu-separator" />
                  <DropdownMenu.Item className="menu-item" onSelect={() => openDialog('export-palette')}>
                    <span className="menu-item__icon"><Download size={14} /></span>
                    <span className="menu-item__label">{t('导出调色卡…')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="menu-item" onSelect={() => void importPaletteJsonCommand()}>
                    <span className="menu-item__icon"><Upload size={14} /></span>
                    <span className="menu-item__label">{t('导入 JSON…')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="menu-item" onSelect={() => void importPalettePngCommand()}>
                    <span className="menu-item__icon"><FolderOpen size={14} /></span>
                    <span className="menu-item__label">{t('从 PNG 导入…')}</span>
                  </DropdownMenu.Item>
                  {inLibrary ? (
                    <>
                      <DropdownMenu.Separator className="menu-separator" />
                      <DropdownMenu.Item
                        className="menu-item menu-item--danger"
                        onSelect={() => void deletePaletteCommand(palette.id)}
                      >
                        <span className="menu-item__icon"><Trash2 size={14} /></span>
                        <span className="menu-item__label">{t('从调色卡库删除')}</span>
                      </DropdownMenu.Item>
                    </>
                  ) : null}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          <div className="palette-tools-row">
            <SortMenu />
            <ExtractOptionsPopover />
            <div className="palette-tools-row__spacer" />
            <button
              type="button"
              className="extract-button"
              onClick={() => void extractColorsCommand()}
              disabled={extracting}
            >
              <Sparkles size={12} />
              {extracting ? t('提取中…') : selectionLabel}
            </button>
          </div>

          <div className="swatch-block">
            <div className="swatch-block__head">
              <span className="field__label">{t('色块')}</span>
            </div>
            <div
              className="palette-grid"
              onDragLeave={() => setDragOverIndex(null)}
            >
              {palette.colors.map((color, index) => (
                <Tooltip
                  key={`${index}-${rgbaToHex(color.rgba)}`}
                  content={`${rgbaToHex(color.rgba).toUpperCase()}${color.count !== undefined ? ` · ${color.count} px` : ''}`}
                  side="top"
                >
                  <button
                    type="button"
                    className={clsx(
                      'palette-tile',
                      selectedColorIndex === index && 'is-selected',
                      draggingIndex === index && 'is-dragging',
                      dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && 'is-drop-target'
                    )}
                    aria-label={`应用颜色 ${rgbaToHex(color.rgba)}`}
                    draggable
                    onDragStart={(event) => {
                      setDraggingIndex(index)
                      event.dataTransfer.setData('text/plain', rgbaToHex(color.rgba))
                      event.dataTransfer.setData('application/x-pixelramp-palette-index', String(index))
                      event.dataTransfer.effectAllowed = 'copyMove'
                    }}
                    onDragEnd={() => {
                      setDraggingIndex(null)
                      setDragOverIndex(null)
                    }}
                    onDragOver={(event) => {
                      if (draggingIndex === null) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverIndex(index)
                    }}
                    onDrop={(event) => {
                      if (draggingIndex === null) return
                      event.preventDefault()
                      event.stopPropagation()
                      if (draggingIndex !== index) reorderPaletteColor(draggingIndex, index)
                      setDraggingIndex(null)
                      setDragOverIndex(null)
                    }}
                    onClick={() => applyForegroundFromPalette(index)}
                  >
                    <ColorSwatch color={color.rgba} size="100%" />
                  </button>
                </Tooltip>
              ))}
              <Tooltip content="添加当前前景色" side="top">
                <button type="button" className="palette-tile palette-tile--add" onClick={handleAddColor}>
                  <Plus size={14} />
                </button>
              </Tooltip>
            </div>
          </div>

          {selectedColor && selectedColorIndex !== null ? (
            <div ref={editorRef}>
              <SelectedColorEditor index={selectedColorIndex} />
            </div>
          ) : null}

          <div className="palette-footer-actions">
            <button type="button" className="text-button" onClick={() => openDialog('library')}>
              <FolderOpen size={12} />
              {t('调色卡库')}
            </button>
            <span className="palette-footer-actions__sep" />
            <button
              type="button"
              className="text-button"
              onClick={() => openDialog('export-palette')}
            >
              <Download size={12} />
              {t('导出')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
