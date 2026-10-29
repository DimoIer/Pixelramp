import { Crop, Scaling } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { useUi } from '../../store/ui'
import { confirmPendingImage } from '../../commands'
import { prepareImportedPixels } from '../../core/pixels'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { RangeSlider } from '../ui/Slider'

const QUICK_SIZES = [16, 32, 64, 128, 256]

export function ImageImportDialog() {
  const pending = useUi((state) => state.pendingImage)
  const closeDialog = useUi((state) => state.closeDialog)
  const nonSquare = !!pending && pending.width !== pending.height
  const [mode, setMode] = useState<'crop' | 'scale'>(nonSquare ? 'crop' : 'scale')
  const [size, setSize] = useState(() => {
    if (!pending) return 32
    return nonSquare
      ? Math.min(256, Math.min(pending.width, pending.height))
      : Math.min(256, pending.width)
  })
  const [busy, setBusy] = useState(false)

  const drawPreview = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !pending) return
      const context = canvas.getContext('2d')
      if (!context) return
      const previewSize = 160
      const pixels = prepareImportedPixels(
        pending.pixels,
        pending.width,
        pending.height,
        previewSize,
        mode
      )
      const imageData = new ImageData(previewSize, previewSize)
      new Uint32Array(imageData.data.buffer).set(pixels)
      context.clearRect(0, 0, previewSize, previewSize)
      context.imageSmoothingEnabled = false
      context.putImageData(imageData, 0, 0)
    },
    [pending, mode]
  )

  useEffect(() => {
    if (!pending) return
    const square = pending.width === pending.height
    setMode(square ? 'scale' : 'crop')
    setSize(
      square
        ? Math.max(1, Math.min(256, pending.width))
        : Math.max(1, Math.min(256, Math.min(pending.width, pending.height)))
    )
  }, [pending?.path, pending?.width, pending?.height])

  if (!pending) return null

  const setModeAndDefaults = (next: 'crop' | 'scale'): void => {
    setMode(next)
    if (next === 'crop') {
      setSize(Math.max(1, Math.min(256, Math.min(pending.width, pending.height))))
    } else {
      setSize(Math.max(1, Math.min(256, Math.max(pending.width, pending.height))))
    }
  }

  const handleImport = async (): Promise<void> => {
    setBusy(true)
    try {
      await confirmPendingImage(mode, size)
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
      eyebrow="IMPORT TEXTURE"
      title="将图像放入画布"
      description={
        nonSquare
          ? '源图像不是正方形。请选择居中裁剪或最近邻拉伸，再决定输出尺寸。'
          : '源图像超过画布尺寸上限。请选择目标尺寸，缩放全程使用最近邻。'
      }
      width={690}
      footer={
        <>
          <div className="dialog-footer__hint mono">
            {pending.width} × {pending.height} → {size} × {size}
          </div>
          <Button variant="ghost" onClick={closeDialog}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void handleImport()} loading={busy}>
            载入画布
          </Button>
        </>
      }
    >
      <div className="image-import-layout">
        <div className="image-import-preview">
          <div className="image-import-preview__frame">
            <canvas ref={drawPreview} width={160} height={160} />
          </div>
          <div className="image-import-preview__caption">
            <span className="mono">PREVIEW</span>
            <span>{pending.name}</span>
          </div>
          <div className="image-import-preview__resolution mono">
            <span>SRC {pending.width}×{pending.height}</span>
            <span>OUT {size}×{size}</span>
          </div>
        </div>

        <div className="image-import-controls">
          <div className="image-import-mode">
            <span className="field__label">处理方式</span>
            {nonSquare ? (
              <button
                type="button"
                className={clsx('import-mode-card', mode === 'crop' && 'is-selected')}
                onClick={() => setModeAndDefaults('crop')}
              >
                <span className="import-mode-card__icon">
                  <Crop size={16} />
                </span>
                <span>
                  <strong>居中裁剪</strong>
                  <small>保留图像中心最大的正方形区域</small>
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={clsx('import-mode-card', mode === 'scale' && 'is-selected')}
              onClick={() => setModeAndDefaults('scale')}
            >
              <span className="import-mode-card__icon">
                <Scaling size={16} />
              </span>
              <span>
                <strong>拉伸缩放到正方形</strong>
                <small>最近邻取样，不产生平滑像素</small>
              </span>
            </button>
          </div>

          <div className="image-import-size">
            <div className="image-import-size__head">
              <span className="field__label">输出尺寸</span>
              <span className="mono">
                {size} × {size}
              </span>
            </div>
            <RangeSlider
              min={1}
              max={256}
              step={1}
              value={size}
              onValueChange={setSize}
              aria-label="输出尺寸"
            />
            <div className="quick-sizes">
              {QUICK_SIZES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={clsx('quick-size', size === value && 'is-active')}
                  onClick={() => setSize(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="image-import-note">
            <span className="image-import-note__icon mono">NN</span>
            <p>
              图像会以最近邻方式重采样。源图中每个像素只映射为整数块，不会混入相邻颜色。
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
