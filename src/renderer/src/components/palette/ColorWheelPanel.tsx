import { Check, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { cssColor, parseHex, rgbaToHex } from '../../core/color'
import { generateRamp } from '../../core/ramp'
import type { RGBA } from '@shared/types'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { RangeSlider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { useT } from '../../i18n'
import { SectionHead } from './SectionHead'

interface HSV {
  h: number
  s: number
  v: number
  a: number
}

function rgbToHsv(color: RGBA): HSV {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h = (h * 60 + 360) % 360
  }
  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
    a: color.a
  }
}

function hsvToRgba(hsv: HSV): RGBA {
  const h = ((hsv.h % 360) + 360) % 360
  const s = Math.max(0, Math.min(1, hsv.s))
  const v = Math.max(0, Math.min(1, hsv.v))
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: Math.max(0, Math.min(255, Math.round(hsv.a)))
  }
}

interface ColorWheelPanelProps {
  collapsed?: boolean
  onCollapse?: () => void
  onFloat?: () => void
  floating?: boolean
}

export function ColorWheelPanel({
  collapsed = false,
  onCollapse,
  onFloat,
  floating = false
}: ColorWheelPanelProps) {
  const t = useT()
  const toast = useUi((state) => state.toast)
  const {
    foreground,
    setForeground,
    rampParams,
    setRampBaseColor,
    activePalette,
    selectedColorIndex,
    setSelectedColorIndex,
    addPaletteColor,
    setPaletteColor
  } = useWorkbench(
    useShallow((state) => ({
      foreground: state.foreground,
      setForeground: state.setForeground,
      rampParams: state.rampParams,
      setRampBaseColor: state.setRampBaseColor,
      activePalette: state.activePalette,
      selectedColorIndex: state.selectedColorIndex,
      setSelectedColorIndex: state.setSelectedColorIndex,
      addPaletteColor: state.addPaletteColor,
      setPaletteColor: state.setPaletteColor
    }))
  )
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(foreground))
  const [linkForeground, setLinkForeground] = useState(true)
  const [linkGenerator, setLinkGenerator] = useState(true)
  const [hexDraft, setHexDraft] = useState(() => rgbaToHex(foreground).slice(1).toUpperCase())
  const [loupe, setLoupe] = useState<{
    x: number
    y: number
    color: RGBA
  } | null>(null)
  const [preview, setPreview] = useState<{ s: number; v: number } | null>(null)
  const ignoreLeftPointer = useRef(false)
  const wheelRef = useRef<HTMLDivElement>(null)
  const wheelDrag = useRef<'hue' | 'sv' | null>(null)

  const color = useMemo(() => hsvToRgba(hsv), [hsv])
  const ramp = useMemo(() => generateRamp(rampParams), [rampParams])
  const paletteKeys = useMemo(
    () =>
      new Set(
        (activePalette?.colors ?? []).map(
          (entry) =>
            `${entry.rgba.r},${entry.rgba.g},${entry.rgba.b},${entry.rgba.a}`
        )
      ),
    [activePalette]
  )
  const colorKey = `${color.r},${color.g},${color.b},${color.a}`
  const foregroundKey = `${foreground.r},${foreground.g},${foreground.b},${foreground.a}`
  const baseKey = `${rampParams.baseColor.r},${rampParams.baseColor.g},${rampParams.baseColor.b},${rampParams.baseColor.a}`
  const hueColor = `hsl(${Math.round(hsv.h)} 100% 50%)`
  const cursorPoint = preview ?? { s: hsv.s, v: hsv.v }
  const colorInPalette = paletteKeys.has(colorKey)

  useEffect(() => {
    setHexDraft(rgbaToHex(color).slice(1).toUpperCase())
  }, [colorKey])

  useEffect(() => {
    if (!linkForeground || foregroundKey === colorKey) return
    setHsv(rgbToHsv(foreground))
  }, [foregroundKey, linkForeground])

  useEffect(() => {
    if (!linkGenerator || baseKey === colorKey) return
    const next = rgbToHsv(rampParams.baseColor)
    setHsv(next)
    if (linkForeground) setForeground(rampParams.baseColor)
  }, [baseKey, linkGenerator, linkForeground])

  const commit = (next: HSV): void => {
    setHsv(next)
    const rgba = hsvToRgba(next)
    if (linkForeground) setForeground(rgba)
    if (linkGenerator) setRampBaseColor(rgba, false)
  }

  const commitColor = (rgba: RGBA): void => {
    const next = rgbToHsv(rgba)
    setHsv(next)
    if (linkForeground) setForeground(rgba)
    if (linkGenerator) setRampBaseColor(rgba, false)
  }

  const commitPreview = (): void => {
    if (!preview) return
    commit({ ...hsv, s: preview.s, v: preview.v })
  }

  const setPreviewPoint = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const wheel = wheelRef.current?.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    if (!wheel) return
    setPreview({ s, v })
    setLoupe({
      x: event.clientX - wheel.left,
      y: event.clientY - wheel.top,
      color: hsvToRgba({ ...hsv, s, v })
    })
  }

  const updateHue = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const hue = (Math.atan2(dx, -dy) * 180) / Math.PI
    commit({ ...hsv, h: (hue + 360) % 360 })
  }

  const startHue = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    wheelDrag.current = 'hue'
    event.currentTarget.setPointerCapture(event.pointerId)
    updateHue(event)
  }

  const startSv = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (ignoreLeftPointer.current && event.button === 0) {
      ignoreLeftPointer.current = false
      return
    }
    if (event.button === 0 && preview) {
      commitPreview()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.button === 2) {
      setPreviewPoint(event)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    wheelDrag.current = 'sv'
    event.currentTarget.setPointerCapture(event.pointerId)
    commit({
      ...hsv,
      s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    })
  }

  const moveSv = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (loupe && (event.buttons & 2) !== 0) {
      if ((event.buttons & 1) !== 0) {
        commitPreview()
        return
      }
      setPreviewPoint(event)
      return
    }
    if (wheelDrag.current !== 'sv') return
    const rect = event.currentTarget.getBoundingClientRect()
    commit({
      ...hsv,
      s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    })
  }

  const endWheelDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    wheelDrag.current = null
    setPreview(null)
    setLoupe(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const updateHex = (value: string): void => {
    setHexDraft(value)
    const parsed = parseHex(value)
    if (parsed && (value.replace('#', '').length === 3 || value.replace('#', '').length === 6)) {
      commitColor({ ...parsed, a: color.a })
    }
  }

  const setComponent = (key: 'h' | 's' | 'v', value: string): void => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return
    if (key === 'h') commit({ ...hsv, h: Math.max(0, Math.min(360, numeric)) })
    else commit({ ...hsv, [key]: Math.max(0, Math.min(100, numeric)) / 100 })
  }

  const writeSelected = (): void => {
    if (!activePalette || selectedColorIndex === null) return
    setPaletteColor(selectedColorIndex, color)
    toast(t('已写入选中色块'), 'success', rgbaToHex(color))
  }

  return (
    <section className={clsx('panel-section', 'color-wheel-section', collapsed && 'is-collapsed')}>
      <SectionHead
        title={t('调色盘')}
        collapsed={collapsed}
        floating={floating}
        onCollapse={onCollapse}
        onFloat={onFloat}
      />
      <div className="color-wheel__body">
        <div
          ref={wheelRef}
          className="color-wheel"
          style={{ '--wheel-hue': hueColor } as CSSProperties}
        >
          <div
            className="color-wheel__ring"
            onPointerDown={startHue}
            onPointerMove={(event) => {
              if (wheelDrag.current === 'hue') updateHue(event)
            }}
            onPointerUp={endWheelDrag}
            onPointerCancel={endWheelDrag}
          />
          <div
            className="color-wheel__sv"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`
            }}
            onContextMenu={(event) => event.preventDefault()}
            onMouseDown={(event) => {
              if (event.button !== 0 || !preview) return
              event.preventDefault()
              event.stopPropagation()
              ignoreLeftPointer.current = true
              window.setTimeout(() => {
                ignoreLeftPointer.current = false
              }, 0)
              commitPreview()
            }}
            onPointerDown={startSv}
            onPointerMove={moveSv}
            onPointerUp={endWheelDrag}
            onPointerCancel={endWheelDrag}
          >
            <span
              className="color-wheel__sv-cursor"
              style={{
                left: `${cursorPoint.s * 100}%`,
                top: `${(1 - cursorPoint.v) * 100}%`
              }}
            />
          </div>
          <span
            className="color-wheel__hue-cursor"
            style={{ transform: `rotate(${hsv.h}deg) translateY(-117px)` }}
          />
          {loupe ? (
            <div
              className="color-wheel__loupe-stack"
              style={{
                left: Math.max(34, Math.min(218, loupe.x)),
                top: Math.max(34, Math.min(218, loupe.y))
              }}
            >
              <span className="color-wheel__loupe-code mono">
                {rgbaToHex(loupe.color).slice(1).toUpperCase()}
              </span>
              <span
                className="color-wheel__loupe"
                style={{ background: cssColor(loupe.color) }}
              />
            </div>
          ) : null}
        </div>

        <div className="color-wheel__params">
          {(
            [
              ['h', t('色相'), 360, Math.round(hsv.h)],
              ['s', t('饱和度'), 100, Math.round(hsv.s * 100)],
              ['v', t('明度'), 100, Math.round(hsv.v * 100)]
            ] as const
          ).map(([key, label, max, value]) => (
            <label className="color-wheel__param" key={key}>
              <span>{label}</span>
              <input
                className="input mono"
                type="number"
                min={0}
                max={max}
                value={value}
                aria-label={label}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setComponent(key, event.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="color-wheel__hex-row">
          <label className="color-wheel__hex">
            <span>#</span>
            <input
              className="mono"
              value={hexDraft}
              spellCheck={false}
              aria-label={t('十六进制')}
              onChange={(event) => updateHex(event.target.value.toUpperCase())}
              onBlur={() => setHexDraft(rgbaToHex(color).slice(1).toUpperCase())}
            />
          </label>
          <span className="color-wheel__rgb mono">
            {color.r} · {color.g} · {color.b}
          </span>
        </div>

        <div className="color-wheel__alpha">
          <span className="field__label">{t('透明度')}</span>
          <RangeSlider
            min={0}
            max={100}
            step={1}
            value={Math.round((hsv.a / 255) * 100)}
            onValueChange={(value) => commit({ ...hsv, a: (value / 100) * 255 })}
            aria-label={t('透明度')}
          />
          <span className="mono">{Math.round((hsv.a / 255) * 100)}%</span>
        </div>

        <div className="color-wheel__links">
          <Switch
            checked={linkForeground}
            onChange={(checked) => {
              setLinkForeground(checked)
              if (checked) setForeground(color)
            }}
            label={t('同步前景色')}
          />
          <Switch
            checked={linkGenerator}
            onChange={(checked) => {
              setLinkGenerator(checked)
              if (checked) setRampBaseColor(color, false)
            }}
            label={t('同步色阶基色')}
          />
        </div>

        <div className="color-wheel__ramp">
          <span className="field__label">{t('当前色阶')}</span>
          <div className="color-wheel__swatches">
            {ramp.colors.map((entry, index) => {
              const exists = paletteKeys.has(
                `${entry.rgba.r},${entry.rgba.g},${entry.rgba.b},${entry.rgba.a}`
              )
              const hex = rgbaToHex(entry.rgba).toUpperCase()
              return (
                <button
                  type="button"
                  key={`${index}-${hex}`}
                  className={clsx(
                    'color-wheel__swatch',
                    'color-wheel__swatch--ramp',
                    exists && 'is-in-palette'
                  )}
                  style={{ background: cssColor(entry.rgba) }}
                  title={`${hex} · ${t(exists ? '已在当前调色卡中' : '右键加入调色卡')}`}
                  aria-label={`${hex} ${t(exists ? '已在当前调色卡中' : '右键加入调色卡')}`}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    if (!activePalette) return
                    if (exists) {
                      toast(t('该颜色已在当前调色卡中'), 'info', hex)
                      return
                    }
                    addPaletteColor(entry.rgba)
                    toast(t('已加入调色卡'), 'success', hex)
                  }}
                />
              )
            })}
          </div>
        </div>

        {activePalette ? (
          <div className="color-wheel__palette">
            <span className="field__label">{t('当前调色卡')}</span>
            <div className="color-wheel__swatches">
              {activePalette.colors.map((entry, index) => (
                <button
                  type="button"
                  key={`${index}-${rgbaToHex(entry.rgba)}`}
                  className={clsx('color-wheel__swatch', index === selectedColorIndex && 'is-selected')}
                  style={{ background: cssColor(entry.rgba) }}
                  aria-label={rgbaToHex(entry.rgba)}
                  onClick={() => {
                    setSelectedColorIndex(index, 'wheel')
                    commitColor(entry.rgba)
                  }}
                />
              ))}
            </div>
            <div className="color-wheel__actions">
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Check size={12} />}
                disabled={selectedColorIndex === null}
                onClick={writeSelected}
              >
                {t('写入选中色块')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Plus size={12} />}
                disabled={colorInPalette}
                onClick={() => {
                  addPaletteColor(color)
                  toast(t('已加入调色卡'), 'success', rgbaToHex(color))
                }}
              >
                {t('加入调色卡')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="color-wheel__empty">{t('暂无当前调色卡，可先生成或提取一张。')}</p>
        )}
      </div>
    </section>
  )
}
