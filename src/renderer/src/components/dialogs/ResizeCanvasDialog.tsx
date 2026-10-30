import { useState } from 'react'
import clsx from 'clsx'
import { Scaling } from 'lucide-react'
import { useWorkbench, type ResizeAnchor } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { useT } from '../../i18n'

const ANCHORS: Array<{ id: ResizeAnchor; label: string; x: number; y: number }> = [
  { id: 'top-left', label: '左上', x: 0, y: 0 },
  { id: 'top', label: '上', x: 1, y: 0 },
  { id: 'top-right', label: '右上', x: 2, y: 0 },
  { id: 'left', label: '左', x: 0, y: 1 },
  { id: 'center', label: '居中', x: 1, y: 1 },
  { id: 'right', label: '右', x: 2, y: 1 },
  { id: 'bottom-left', label: '左下', x: 0, y: 2 },
  { id: 'bottom', label: '下', x: 1, y: 2 },
  { id: 'bottom-right', label: '右下', x: 2, y: 2 }
]

export function ResizeCanvasDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const { doc, resizeDocument } = useWorkbench()
  const [width, setWidth] = useState(String(doc.width))
  const [height, setHeight] = useState(String(doc.height))
  const [anchor, setAnchor] = useState<ResizeAnchor>('center')

  const nextWidth = Number(width)
  const nextHeight = Number(height)
  const valid =
    Number.isInteger(nextWidth) &&
    Number.isInteger(nextHeight) &&
    nextWidth >= 1 &&
    nextWidth <= 256 &&
    nextHeight >= 1 &&
    nextHeight <= 256
  const changed = nextWidth !== doc.width || nextHeight !== doc.height

  const apply = (): void => {
    if (!valid || !changed) return
    resizeDocument(nextWidth, nextHeight, anchor)
    closeDialog()
    toast(t('画布大小已调整'), 'success', `${nextWidth} × ${nextHeight} · ${t(ANCHORS.find((entry) => entry.id === anchor)?.label ?? anchor)}`)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="CANVAS SIZE"
      title={t('调整画布大小')}
      description={t('裁剪或扩展画布，不缩放像素。超出边界的像素会被裁掉；历史记录会清空。')}
      width={520}
      footer={
        <>
          <div className="dialog-footer__hint mono">
            {doc.width} × {doc.height} → {valid ? `${nextWidth} × ${nextHeight}` : '—'}
          </div>
          <Button variant="ghost" onClick={closeDialog}>
            {t('取消')}
          </Button>
          <Button
            variant="primary"
            onClick={apply}
            disabled={!valid || !changed}
            leadingIcon={<Scaling size={13} />}
          >
            {t('应用')}
          </Button>
        </>
      }
    >
      <div className="resize-canvas">
        <div className="resize-canvas__fields">
          <label className="field">
            <span className="field__label">{t('宽度')}</span>
            <span className="size-input">
              <input
                className="mono"
                inputMode="numeric"
                value={width}
                onChange={(event) =>
                  setWidth(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                }
                aria-label={t('画布宽度')}
              />
              <span>px</span>
            </span>
          </label>
          <span className="resize-canvas__times">×</span>
          <label className="field">
            <span className="field__label">{t('高度')}</span>
            <span className="size-input">
              <input
                className="mono"
                inputMode="numeric"
                value={height}
                onChange={(event) =>
                  setHeight(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                }
                aria-label={t('画布高度')}
              />
              <span>px</span>
            </span>
          </label>
          <span className="resize-canvas__range mono">1–256 px</span>
        </div>

        <div className="resize-canvas__anchor">
          <div>
            <span className="field__label">{t('锚点')}</span>
            <p className="resize-canvas__hint">{t('选择原画布在新画布中的位置。')}</p>
          </div>
          <div className="anchor-grid" role="radiogroup" aria-label={t('画布锚点')}>
            {ANCHORS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={anchor === entry.id}
                aria-label={t(entry.label)}
                className={clsx('anchor-grid__cell', anchor === entry.id && 'is-selected')}
                style={{ gridColumn: entry.x + 1, gridRow: entry.y + 1 }}
                onClick={() => setAnchor(entry.id)}
              >
                <span />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
