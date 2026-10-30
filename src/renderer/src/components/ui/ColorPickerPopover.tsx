import * as Popover from '@radix-ui/react-popover'
import { Check, Pipette } from 'lucide-react'
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { HexColorPicker } from 'react-colorful'
import type { RGBA } from '@shared/types'
import { cssColor, rgbaToHex, parseHex } from '../../core/color'
import { useT } from '../../i18n'
import { ColorSwatch } from './ColorSwatch'

interface ColorPickerPopoverProps {
  color: RGBA
  onChange: (color: RGBA) => void
  children: ReactNode
  title?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  disabled?: boolean
}

export function ColorPickerPopover({
  color,
  onChange,
  children,
  title,
  align = 'start',
  side = 'bottom',
  disabled = false
}: ColorPickerPopoverProps) {
  const t = useT()
  const resolvedTitle = title ?? t('选择颜色')
  const [open, setOpen] = useState(false)
  const [hexText, setHexText] = useState(rgbaToHex(color))
  const alphaId = useId()

  useEffect(() => {
    setHexText(rgbaToHex(color))
  }, [color.r, color.g, color.b])

  const setHex = (value: string): void => {
    setHexText(value)
    const parsed = parseHex(value)
    if (parsed && (value.replace('#', '').length === 3 || value.replace('#', '').length === 6)) {
      onChange({ ...parsed, a: color.a })
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="color-popover"
          side={side}
          align={align}
          sideOffset={10}
          collisionPadding={12}
        >
          <div className="color-popover__head">
            <div>
              <div className="eyebrow">{t('颜色')}</div>
              <div className="color-popover__title">{resolvedTitle}</div>
            </div>
            <ColorSwatch color={color} size={28} />
          </div>

          <div className="color-picker-shell">
            <HexColorPicker
              color={rgbaToHex(color)}
              onChange={(hex) => {
                const parsed = parseHex(hex)
                if (parsed) onChange({ ...parsed, a: color.a })
              }}
            />
          </div>

          <div className="color-fields">
            <label className="field field--compact color-hex-field">
              <span className="field__label">{t('十六进制')}</span>
              <span className="color-hex-input">
                <span className="color-hex-input__hash">#</span>
                <input
                  value={hexText.replace(/^#/, '')}
                  onChange={(event) => setHex(event.target.value)}
                  onBlur={() => setHexText(rgbaToHex(color).replace(/^#/, ''))}
                  spellCheck={false}
                  className="mono"
                />
                <Pipette size={12} className="color-hex-input__icon" />
              </span>
            </label>
            <label className="field field--compact color-alpha-field" htmlFor={alphaId}>
              <span className="field__label">{t('透明度')}</span>
              <span className="color-alpha-value mono">{Math.round((color.a / 255) * 100)}%</span>
              <input
                id={alphaId}
                className="alpha-range"
                type="range"
                min={0}
                max={255}
                value={color.a}
                style={
                  {
                    '--alpha-gradient': `linear-gradient(90deg, ${cssColor({ ...color, a: 0 })}, ${cssColor({ ...color, a: 255 })})`
                  } as CSSProperties
                }
                onChange={(event) => onChange({ ...color, a: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="color-popover__footer">
            <div className="color-popover__note">
              <Check size={12} />
              RGB 与 alpha 0–255
            </div>
            <Popover.Close className="btn btn--primary btn--sm">完成</Popover.Close>
          </div>
          <Popover.Arrow className="color-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
