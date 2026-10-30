import { FileImage, ImageDown, MonitorDown } from 'lucide-react'
import { useCallback, useState } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { flattenLayers } from '../../core/pixels'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { exportPngCommand } from '../../commands'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { useT } from '../../i18n'

const SCALES = [1, 2, 4, 8, 16]

export function ExportImageDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const { doc, revision } = useWorkbench(
    useShallow((state) => ({ doc: state.doc, revision: state.revision }))
  )
  const [scale, setScale] = useState(1)
  const [busy, setBusy] = useState(false)

  const drawPreview = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const pixels = flattenLayers(doc.layers, doc.width, doc.height)
      const imageData = new ImageData(doc.width, doc.height)
      new Uint32Array(imageData.data.buffer).set(pixels)
      canvas.width = doc.width
      canvas.height = doc.height
      const context = canvas.getContext('2d')
      if (!context) return
      context.imageSmoothingEnabled = false
      context.putImageData(imageData, 0, 0)
    },
    [doc, revision]
  )

  const handleExport = async (): Promise<void> => {
    setBusy(true)
    try {
      await exportPngCommand(scale)
      closeDialog()
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
      eyebrow="EXPORT IMAGE"
      title="导出 PNG"
      description="按整数倍放大导出，每个源像素变成等大的纯色方块；不进行任何插值。"
      width={540}
      footer={
        <>
          <div className="dialog-footer__hint mono">
            {doc.width * scale} × {doc.height * scale} {t('像素')}
          </div>
          <Button variant="ghost" onClick={closeDialog}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleExport()}
            loading={busy}
            leadingIcon={<ImageDown size={13} />}
          >
            导出 PNG
          </Button>
        </>
      }
    >
      <div className="export-image">
        <div className="export-image__preview">
          <div className="export-image__checker">
            <canvas ref={drawPreview} className="export-image__canvas" />
          </div>
          <div className="export-image__meta">
            <span className="mono">{doc.name}.png</span>
            <span className="mono">
              {doc.width * scale} × {doc.height * scale}
            </span>
          </div>
        </div>

        <div className="export-image__options">
          <div className="export-option-head">
            <span className="field__label">导出倍率</span>
            <span className="mono">{scale}×</span>
          </div>
          <div className="export-scale-grid">
            {SCALES.map((value) => (
              <button
                type="button"
                key={value}
                className={clsx('export-scale', scale === value && 'is-active')}
                onClick={() => setScale(value)}
              >
                <strong>{value}×</strong>
                <span className="mono">
                  {doc.width * value}×{doc.height * value}
                </span>
              </button>
            ))}
          </div>
          <div className="export-image__note">
            <MonitorDown size={13} />
            <p>
              1× 导出保留原始纹理尺寸，适合直接放回资源包。放大倍数仅供展示、预览或社交分享。
            </p>
          </div>
          <div className="export-image__filetype">
            <FileImage size={14} />
            <div>
              <strong>{t('便携式网络图形')}</strong>
              <span className="mono">{t('PNG · 无损 RGBA')}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
