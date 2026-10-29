import { FileImage, FileJson, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { paletteToExportJson } from '../../core/palette'
import { paletteStripPngBytes, type PaletteStripOptions } from '../../core/image'
import { savePaletteJsonCommand, savePalettePngCommand } from '../../commands'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { RangeSlider } from '../ui/Slider'
import { Switch } from '../ui/Switch'

type Format = 'png' | 'json'

export function ExportPaletteDialog() {
  const palette = useWorkbench((state) => state.activePalette)
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const [format, setFormat] = useState<Format>('png')
  const [swatchSize, setSwatchSize] = useState(72)
  const [showHex, setShowHex] = useState(true)
  const [showName, setShowName] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [busy, setBusy] = useState(false)

  const options: PaletteStripOptions = useMemo(
    () => ({ swatchSize, showHex, showName }),
    [swatchSize, showHex, showName]
  )
  const jsonPreview = useMemo(() => (palette ? paletteToExportJson(palette) : ''), [palette])

  useEffect(() => {
    if (!palette || format !== 'png' || palette.colors.length === 0) {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    setPreviewing(true)
    const timer = window.setTimeout(() => {
      void paletteStripPngBytes(palette, options)
        .then((bytes) => {
          if (cancelled) return
          const copy = new Uint8Array(bytes.byteLength)
          copy.set(bytes)
          objectUrl = URL.createObjectURL(new Blob([copy], { type: 'image/png' }))
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current)
            return objectUrl
          })
        })
        .catch(() => {
          if (!cancelled) toast('无法生成预览', 'error')
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false)
        })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [palette, format, options, toast])

  if (!palette) return null

  const handleExport = async (): Promise<void> => {
    setBusy(true)
    try {
      const ok =
        format === 'png'
          ? await savePalettePngCommand(palette, options)
          : await savePaletteJsonCommand(palette)
      if (ok) closeDialog()
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
      eyebrow="EXPORT PALETTE"
      title="导出调色卡"
      description="导出为可分享的 PNG 色卡条，或保留完整生成参数的 JSON 调色卡。"
      width={660}
      footer={
        <>
          <div className="dialog-footer__hint mono">
            {palette.colors.length} COLORS · {format.toUpperCase()}
          </div>
          <Button variant="ghost" onClick={closeDialog}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleExport()}
            loading={busy}
            disabled={palette.colors.length === 0}
            leadingIcon={format === 'png' ? <FileImage size={13} /> : <FileJson size={13} />}
          >
            导出 {format.toUpperCase()}
          </Button>
        </>
      }
    >
      <div className="export-palette">
        <div className="format-tabs" role="tablist" aria-label="导出格式">
          <button
            type="button"
            role="tab"
            aria-selected={format === 'png'}
            className={clsx(format === 'png' && 'is-active')}
            onClick={() => setFormat('png')}
          >
            <FileImage size={14} />
            PNG 色卡条
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={format === 'json'}
            className={clsx(format === 'json' && 'is-active')}
            onClick={() => setFormat('json')}
          >
            <FileJson size={14} />
            JSON 调色卡
          </button>
        </div>

        {format === 'png' ? (
          <div className="export-palette__png">
            <div className="export-palette__preview">
              <div className="export-palette__preview-head">
                <span className="eyebrow">STRIP PREVIEW</span>
                {previewing ? <Loader2 size={12} className="spin" /> : null}
              </div>
              <div className="export-palette__preview-stage">
                {previewUrl ? (
                  <img src={previewUrl} alt="调色卡条预览" />
                ) : (
                  <div className="export-palette__preview-empty mono">
                    {palette.colors.length === 0 ? 'NO COLORS' : 'RENDERING…'}
                  </div>
                )}
              </div>
            </div>
            <div className="export-palette__controls">
              <div className="export-palette__option">
                <div className="export-option-head">
                  <span className="field__label">色块尺寸</span>
                  <span className="mono">{swatchSize}px</span>
                </div>
                <RangeSlider
                  min={40}
                  max={128}
                  step={4}
                  value={swatchSize}
                  onValueChange={setSwatchSize}
                  aria-label="色块尺寸"
                />
              </div>
              <div className="export-palette__switches">
                <Switch checked={showHex} onChange={setShowHex} label="标注 HEX 色值" />
                <Switch checked={showName} onChange={setShowName} label="显示调色卡名称" />
              </div>
              <div className="export-palette__spec mono">
                <span>SWATCH {swatchSize} PX</span>
                <span>GAP 6 PX</span>
                <span>LABELS {showHex ? "ON" : "OFF"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="export-json">
            <div className="export-json__head">
              <span className="eyebrow">PALETTE JSON</span>
              <span className="mono">{jsonPreview.split('\n').length} LINES</span>
            </div>
            <pre className="export-json__preview">{jsonPreview}</pre>
            <p className="export-json__note">
              导出的 JSON 包含颜色、角色、生成参数与来源信息，可直接再导入 PixelRamp。
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
