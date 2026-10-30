import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ChevronDown,
  CircleAlert,
  MoreHorizontal,
  Pipette,
  Plus,
  Sparkles,
  WandSparkles
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import type { ColorRole } from '@shared/types'
import { parseHex, rgbaToHex } from '../../core/color'
import { generateRamp, autoLightnessRange } from '../../core/ramp'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { ColorPickerPopover } from '../ui/ColorPickerPopover'
import { ColorSwatch } from '../ui/ColorSwatch'
import { DualRangeSlider, RangeSlider, SliderRow } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { Tooltip } from '../ui/Tooltip'
import { SectionHead } from './SectionHead'
import { useT } from '../../i18n'

const ROLE_LABEL: Record<ColorRole, string> = {
  shadow: '阴影',
  base: '基色',
  highlight: '高光',
  neutral: '中性'
}

const ROLE_DOT: Record<ColorRole, string> = {
  shadow: '#86b5df',
  base: '#d7f36b',
  highlight: '#edbd7e',
  neutral: '#9b9f92'
}

interface GeneratorPanelProps {
  collapsed?: boolean
  floating?: boolean
  onCollapse?: () => void
  onFloat?: () => void
}

export function GeneratorPanel({
  collapsed = false,
  floating = false,
  onCollapse,
  onFloat
}: GeneratorPanelProps) {
  const t = useT()
  const {
    rampParams,
    updateRampParams,
    setRampBaseColor,
    applyRampToPalette,
    foreground,
    activePalette
  } = useWorkbench(
    useShallow((state) => ({
      rampParams: state.rampParams,
      updateRampParams: state.updateRampParams,
      setRampBaseColor: state.setRampBaseColor,
      applyRampToPalette: state.applyRampToPalette,
      foreground: state.foreground,
      activePalette: state.activePalette
    }))
  )
  const toast = useUi((state) => state.toast)
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [baseHex, setBaseHex] = useState(rgbaToHex(rampParams.baseColor).slice(1).toUpperCase())

  const ramp = useMemo(() => generateRamp(rampParams), [rampParams])
  const control = hovered !== null ? hovered : selected
  const activeColor = control !== null ? ramp.colors[control] : null
  const tooClose = ramp.warnings.find((warning) => warning.code === 'too-close')

  useEffect(() => {
    setBaseHex(rgbaToHex(rampParams.baseColor).slice(1).toUpperCase())
  }, [rampParams.baseColor.r, rampParams.baseColor.g, rampParams.baseColor.b])

  const applyBaseHex = (): void => {
    const parsed = parseHex(baseHex)
    if (parsed) {
      setRampBaseColor({ ...parsed, a: rampParams.baseColor.a })
    } else {
      setBaseHex(rgbaToHex(rampParams.baseColor).slice(1).toUpperCase())
    }
  }

  const createPalette = (mode: 'new' | 'replace' | 'append' = 'new'): void => {
    const palette = applyRampToPalette(mode)
    if (!palette) return
    const label = mode === 'new' ? '已创建调色卡' : mode === 'replace' ? '已替换当前调色卡' : '已追加到当前调色卡'
    toast(label, 'success', `${palette.name} · ${palette.colors.length} 色`)
  }

  const expandRange = (): void => {
    updateRampParams({ lightnessRange: autoLightnessRange(rampParams.baseColor) })
  }

  const shadeValue = Math.abs(rampParams.hueShift.shadows)
  const highlightValue = rampParams.hueShift.highlights
  const lowPercent = Math.round(rampParams.lightnessRange[0] * 100)
  const highPercent = Math.round(rampParams.lightnessRange[1] * 100)

  return (
    <section className={clsx('panel-section generator', collapsed && 'is-collapsed')}>
      <SectionHead
        title={t('色阶生成器')}
        aside={<span className="mode-pill mono">{rampParams.colorSpace}</span>}
        action={
          <div className="generator-head-actions">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={12} />}
              onClick={() => createPalette('new')}
            >
              {t('新建')}
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="btn btn--secondary btn--icon-sm"
                  aria-label={t('更多生成器操作')}
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu-content" align="end" sideOffset={5}>
                  <DropdownMenu.Item className="menu-item" onSelect={() => createPalette('new')}>
                    <span className="menu-item__icon"><Plus size={14} /></span>
                    <span className="menu-item__label">{t('创建新调色卡')}</span>
                  </DropdownMenu.Item>
                  {activePalette ? (
                    <>
                      <DropdownMenu.Separator className="menu-separator" />
                      <DropdownMenu.Item className="menu-item" onSelect={() => createPalette('replace')}>
                        <span className="menu-item__icon"><Sparkles size={14} /></span>
                        <span className="menu-item__label">
                          {t('替换「{name}」', { name: activePalette.name })}
                        </span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className="menu-item" onSelect={() => createPalette('append')}>
                        <span className="menu-item__icon"><Plus size={14} /></span>
                        <span className="menu-item__label">{t('追加到当前调色卡')}</span>
                      </DropdownMenu.Item>
                    </>
                  ) : null}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        }
        collapsed={collapsed}
        floating={floating}
        onCollapse={onCollapse}
        onFloat={onFloat}
      />

      <div className="generator__body">
        <div className="base-color-row">
          <ColorPickerPopover
            color={rampParams.baseColor}
            onChange={(color) => setRampBaseColor(color)}
            title="选择基色"
            side="left"
            align="start"
          >
            <button type="button" className="base-swatch" aria-label="选择基色">
              <ColorSwatch color={rampParams.baseColor} size={38} />
              <span className="base-swatch__edit">
                <WandSparkles size={11} />
              </span>
            </button>
          </ColorPickerPopover>
          <div className="base-color-field">
            <span className="field__label">{t('基色')}</span>
            <label className="hex-field">
              <span className="hex-field__hash">#</span>
              <input
                value={baseHex}
                onChange={(event) => setBaseHex(event.target.value.toUpperCase())}
                onBlur={applyBaseHex}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyBaseHex()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
                spellCheck={false}
                className="mono"
                aria-label="基色 hex"
              />
              {rampParams.baseColor.a < 255 ? (
                <span className="hex-field__alpha mono">{Math.round((rampParams.baseColor.a / 255) * 100)}%</span>
              ) : null}
            </label>
          </div>
          <Tooltip content="使用当前前景色" side="left">
            <button
              type="button"
              className="base-pick-current"
              aria-label="使用当前前景色作为基色"
              onClick={() => setRampBaseColor(foreground)}
            >
              <Pipette size={14} />
            </button>
          </Tooltip>
        </div>

        <SliderRow
          label={t('阶数')}
          value={<span>{String(rampParams.count).padStart(2, '0')} {t('阶')}</span>}
          className="count-slider"
        >
          <div className="count-slider__row">
            <RangeSlider
              min={3}
              max={15}
              step={1}
              value={rampParams.count}
              onValueChange={(value) => updateRampParams({ count: value })}
              aria-label="色阶数量"
            />
            <div className="count-stepper">
              <button
                type="button"
                aria-label="减少一阶"
                onClick={() => updateRampParams({ count: Math.max(3, rampParams.count - 1) })}
                disabled={rampParams.count <= 3}
              >
                −
              </button>
              <button
                type="button"
                aria-label="增加一阶"
                onClick={() => updateRampParams({ count: Math.min(15, rampParams.count + 1) })}
                disabled={rampParams.count >= 15}
              >
                +
              </button>
            </div>
          </div>
        </SliderRow>

        <details className="generator-tuning">
          <summary>
            <span>{t('色彩参数')}</span>
            <ChevronDown size={13} className="generator-advanced__chevron" />
          </summary>
          <div className="generator-tuning__body">
            <SliderRow
              label={t('明度范围')}
              value={
                <span>
                  {lowPercent}% <span className="slider-value-sep">—</span> {highPercent}%
                </span>
              }
            >
              <DualRangeSlider
                low={rampParams.lightnessRange[0]}
                high={rampParams.lightnessRange[1]}
                min={0.03}
                max={0.98}
                step={0.005}
                ariaLabels={['暗端明度', '亮端明度']}
                onChange={(low, high) => updateRampParams({ lightnessRange: [low, high] })}
              />
              <div className="range-endpoints mono">
                <span>{t('阴影')}</span>
                <span>{t('高光')}</span>
              </div>
            </SliderRow>

            <div className="hue-grid">
              <SliderRow
                label={
                  <span className="hue-label">
                    <span className="hue-dot hue-dot--cool" />
                    {t('阴影偏冷')}
                  </span>
                }
                value={`−${shadeValue}°`}
              >
                <RangeSlider
                  min={-40}
                  max={0}
                  step={1}
                  tone="cool"
                  value={rampParams.hueShift.shadows}
                  onValueChange={(value) => updateRampParams({ hueShift: { shadows: value } })}
                  aria-label="阴影偏冷量"
                />
              </SliderRow>
              <SliderRow
                label={
                  <span className="hue-label">
                    <span className="hue-dot hue-dot--warm" />
                    {t('高光偏暖')}
                  </span>
                }
                value={`+${highlightValue}°`}
              >
                <RangeSlider
                  min={0}
                  max={40}
                  step={1}
                  tone="warm"
                  value={rampParams.hueShift.highlights}
                  onValueChange={(value) => updateRampParams({ hueShift: { highlights: value } })}
                  aria-label="高光偏暖量"
                />
              </SliderRow>
            </div>

            <div className="generator__toggle-row">
              <div>
                <Switch
                  checked={rampParams.chromaTaper}
                  onChange={(checked) => updateRampParams({ chromaTaper: checked })}
                  label={t('高光降饱和')}
                />
                <p className="generator__toggle-hint">{t('色度向高光收敛，减少刺眼感')}</p>
              </div>
              <div className="generator__formula mono">C ↓ · L ↑</div>
            </div>
          </div>
        </details>

        <details className="generator-advanced">
          <summary>
            <span>{t('色彩空间与插值')}</span>
            <ChevronDown size={13} className="generator-advanced__chevron" />
          </summary>
          <div className="generator-advanced__content">
            <div className="advanced-row">
              <span className="advanced-row__label">{t('色彩空间')}</span>
              <div className="segmented" role="group" aria-label={t('色彩空间')}>
                {(['OKLCh', 'HSL'] as const).map((space) => (
                  <button
                    key={space}
                    type="button"
                    className={clsx(rampParams.colorSpace === space && 'is-active')}
                    onClick={() => updateRampParams({ colorSpace: space })}
                  >
                    {space}
                  </button>
                ))}
              </div>
            </div>
            <div className="advanced-row">
              <span className="advanced-row__label">{t('明度曲线')}</span>
              <div className="segmented" role="group" aria-label={t('明度曲线')}>
                <button
                  type="button"
                  className={clsx(rampParams.interpolation === 'linear' && 'is-active')}
                  onClick={() => updateRampParams({ interpolation: 'linear' })}
                >
                  线性
                </button>
                <button
                  type="button"
                  className={clsx(rampParams.interpolation === 'eased' && 'is-active')}
                  onClick={() => updateRampParams({ interpolation: 'eased' })}
                >
                  缓动
                </button>
              </div>
            </div>
          </div>
        </details>

        <div className="ramp-preview-block">
          <div className="ramp-preview__head">
            <span className="field__label">{t('实时色阶')}</span>
            <span className="ramp-preview__count mono">
              {t('{count} 色', { count: rampParams.count })}
            </span>
          </div>
          <div className="ramp-strip" role="group" aria-label="生成的色阶">
            {ramp.colors.map((color, index) => (
              <button
                type="button"
                key={`${index}-${rgbaToHex(color.rgba)}`}
                className={clsx(
                  'ramp-swatch',
                  selected === index && 'is-selected',
                  hovered === index && 'is-hovered'
                )}
                style={{ backgroundColor: rgbaToHex(color.rgba) }}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', rgbaToHex(color.rgba))
                  event.dataTransfer.effectAllowed = 'copy'
                }}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  useWorkbench.getState().setForeground(color.rgba)
                  setSelected(index)
                }}
                aria-label={`${t(ROLE_LABEL[color.role])} ${rgbaToHex(color.rgba)}`}
                title={`${t(ROLE_LABEL[color.role])} · ${rgbaToHex(color.rgba).toUpperCase()}${color.clipped ? ' · clipped to sRGB' : ''}`}
              >
                {color.clipped ? <span className="ramp-swatch__clip" /> : null}
                {selected === index ? <span className="ramp-swatch__check">✓</span> : null}
              </button>
            ))}
          </div>
          {activeColor ? (
            <div className="ramp-inspect">
              <ColorSwatch color={activeColor.rgba} size={18} />
              <span className="ramp-inspect__hex mono">{rgbaToHex(activeColor.rgba).toUpperCase()}</span>
              <span className="ramp-inspect__role">
                <span
                  className="role-dot"
                  style={{ backgroundColor: ROLE_DOT[activeColor.role] }}
                />
                {t(ROLE_LABEL[activeColor.role])}
              </span>
              <span className="ramp-inspect__l mono">L {Math.round(activeColor.oklch.L * 100)}</span>
              <span className="ramp-inspect__hint">{t('点击取色 →')}</span>
            </div>
          ) : null}
        </div>

        {tooClose || ramp.clippedCount > 0 ? (
          <div className="ramp-warnings">
            {tooClose ? (
              <div className="ramp-warning">
                <CircleAlert size={12} />
                <span>{t('相邻色阶过密，肉眼难辨。')}</span>
                <button type="button" onClick={expandRange}>
                  {t('扩展范围')}
                </button>
              </div>
            ) : null}
            {ramp.clippedCount > 0 ? (
              <div className="ramp-note">
                <span className="ramp-note__mark" />
                {t('{count} 色超出 sRGB，已裁剪；色块右上角有标记。', {
                  count: ramp.clippedCount
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
