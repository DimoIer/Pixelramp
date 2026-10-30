import { Grid2X2, ImagePlus, Square } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useUi } from '../../store/ui'
import { createNewCanvasCommand } from '../../commands'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { RangeSlider } from '../ui/Slider'
import { useT } from '../../i18n'

const PRESETS = [
  { size: 8, label: '8 × 8', role: '图标 / 装饰', icon: Grid2X2 },
  { size: 16, label: '16 × 16', role: '物品 / 粒子', icon: Grid2X2 },
  { size: 32, label: '32 × 32', role: '方块面 / 道具', icon: ImagePlus },
  { size: 64, label: '64 × 64', role: '精细纹理', icon: ImagePlus }
]

export function NewCanvasDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const [sizeText, setSizeText] = useState('32')
  const [busy, setBusy] = useState(false)
  const size = Number(sizeText)
  const valid = Number.isInteger(size) && size >= 1 && size <= 256

  const create = async (): Promise<void> => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await createNewCanvasCommand(size, size)
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
      eyebrow="NEW CANVAS"
      title={t('新建像素画布')}
      description={t('选择 Minecraft 常用的方形尺寸，或输入 1–256 之间的自定义边长。')}
      width={590}
      footer={
        <>
          <div className="dialog-footer__hint mono">{t('方形 · 像素完美')}</div>
          <Button variant="ghost" onClick={closeDialog}>
            {t('取消')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void create()}
            disabled={!valid || busy}
            leadingIcon={<Square size={13} />}
          >
            {t('创建画布')}
          </Button>
        </>
      }
    >
      <div className="new-canvas-presets">
        {PRESETS.map((preset) => {
          const Icon = preset.icon
          const selected = size === preset.size
          return (
            <button
              type="button"
              key={preset.size}
              className={clsx('preset-card', selected && 'is-selected')}
              onClick={() => setSizeText(String(preset.size))}
            >
              <span className="preset-card__preview">
                <Icon size={20} strokeWidth={1.4} />
                <span className="preset-card__dot-grid" aria-hidden />
              </span>
              <span className="preset-card__label mono">{preset.label}</span>
              <span className="preset-card__role">{t(preset.role)}</span>
              {selected ? <span className="preset-card__check">✓</span> : null}
            </button>
          )
        })}
      </div>

      <div className="custom-size">
        <div className="custom-size__head">
          <span className="field__label">{t('自定义方形尺寸')}</span>
          <span className="custom-size__value mono">
            {valid ? `${size} × ${size} px` : '1–256 px'}
          </span>
        </div>
        <div className="custom-size__row">
          <RangeSlider
            min={1}
            max={256}
            step={1}
            value={valid ? size : 32}
            onValueChange={(value) => setSizeText(String(value))}
            aria-label={t('画布边长')}
          />
          <label className="size-input">
            <input
              value={sizeText}
              onChange={(event) => {
                const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 3)
                setSizeText(next)
              }}
              spellCheck={false}
              inputMode="numeric"
              aria-label={t('画布边长')}
              className="mono"
            />
            <span>px</span>
          </label>
        </div>
        <div className="custom-size__note">
          <span className="custom-size__preview" aria-hidden>
            <span style={{ width: Math.min(46, Math.max(9, size * 0.35)) }} />
          </span>
          <span>{t('正方形画布，1–256 px。')}</span>
        </div>
      </div>
    </Dialog>
  )
}
