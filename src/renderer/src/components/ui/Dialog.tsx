import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import { useT } from '../../i18n'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  eyebrow?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number | string
  className?: string
  bodyClassName?: string
  layer?: 'base' | 'top'
}

export function Dialog({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  children,
  footer,
  width = 540,
  className,
  bodyClassName,
  layer = 'base'
}: DialogProps) {
  const t = useT()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={clsx('dialog-overlay', layer === 'top' && 'dialog-overlay--top')} />
        <DialogPrimitive.Content
          className={clsx('dialog-content', layer === 'top' && 'dialog-content--top', className)}
          style={{ '--dialog-width': typeof width === 'number' ? `${width}px` : width } as CSSProperties}
          aria-describedby={description ? 'dialog-description' : undefined}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
          }}
        >
          <div className="dialog-head">
            <div className="dialog-head__copy">
              {eyebrow ? <div className="eyebrow dialog-head__eyebrow">{eyebrow}</div> : null}
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description id="dialog-description" className="dialog-description">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className="dialog-close" aria-label={t('关闭')}>
              <X size={16} strokeWidth={1.8} />
            </DialogPrimitive.Close>
          </div>
          <div className={clsx('dialog-body', bodyClassName)}>{children}</div>
          {footer ? <div className="dialog-footer">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
