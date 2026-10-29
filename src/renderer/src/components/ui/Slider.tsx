import clsx from 'clsx'
import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'

export interface RangeSliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> {
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
  tone?: 'default' | 'cool' | 'warm' | 'alpha'
  gradient?: string
}

export const RangeSlider = forwardRef<HTMLInputElement, RangeSliderProps>(function RangeSlider(
  {
    value,
    min = 0,
    max = 100,
    step = 1,
    onValueChange,
    className,
    tone = 'default',
    gradient,
    ...props
  },
  ref
) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100
  const style = {
    '--range-progress': `${percent}%`,
    ...(gradient ? { '--range-gradient': gradient } : {})
  } as CSSProperties
  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      style={style}
      className={clsx('range', `range--${tone}`, className)}
      onChange={(event) => onValueChange(Number(event.target.value))}
      {...props}
    />
  )
})

interface DualRangeProps {
  low: number
  high: number
  min?: number
  max?: number
  step?: number
  onChange: (low: number, high: number) => void
  ariaLabels?: [string, string]
  className?: string
}

export function DualRangeSlider({
  low,
  high,
  min = 0,
  max = 1,
  step = 0.005,
  onChange,
  ariaLabels = ['Lower bound', 'Upper bound'],
  className
}: DualRangeProps) {
  const lowPercent = ((low - min) / (max - min)) * 100
  const highPercent = ((high - min) / (max - min)) * 100
  const gap = step * 2

  return (
    <div className={clsx('dual-range', className)}>
      <div className="dual-range__track" aria-hidden>
        <span
          className="dual-range__fill"
          style={{ left: `${lowPercent}%`, width: `${Math.max(0, highPercent - lowPercent)}%` }}
        />
      </div>
      <input
        type="range"
        className="range dual-range__input"
        min={min}
        max={max}
        step={step}
        value={low}
        aria-label={ariaLabels[0]}
        onChange={(event) => {
          const next = Math.min(Number(event.target.value), high - gap)
          onChange(Math.max(min, next), high)
        }}
      />
      <input
        type="range"
        className="range dual-range__input"
        min={min}
        max={max}
        step={step}
        value={high}
        aria-label={ariaLabels[1]}
        onChange={(event) => {
          const next = Math.max(Number(event.target.value), low + gap)
          onChange(low, Math.min(max, next))
        }}
      />
    </div>
  )
}

interface SliderRowProps {
  label: ReactNode
  value: ReactNode
  children: ReactNode
  hint?: ReactNode
  className?: string
}

export function SliderRow({ label, value, children, hint, className }: SliderRowProps) {
  return (
    <div className={clsx('slider-row', className)}>
      <div className="slider-row__top">
        <span className="slider-row__label">{label}</span>
        <span className="slider-row__value mono">{value}</span>
      </div>
      {children}
      {hint ? <div className="slider-row__hint">{hint}</div> : null}
    </div>
  )
}
