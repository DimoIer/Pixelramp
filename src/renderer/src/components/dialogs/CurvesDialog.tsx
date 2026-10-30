import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { RotateCcw, Spline } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import {
  applyCurve,
  buildCurveLut,
  type CurvePoint
} from '../../core/adjustments'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { PixelPreview } from './PixelPreview'
import { useT } from '../../i18n'

const DEFAULT_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.75 },
  { x: 1, y: 1 }
]

export function CurvesDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const { doc, applyActiveLayerPixels } = useWorkbench(
    useShallow((state) => ({ doc: state.doc, applyActiveLayerPixels: state.applyActiveLayerPixels }))
  )
  const active = doc.layers[doc.activeLayer]
  const [points, setPoints] = useState<CurvePoint[]>(DEFAULT_POINTS)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragIndex = useRef(-1)

  const lut = useMemo(() => buildCurveLut(points), [points])
  const result = useMemo(
    () => (active ? applyCurve(active.pixels, lut) : new Uint32Array(0)),
    [active, lut]
  )
  const path = useMemo(() => {
    const samples: string[] = []
    for (let index = 0; index < lut.length; index += 4) {
      const x = (index / (lut.length - 1)) * 256
      const y = 256 - (lut[index] / 255) * 256
      samples.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    }
    samples.push(`L 256 ${256 - (lut[lut.length - 1] / 255) * 256}`)
    return samples.join(' ')
  }, [lut])

  if (!active) return null

  const locate = (event: ReactPointerEvent<SVGSVGElement>): number => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return -1
    const x = ((event.clientX - rect.left) / rect.width) * 256
    const y = 256 - ((event.clientY - rect.top) / rect.height) * 256
    let best = -1
    let bestDistance = Infinity
    points.forEach((point, index) => {
      const distance = Math.hypot(point.x * 256 - x, (point.y * 255) - y + 1)
      if (distance < bestDistance) {
        best = index
        bestDistance = distance
      }
    })
    return bestDistance <= 26 ? best : -1
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const index = locate(event)
    if (index < 0) return
    dragIndex.current = index
    svgRef.current?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const index = dragIndex.current
    const rect = svgRef.current?.getBoundingClientRect()
    if (index < 0 || !rect) return
    const y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height))
    setPoints((current) =>
      current.map((point, pointIndex) => (pointIndex === index ? { ...point, y } : point))
    )
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    dragIndex.current = -1
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const apply = (): void => {
    applyActiveLayerPixels(t('调整曲线'), result)
    closeDialog()
    toast(t('曲线已应用'), 'success', active.name)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="CURVES"
      title={t('调整曲线')}
      description={t('拖动控制点调整 RGB 主曲线；应用后可用撤销恢复。')}
      width={650}
      footer={
        <>
          <div className="dialog-footer__hint mono">RGB MASTER · 5 POINTS</div>
          <Button
            variant="ghost"
            onClick={() => setPoints(DEFAULT_POINTS)}
            leadingIcon={<RotateCcw size={13} />}
          >
            {t('重置')}
          </Button>
          <Button variant="ghost" onClick={closeDialog}>
            {t('取消')}
          </Button>
          <Button variant="primary" onClick={apply} leadingIcon={<Spline size={13} />}>
            {t('应用')}
          </Button>
        </>
      }
    >
      <div className="curves-layout">
        <div className="curves-editor">
          <div className="curves-editor__head">
            <span>{t('RGB 主曲线')}</span>
            <span className="mono">0–255</span>
          </div>
          <svg
            ref={svgRef}
            viewBox="0 0 256 256"
            className="curve-svg"
            role="application"
            aria-label={t('RGB 主曲线')}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <rect x="0" y="0" width="256" height="256" className="curve-svg__background" />
            {[0, 64, 128, 192, 256].map((value) => (
              <g key={value}>
                <line x1={value} y1="0" x2={value} y2="256" className="curve-svg__grid" />
                <line x1="0" y1={value} x2="256" y2={value} className="curve-svg__grid" />
              </g>
            ))}
            <line x1="0" y1="256" x2="256" y2="0" className="curve-svg__diagonal" />
            <path d={path} className="curve-svg__path" />
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x * 256}
                cy={256 - point.y * 256}
                r="6"
                className="curve-svg__point"
              />
            ))}
          </svg>
          <div className="curves-editor__axis mono">
            <span>0</span>
            <span>INPUT</span>
            <span>255</span>
          </div>
        </div>
        <div className="curves-preview">
          <PixelPreview pixels={result} width={doc.width} height={doc.height} />
          <div className="adjust-preview__meta mono">
            <span>
              {doc.width} × {doc.height}
            </span>
            <span>{t('当前图层预览')}</span>
          </div>
          <p className="adjust-note">{t('曲线只作用于当前图层，不修改调色卡。')}</p>
        </div>
      </div>
    </Dialog>
  )
}
