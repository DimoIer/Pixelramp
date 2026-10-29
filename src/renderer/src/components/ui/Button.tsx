import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { Tooltip } from './Tooltip'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx('btn', `btn--${variant}`, `btn--${size}`, className)}
      {...props}
    >
      {loading ? <Loader2 size={14} className="spin" /> : leadingIcon}
      {children ? <span className="btn__label">{children}</span> : null}
      {trailingIcon}
    </button>
  )
})

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  label: string
  shortcut?: string
  active?: boolean
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function IconButton({
  label,
  shortcut,
  active = false,
  tooltipSide = 'top',
  size = 'md',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <Button
        aria-label={label}
        aria-pressed={active || undefined}
        size={size === 'sm' ? 'icon-sm' : 'icon'}
        variant="ghost"
        className={clsx('icon-btn', active && 'is-active', className)}
        {...props}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

export function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return clsx('btn', `btn--${variant}`, `btn--${size}`, className)
}
