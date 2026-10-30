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

export function ScaleTextureDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const toast = useUi((state) => state.toast)
  const { doc, scaleTexture } = useWorkbench(
    useShallow((state) => ({ doc: state.doc, scaleTexture: state.scaleTexture }))
  )
  const [percent, setPercent] = useState(100)

  const next = useMemo(() => {
    return {
      width: Math.max(1, Math.min(256, Math.round((doc.width * percent) / 100))),
      height: Math.max(1, Math.min(256, Math.round((doc.height * percent) / 100)))
    }
  }, [doc.height, doc.width, percent])
  const changed = next.width !== doc.width || next.height !== doc.height

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
      description={t('按百分比以最近邻方式缩放所有图层。宽高取整后限制在 1–256 px；历史记录会清空。')}
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
          <span className="texture-scale__value mono">{percent}%</span>
        </div>
        <RangeSlider
          min={10}
          max={400}
          step={5}
          value={percent}
          onValueChange={setPercent}
          aria-label={t('缩放比例')}
        />
        <div className="quick-sizes texture-scale__presets">
          {PRESETS.map((value) => (
            <button
              type="button"
              key={value}
              className={percent === value ? 'quick-size is-active' : 'quick-size'}
              onClick={() => setPercent(value)}
            >
              {value}%
            </button>
          ))}
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
          </div>
        </div>
        <p className="adjust-note">
          {t('缩放后会保持图层栈与可见性；像素使用最近邻采样，不产生平滑颜色。')}
        </p>
      </div>
    </Dialog>
  )
}
