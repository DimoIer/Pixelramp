import { useMemo, useState } from 'react'
import { Scaling } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { RangeSlider } from '../ui/Slider'
import { useT } from '../../i18n'

const PRESETS = [50, 100, 200, 400]
const MIN_SIZE = 1
const MAX_SIZE = 256

function clampSize(value: number): number {
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(value)))
}

export function ScaleTextureDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const { doc, scaleTexture } = useWorkbench(
    useShallow((state) => ({ doc: state.doc, scaleTexture: state.scaleTexture }))
  )
  const [target, setTarget] = useState({
    width: doc.width,
    height: doc.height
  })

  const next = useMemo(
    () => ({
      width: clampSize(target.width),
      height: clampSize(target.height)
    }),
    [target.height, target.width]
  )
  const uniform = next.width * doc.height === next.height * doc.width
  const widthPercent = Math.round((next.width / doc.width) * 100)
  const heightPercent = Math.round((next.height / doc.height) * 100)
  const sliderPercent = uniform ? Math.max(10, Math.min(400, widthPercent)) : 100
  const changed = next.width !== doc.width || next.height !== doc.height

  const setUniformPercent = (percent: number): void => {
    setTarget({
      width: clampSize((doc.width * percent) / 100),
      height: clampSize((doc.height * percent) / 100)
    })
  }

  const setWidth = (value: string): void => {
    setTarget((current) => ({ ...current, width: clampSize(Number(value) || 1) }))
  }

  const setHeight = (value: string): void => {
    setTarget((current) => ({ ...current, height: clampSize(Number(value) || 1) }))
  }

  const apply = (): void => {
    if (!changed) return
    scaleTexture(next.width, next.height)
    closeDialog()
    toast(t('纹理已缩放'), 'success', `${doc.width} × ${doc.height} → ${next.width} × ${next.height}`)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="TEXTURE SCALE"
      title={t('纹理缩放')}
      description={t('按百分比或直接输入目标像素，以最近邻方式缩放所有图层。宽高限制在 1–256 px；历史记录会清空。')}
      width={540}
      footer={
        <>
          <div className="dialog-footer__hint mono">
            {doc.width} × {doc.height} → {next.width} × {next.height}
          </div>
          <Button variant="ghost" onClick={closeDialog}>
            {t('取消')}
          </Button>
          <Button
            variant="primary"
            onClick={apply}
            disabled={!changed}
            leadingIcon={<Scaling size={13} />}
          >
            {t('缩放')}
          </Button>
        </>
      }
    >
      <div className="texture-scale">
        <div className="texture-scale__row">
          <span className="field__label">{t('缩放比例')}</span>
          <span className="texture-scale__value mono">
            {uniform ? `${widthPercent}%` : t('自定义')}
          </span>
        </div>
        <RangeSlider
          min={10}
          max={400}
          step={5}
          value={sliderPercent}
          onValueChange={setUniformPercent}
          aria-label={t('缩放比例')}
        />
        <div className="quick-sizes texture-scale__presets">
          {PRESETS.map((value) => {
            const active =
              uniform &&
              next.width === clampSize((doc.width * value) / 100) &&
              next.height === clampSize((doc.height * value) / 100)
            return (
              <button
                type="button"
                key={value}
                className={active ? 'quick-size is-active' : 'quick-size'}
                onClick={() => setUniformPercent(value)}
              >
                {value}%
              </button>
            )
          })}
        </div>

        <div className="texture-scale__pixels">
          <span className="field__label">{t('目标像素')}</span>
          <div className="texture-scale__pixel-inputs">
            <input
              className="input texture-scale__pixel-input"
              type="number"
              inputMode="numeric"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step={1}
              value={next.width}
              aria-label={t('目标宽度')}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setWidth(event.target.value)}
            />
            <span className="texture-scale__pixel-times">×</span>
            <input
              className="input texture-scale__pixel-input"
              type="number"
              inputMode="numeric"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step={1}
              value={next.height}
              aria-label={t('目标高度')}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setHeight(event.target.value)}
            />
            <span className="texture-scale__pixel-unit">px</span>
          </div>
        </div>

        <div className="texture-scale__sizebox">
          <div>
            <span>{t('原尺寸')}</span>
            <strong className="mono">
              {doc.width} × {doc.height}
            </strong>
          </div>
          <span className="texture-scale__arrow">→</span>
          <div>
            <span>{t('新尺寸')}</span>
            <strong className="mono">
              {next.width} × {next.height}
            </strong>
            {!uniform ? (
              <small className="texture-scale__ratio mono">
                {widthPercent}% × {heightPercent}%
              </small>
            ) : null}
          </div>
        </div>
        <p className="adjust-note">
          {t('缩放后会保持图层栈与可见性；像素使用最近邻采样，不产生平滑颜色。')}
        </p>
      </div>
    </Dialog>
  )
}
