import clsx from 'clsx'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onChange, label, ariaLabel, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={clsx('switch-row', checked && 'is-checked', className)}
      onClick={() => onChange(!checked)}
    >
      <span className="switch" aria-hidden>
        <span className="switch__thumb" />
      </span>
      {label ? <span className="switch-row__label">{label}</span> : null}
    </button>
  )
}
