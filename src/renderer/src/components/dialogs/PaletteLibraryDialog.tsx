import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Copy,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { cssColor, rgbaToHex } from '../../core/color'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import {
  deletePaletteCommand,
  duplicatePaletteCommand,
  importPaletteJsonCommand,
  importPalettePngCommand,
  loadPaletteFromLibraryCommand,
  saveActivePaletteCommand
} from '../../commands'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

const SOURCE_LABEL: Record<string, string> = {
  generated: '生成',
  extracted: '提取',
  manual: '手动'
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(timestamp))
  } catch {
    return '—'
  }
}

export function PaletteLibraryDialog() {
  const {
    library,
    activePalette,
    paletteDirty,
    libraryLoaded,
    loadLibrary,
    createEmptyPalette
  } = useWorkbench(
    useShallow((state) => ({
      library: state.library,
      activePalette: state.activePalette,
      paletteDirty: state.paletteDirty,
      libraryLoaded: state.libraryLoaded,
      loadLibrary: state.loadLibrary,
      createEmptyPalette: state.createEmptyPalette
    }))
  )
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return library
    return library.filter(
      (palette) =>
        palette.name.toLowerCase().includes(term) ||
        SOURCE_LABEL[palette.source]?.includes(term) ||
        palette.colors.some((color) => rgbaToHex(color.rgba).includes(term))
    )
  }, [library, query])

  const activeIsSaved = !!activePalette && library.some((entry) => entry.id === activePalette.id)

  const createAndSave = async (): Promise<void> => {
    setBusy(true)
    try {
      createEmptyPalette()
      const saved = await saveActivePaletteCommand(true)
      if (saved) toast('已新建并保存调色卡', 'success', saved.name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="PALETTE LIBRARY"
      title="调色卡库"
      description="调色卡独立于画布存在，保存在本机。点击任意卡片载入，或从 PNG / JSON 导入。"
      width={840}
      className="library-dialog"
      footer={
        <>
          <div className="dialog-footer__hint mono">{library.length} SAVED PALETTES</div>
          <Button variant="ghost" onClick={closeDialog}>
            完成
          </Button>
        </>
      }
    >
      <div className="library-toolbar">
        <label className="library-search">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、来源或 HEX…"
            spellCheck={false}
            aria-label="搜索调色卡"
          />
          {query ? (
            <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          ) : null}
        </label>
        <div className="library-toolbar__actions">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus size={13} />}
            onClick={() => void createAndSave()}
            disabled={busy}
          >
            新建
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Upload size={13} />}
            onClick={() => void importPaletteJsonCommand()}
          >
            导入 JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<FolderOpen size={13} />}
            onClick={() => void importPalettePngCommand()}
          >
            从 PNG 导入
          </Button>
        </div>
      </div>

      {activePalette && !activeIsSaved ? (
        <div className="library-draft-banner">
          <span className="library-draft-banner__dot" />
          <div>
            <strong>当前调色卡「{activePalette.name}」尚未进入调色卡库</strong>
            <span>{paletteDirty ? '保存后可在其他画布中复用。' : '这张调色卡来自工程快照。'}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void saveActivePaletteCommand()}
          >
            保存到库
          </Button>
        </div>
      ) : null}

      {!libraryLoaded ? (
        <div className="library-loading">
          <span className="mono">LOADING LOCAL PALETTES…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="library-empty">
          <span className="library-empty__icon">
            <Sparkles size={20} />
          </span>
          <div>
            <h3>{query ? '没有匹配的调色卡' : '调色卡库还是空的'}</h3>
            <p>
              {query
                ? '换一个关键词，或清空搜索。'
                : '把当前调色卡保存到库，或从 PNG / JSON 导入一组颜色。'}
            </p>
          </div>
          {!query ? (
            <Button variant="primary" size="sm" onClick={() => void createAndSave()}>
              新建调色卡
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map((palette) => {
            const active = activePalette?.id === palette.id
            return (
              <div
                key={palette.id}
                className={clsx('library-card', active && 'is-active')}
                role="button"
                tabIndex={0}
                aria-label={`载入调色卡 ${palette.name}`}
                onClick={() => loadPaletteFromLibraryCommand(palette.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    loadPaletteFromLibraryCommand(palette.id)
                  }
                }}
              >
                <div className="library-card__strip">
                  {palette.colors.slice(0, 18).map((color, index) => (
                    <span
                      key={`${palette.id}-${index}`}
                      style={{ background: cssColor(color.rgba) }}
                    />
                  ))}
                  {palette.colors.length > 18 ? (
                    <span className="library-card__more mono">+{palette.colors.length - 18}</span>
                  ) : null}
                </div>
                <div className="library-card__body">
                  <div className="library-card__title-row">
                    <h3>{palette.name}</h3>
                    {active ? <span className="library-card__current mono">CURRENT</span> : null}
                  </div>
                  <div className="library-card__meta">
                    <span className={clsx('source-pill', `source-pill--${palette.source}`)}>
                      {SOURCE_LABEL[palette.source]}
                    </span>
                    <span className="mono">{palette.colors.length} colors</span>
                    <span className="library-card__date mono">{formatDate(palette.updatedAt)}</span>
                  </div>
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className="library-card__menu"
                      aria-label={`更多操作 ${palette.name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="menu-content"
                      align="end"
                      sideOffset={5}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenu.Item
                        className="menu-item"
                        onSelect={() => loadPaletteFromLibraryCommand(palette.id)}
                      >
                        <span className="menu-item__icon"><FolderOpen size={14} /></span>
                        <span className="menu-item__label">载入到当前调色卡</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="menu-item"
                        onSelect={() => void duplicatePaletteCommand(palette.id)}
                      >
                        <span className="menu-item__icon"><Copy size={14} /></span>
                        <span className="menu-item__label">复制一份</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="menu-separator" />
                      <DropdownMenu.Item
                        className="menu-item menu-item--danger"
                        onSelect={() => void deletePaletteCommand(palette.id)}
                      >
                        <span className="menu-item__icon"><Trash2 size={14} /></span>
                        <span className="menu-item__label">删除</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <div className="library-card__load-hint">
                  <span>载入</span>
                  <span className="mono">↵</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
