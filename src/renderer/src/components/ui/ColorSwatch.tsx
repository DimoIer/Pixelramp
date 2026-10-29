import clsx from 'clsx'
import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import type { RGBA } from '@shared/types'
import { cssColor } from '../../core/color'

interface ColorSwatchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'children'> {
  color: RGBA
  size?: number | string
  selected?: boolean
  rounded?: 'sm' | 'md' | 'full'
  as?: 'button' | 'span'
}

export function ColorSwatch({
  color,
  size,
  selected = false,
  rounded = 'sm',
  className,
  style,
  as = 'span',
  ...props
}: ColorSwatchProps) {
  const css = {
    ...style,
    '--swatch-color': cssColor(color),
    ...(size
      ? {
          '--swatch-size': typeof size === 'number' ? `${size}px` : size
        }
      : {})
  } as CSSProperties
  const classes = clsx(
    'color-swatch',
    `color-swatch--${rounded}`,
    selected && 'is-selected',
    className
  )
  if (as === 'button') {
    return <button type="button" className={classes} style={css} {...props} />
  }
  return <span className={classes} style={css} {...(props as Record<string, unknown>)} />
}
