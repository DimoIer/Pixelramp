import { useMemo, useState } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import {
  adjustBrightnessContrast,
  adjustHueSaturation,
  adjustOpacity
} from '../../core/adjustments'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { RangeSlider, SliderRow } from '../ui/Slider'
import { PixelPreview } from './PixelPreview'
import { useT } from '../../i18n'

export type AdjustmentMode = 'brightness-contrast' | 'hue-saturation' | 'opacity'

interface AdjustmentDialogProps {
  mode: AdjustmentMode
}

export function AdjustmentDialog({ mode }: AdjustmentDialogProps) {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const { doc, applyActiveLayerPixels } = useWorkbench(
    useShallow((state) => ({ doc: state.doc, applyActiveLayerPixels: state.applyActiveLayerPixels }))
  )
  const active = doc.layers[doc.activeLayer]
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [opacity, setOpacity] = useState(100)

  const result = useMemo(() => {
    if (!active) return new Uint32Array(0)
    if (mode === 'brightness-contrast') {
      return adjustBrightnessContrast(active.pixels, brightness, contrast)
    }
    if (mode === 'hue-saturation') {
      return adjustHueSaturation(active.pixels, hue, saturation)
    }
    return adjustOpacity(active.pixels, opacity)
  }, [active, brightness, contrast, hue, mode, opacity, saturation])

  if (!active) return null

  const reset = (): void => {
    setBrightness(0)
    setContrast(0)
    setHue(0)
    setSaturation(0)
    setOpacity(100)
  }

  const apply = (): void => {
    const labels: Record<AdjustmentMode, string> = {
      'brightness-contrast': t('调整亮度和对比度'),
      'hue-saturation': t('调整饱和度和色调'),
      opacity: t('调整不透明度')
    }
    applyActiveLayerPixels(labels[mode], result)
    closeDialog()
    toast(t('图层调整已应用'), 'success', active.name)
  }

  const title =
    mode === 'brightness-contrast'
      ? t('调整亮度和对比度')
      : mode === 'hue-saturation'
        ? t('调整饱和度和色调')
        : t('调整不透明度')

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="IMAGE ADJUST"
      title={title}
      description={t('调整当前图层「{name}」。应用后可用撤销恢复。', { name: active.name })}
      width={610}
      footer={
        <>
          <div className="dialog-footer__hint mono">
            {doc.width} × {doc.height} · {active.name}
          </div>
          <Button variant="ghost" onClick={reset} leadingIcon={<RotateCcw size={13} />}>
            {t('重置')}
          </Button>
          <Button variant="ghost" onClick={closeDialog}>
            {t('取消')}
          </Button>
          <Button variant="primary" onClick={apply} leadingIcon={<SlidersHorizontal size={13} />}>
            {t('应用')}
          </Button>
        </>
      }
    >
      <div className="adjust-layout">
        <div className="adjust-preview">
          <PixelPreview pixels={result} width={doc.width} height={doc.height} />
          <div className="adjust-preview__meta mono">
            <span>
              {doc.width} × {doc.height}
            </span>
            <span>{t('当前图层预览')}</span>
          </div>
        </div>
        <div className="adjust-controls">
          {mode === 'brightness-contrast' ? (
            <>
              <SliderRow label={t('亮度')} value={`${brightness > 0 ? '+' : ''}${brightness}`}>
                <RangeSlider
                  min={-100}
                  max={100}
                  value={brightness}
                  onValueChange={setBrightness}
                  aria-label={t('亮度')}
                />
              </SliderRow>
              <SliderRow label={t('对比度')} value={`${contrast > 0 ? '+' : ''}${contrast}`}>
                <RangeSlider
                  min={-100}
                  max={100}
                  value={contrast}
                  onValueChange={setContrast}
                  aria-label={t('对比度')}
                />
              </SliderRow>
            </>
          ) : null}
          {mode === 'hue-saturation' ? (
            <>
              <SliderRow label={t('色相偏移')} value={`${hue > 0 ? '+' : ''}${hue}°`}>
                <RangeSlider
                  min={-180}
                  max={180}
                  value={hue}
                  onValueChange={setHue}
                  aria-label={t('色相偏移')}
                />
              </SliderRow>
              <SliderRow label={t('饱和度')} value={`${saturation > 0 ? '+' : ''}${saturation}`}>
                <RangeSlider
                  min={-100}
                  max={100}
                  value={saturation}
                  onValueChange={setSaturation}
                  aria-label={t('饱和度')}
                />
              </SliderRow>
            </>
          ) : null}
          {mode === 'opacity' ? (
            <SliderRow label={t('不透明度')} value={`${opacity}%`}>
              <RangeSlider
                min={0}
                max={100}
                value={opacity}
                onValueChange={setOpacity}
                aria-label={t('不透明度')}
              />
            </SliderRow>
          ) : null}
          <p className="adjust-note">
            {mode === 'opacity'
              ? t('不透明度会乘以当前图层每个像素的 alpha；透明像素保持透明。')
              : t('调整仅作用于当前图层，不修改调色卡或其他图层。')}
          </p>
        </div>
      </div>
    </Dialog>
  )
}
