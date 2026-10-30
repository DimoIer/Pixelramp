import { ChevronDown, ChevronUp, FolderOpen, PanelRightClose, PictureInPicture2 } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Tooltip } from '../ui/Tooltip'
import { FloatingPanel } from '../layout/FloatingPanel'
import { createDragGhost, type DragGhost } from '../layout/dragGhost'
import { GeneratorPanel } from './GeneratorPanel'
import { ActivePalettePanel } from './ActivePalettePanel'
import { useT } from '../../i18n'

interface PalettePanelProps {
  open: boolean
  onClose: () => void
  onFloat?: () => void
  floating?: boolean
}

export function PalettePanel({ open, onClose, onFloat, floating = false }: PalettePanelProps) {
  const t = useT()
  const library = useWorkbench((state) => state.library)
  const activePalette = useWorkbench((state) => state.activePalette)
  const openDialog = useUi((state) => state.openDialog)
  const [generatorCollapsed, setGeneratorCollapsed] = useState(false)
  const [activeCollapsed, setActiveCollapsed] = useState(false)
  const [generatorFloating, setGeneratorFloating] = useState(false)
  const [activeFloating, setActiveFloating] = useState(false)
  const [generatorDockHeight, setGeneratorDockHeight] = useState(220)
  const [activeDockHeight, setActiveDockHeight] = useState(220)
  const [generatorSpawn, setGeneratorSpawn] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [activeSpawn, setActiveSpawn] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [sectionDockHint, setSectionDockHint] = useState<'generator' | 'active' | null>(null)
  const [sectionOrder, setSectionOrder] = useState<'generator' | 'active'>('generator')
  const paletteRef = useRef<HTMLElement>(null)
  const sectionDrag = useRef<{
    section: 'generator' | 'active'
    pointerId: number
    startX: number
    startY: number
    source: HTMLElement
    ghost: DragGhost | null
    lastTarget: string | null
  } | null>(null)

  const overPalette = (x: number, y: number): boolean => {
    const rect = paletteRef.current?.getBoundingClientRect()
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  const floatGenerator = (): void => {
    const element = paletteRef.current?.querySelector('[data-section="generator"]')
    if (element) {
      const rect = element.getBoundingClientRect()
      setGeneratorDockHeight(rect.height)
      setGeneratorSpawn({ x: 200, y: 120, width: rect.width, height: rect.height })
    }
    setGeneratorFloating(true)
  }

  const floatActive = (): void => {
    const element = paletteRef.current?.querySelector('[data-section="active"]')
    if (element) {
      const rect = element.getBoundingClientRect()
      setActiveDockHeight(rect.height)
      setActiveSpawn({ x: 230, y: 150, width: rect.width, height: rect.height })
    }
    setActiveFloating(true)
  }

  const startSectionPress = (
    section: 'generator' | 'active',
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    const target = event.target as Element
    if (!target.closest('.section-head') || target.closest('button')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    sectionDrag.current = {
      section,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      source: event.currentTarget,
      ghost: null,
      lastTarget: null
    }
  }

  const moveSectionPress = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = sectionDrag.current
    if (!current) return
    if (!current.ghost) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return
      current.ghost = createDragGhost(current.source, event.clientX, event.clientY)
      current.source.classList.add('panel-drag-source')
    }
    current.ghost.move(event.clientX, event.clientY)
  }

  const endSectionPress = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false
  ): void => {
    const current = sectionDrag.current
    sectionDrag.current = null
    if (!current) return
    if (event.currentTarget.hasPointerCapture(current.pointerId)) {
      event.currentTarget.releasePointerCapture(current.pointerId)
    }
    current.ghost?.remove()
    current.source.classList.remove('panel-drag-source')
    if (!current.ghost || cancelled) return
    const droppedOn = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-section]')
      ?.getAttribute('data-section')
    if (droppedOn && droppedOn !== current.section) {
      setSectionOrder(current.section === 'generator' ? 'active' : 'generator')
      return
    }
    if (!overPalette(event.clientX, event.clientY)) {
      if (current.section === 'generator') {
        const rect = current.source.getBoundingClientRect()
        setGeneratorDockHeight(rect.height)
        setGeneratorSpawn({
          x: event.clientX - 34,
          y: event.clientY - 18,
          width: rect.width,
          height: rect.height
        })
        setGeneratorFloating(true)
      } else {
        const rect = current.source.getBoundingClientRect()
        setActiveDockHeight(rect.height)
        setActiveSpawn({
          x: event.clientX - 34,
          y: event.clientY - 18,
          width: rect.width,
          height: rect.height
        })
        setActiveFloating(true)
      }
    }
  }


  const sectionDockPlaceholder = (section: 'generator' | 'active') => (
    <div
      className="section-dock-placeholder"
      style={{ height: section === 'generator' ? generatorDockHeight : activeDockHeight }}
    >
      <span className="section-dock-placeholder__title">
        {section === 'generator' ? t('色阶生成器') : t('当前调色卡')}
      </span>
      <span className="section-dock-placeholder__hint">{t('松开以停靠')}</span>
    </div>
  )

  return (
    <>
    <aside ref={paletteRef} className={clsx('palette-panel', !open && 'is-collapsed', sectionDockHint && 'is-dock-target')} aria-label={t('调色卡工作区')}>
      <header className="palette-panel__header">
        <div className="palette-panel__brand">
          <span className="palette-panel__spine" aria-hidden>
            <span style={{ background: activePalette?.colors[0] ? `rgb(${activePalette.colors[0].rgba.r},${activePalette.colors[0].rgba.g},${activePalette.colors[0].rgba.b})` : '#343a2c' }} />
            <span style={{ background: activePalette?.colors[1] ? `rgb(${activePalette.colors[1].rgba.r},${activePalette.colors[1].rgba.g},${activePalette.colors[1].rgba.b})` : '#59654a' }} />
            <span style={{ background: activePalette?.colors[Math.floor((activePalette?.colors.length ?? 1) / 2)] ? `rgb(${activePalette.colors[Math.floor(activePalette.colors.length / 2)].rgba.r},${activePalette.colors[Math.floor(activePalette.colors.length / 2)].rgba.g},${activePalette.colors[Math.floor(activePalette.colors.length / 2)].rgba.b})` : '#9ca372' }} />
            <span style={{ background: activePalette?.colors[activePalette.colors.length - 1] ? `rgb(${activePalette.colors[activePalette.colors.length - 1].rgba.r},${activePalette.colors[activePalette.colors.length - 1].rgba.g},${activePalette.colors[activePalette.colors.length - 1].rgba.b})` : '#d8c79b' }} />
          </span>
          <div>
            <h1 className="palette-panel__title">{t('调色卡工作台')}</h1>
          </div>
        </div>
        <div className="palette-panel__actions">
          <Tooltip content={t('打开调色卡库')} side="bottom">
            <button type="button" className="library-button" onClick={() => openDialog('library')}>
              <FolderOpen size={13} />
              <span>{t('库')}</span>
              <span className="library-button__count mono">{library.length}</span>
            </button>
          </Tooltip>
          <Tooltip content={t('收起面板')} side="bottom">
            <button type="button" className="panel-collapse" aria-label={t('收起调色卡面板')} onClick={onClose}>
              <PanelRightClose size={15} />
            </button>
          </Tooltip>
          {onFloat && !floating ? (
            <Tooltip
              content={t('悬浮调色卡工作台')}
              side="bottom"
            >
              <button
                type="button"
                className="panel-collapse"
                aria-label={t('悬浮调色卡工作台')}
                onClick={onFloat}
              >
                <PictureInPicture2 size={15} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </header>
      <div className="palette-panel__scroll">
        {sectionOrder === 'generator' ? (
          <>
            {generatorFloating ? (
              sectionDockHint === 'generator' ? sectionDockPlaceholder('generator') : null
            ) : (
              <div
                className="palette-section"
                data-section="generator"
                onPointerDown={(event) => startSectionPress('generator', event)}
                onPointerMove={moveSectionPress}
                onPointerUp={endSectionPress}
                onPointerCancel={(event) => endSectionPress(event, true)}
              >
                <GeneratorPanel
                  collapsed={generatorCollapsed}
                  onCollapse={() => setGeneratorCollapsed((value) => !value)}
                  onFloat={floatGenerator}
                />
              </div>
            )}
            {activeFloating ? (
              sectionDockHint === 'active' ? sectionDockPlaceholder('active') : null
            ) : (
              <div
                className="palette-section"
                data-section="active"
                onPointerDown={(event) => startSectionPress('active', event)}
                onPointerMove={moveSectionPress}
                onPointerUp={endSectionPress}
                onPointerCancel={(event) => endSectionPress(event, true)}
              >
                <ActivePalettePanel
                  collapsed={activeCollapsed}
                  onCollapse={() => setActiveCollapsed((value) => !value)}
                  onFloat={floatActive}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {activeFloating ? (
              sectionDockHint === 'active' ? sectionDockPlaceholder('active') : null
            ) : (
              <div
                className="palette-section"
                data-section="active"
                onPointerDown={(event) => startSectionPress('active', event)}
                onPointerMove={moveSectionPress}
                onPointerUp={endSectionPress}
                onPointerCancel={(event) => endSectionPress(event, true)}
              >
                <ActivePalettePanel
                  collapsed={activeCollapsed}
                  onCollapse={() => setActiveCollapsed((value) => !value)}
                  onFloat={floatActive}
                />
              </div>
            )}
            {generatorFloating ? (
              sectionDockHint === 'generator' ? sectionDockPlaceholder('generator') : null
            ) : (
              <div
                className="palette-section"
                data-section="generator"
                onPointerDown={(event) => startSectionPress('generator', event)}
                onPointerMove={moveSectionPress}
                onPointerUp={endSectionPress}
                onPointerCancel={(event) => endSectionPress(event, true)}
              >
                <GeneratorPanel
                  collapsed={generatorCollapsed}
                  onCollapse={() => setGeneratorCollapsed((value) => !value)}
                  onFloat={floatGenerator}
                />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
    {generatorFloating ? (
      <FloatingPanel
        id="generator"
        title={t('色阶生成器')}
        initial={
          generatorSpawn
            ? {
                x: generatorSpawn.x,
                y: generatorSpawn.y,
                width: generatorSpawn.width,
                height: generatorSpawn.height
              }
            : { x: 200, y: 120, width: 420, height: 680 }
        }
        initialOnly={!!generatorSpawn}
        minWidth={300}
        minHeight={160}
        onDock={() => {
          setGeneratorFloating(false)
          setGeneratorSpawn(null)
          setSectionDockHint(null)
        }}
        shouldDock={(_rect, clientX, clientY) => overPalette(clientX, clientY)}
        onDragStart={() => setSectionDockHint(null)}
        onDragMove={(clientX, clientY) =>
          setSectionDockHint(overPalette(clientX, clientY) ? 'generator' : null)
        }
        onDragEnd={() => setSectionDockHint(null)}
        actions={
          <button
            type="button"
            className="floating-panel__action"
            aria-label={generatorCollapsed ? t('展开') : t('收起')}
            title={generatorCollapsed ? t('展开') : t('收起')}
            onClick={() => setGeneratorCollapsed((value) => !value)}
          >
            {generatorCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        }
      >
        <div className="floating-section">
          <GeneratorPanel
            floating
            collapsed={generatorCollapsed}
            onCollapse={() => setGeneratorCollapsed((value) => !value)}
            onFloat={() => setGeneratorFloating(false)}
          />
        </div>
      </FloatingPanel>
    ) : null}
    {activeFloating ? (
      <FloatingPanel
        id="active-palette"
        title={t('当前调色卡')}
        initial={
          activeSpawn
            ? {
                x: activeSpawn.x,
                y: activeSpawn.y,
                width: activeSpawn.width,
                height: activeSpawn.height
              }
            : { x: 230, y: 150, width: 430, height: 680 }
        }
        initialOnly={!!activeSpawn}
        minWidth={300}
        minHeight={160}
        onDock={() => {
          setActiveFloating(false)
          setActiveSpawn(null)
          setSectionDockHint(null)
        }}
        shouldDock={(_rect, clientX, clientY) => overPalette(clientX, clientY)}
        onDragStart={() => setSectionDockHint(null)}
        onDragMove={(clientX, clientY) =>
          setSectionDockHint(overPalette(clientX, clientY) ? 'active' : null)
        }
        onDragEnd={() => setSectionDockHint(null)}
        actions={
          <button
            type="button"
            className="floating-panel__action"
            aria-label={activeCollapsed ? t('展开') : t('收起')}
            title={activeCollapsed ? t('展开') : t('收起')}
            onClick={() => setActiveCollapsed((value) => !value)}
          >
            {activeCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        }
      >
        <div className="floating-section">
          <ActivePalettePanel
            floating
            collapsed={activeCollapsed}
            onCollapse={() => setActiveCollapsed((value) => !value)}
            onFloat={() => setActiveFloating(false)}
          />
        </div>
      </FloatingPanel>
    ) : null}
    </>
  )
}
