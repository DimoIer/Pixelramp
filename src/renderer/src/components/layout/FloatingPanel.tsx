import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import { GripHorizontal, PanelTopClose } from 'lucide-react'
import clsx from 'clsx'
import { useT } from '../../i18n'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface FloatingPanelProps {
  id: string
  title: string
  initial: Rect
  minWidth: number
  minHeight: number
  initialOnly?: boolean
  children: ReactNode
  onDock: () => void
  shouldDock?: (rect: Rect, clientX: number, clientY: number) => boolean
  className?: string
  actions?: ReactNode
}

const STORAGE_PREFIX = 'pixelramp.float.'

function readRect(id: string, fallback: Rect): Rect {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Rect>
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return fallback
    }
    return {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height
    }
  } catch {
    return fallback
  }
}

function clampRect(rect: Rect, minWidth: number, minHeight: number): Rect {
  const width = Math.max(minWidth, Math.min(window.innerWidth - 16, rect.width))
  const height = Math.max(minHeight, Math.min(window.innerHeight - 48, rect.height))
  return {
    width,
    height,
    x: Math.max(-width + 80, Math.min(window.innerWidth - 80, rect.x)),
    y: Math.max(48, Math.min(window.innerHeight - 60, rect.y))
  }
}

export function FloatingPanel({
  id,
  title,
  initial,
  minWidth,
  minHeight,
  initialOnly = false,
  children,
  onDock,
  shouldDock,
  className,
  actions
}: FloatingPanelProps) {
  const t = useT()
  const [rect, setRect] = useState<Rect>(() =>
    clampRect(initialOnly ? initial : readRect(id, initial), minWidth, minHeight)
  )
  const drag = useRef<{ pointerId: number; startX: number; startY: number; start: Rect } | null>(null)
  const resize = useRef<{ pointerId: number; startX: number; startY: number; start: Rect } | null>(null)

  const save = useCallback(
    (next: Rect) => {
      try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(next))
      } catch {
        // Local storage is optional for panel layout.
      }
    },
    [id]
  )

  useEffect(() => {
    const onResize = (): void => setRect((current) => clampRect(current, minWidth, minHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [minHeight, minWidth])

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if ((event.target as Element).closest('button')) return
    event.preventDefault()
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: rect
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    if (!current) return
    setRect(
      clampRect(
        {
          ...current.start,
          x: current.start.x + event.clientX - current.startX,
          y: current.start.y + event.clientY - current.startY
        },
        minWidth,
        minHeight
      )
    )
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (shouldDock?.(rect, event.clientX, event.clientY)) {
      onDock()
      return
    }
    save(rect)
  }

  const startResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    resize.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: rect
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = resize.current
    if (!current) return
    setRect(
      clampRect(
        {
          ...current.start,
          width: current.start.width + event.clientX - current.startX,
          height: current.start.height + event.clientY - current.startY
        },
        minWidth,
        minHeight
      )
    )
  }

  const endResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!resize.current) return
    resize.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    save(rect)
  }

  return (
    <section
      className={clsx('floating-panel', className)}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-label={title}
    >
      <div
        className="floating-panel__bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripHorizontal size={13} />
        <span>{title}</span>
        {actions ? <div className="floating-panel__actions">{actions}</div> : null}
        <button type="button" className="floating-panel__dock" onClick={onDock} aria-label={t('停靠面板')}>
          <PanelTopClose size={13} />
        </button>
      </div>
      <div className="floating-panel__body">{children}</div>
      <div
        className="floating-panel__resize"
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        aria-hidden
      />
    </section>
  )
}
