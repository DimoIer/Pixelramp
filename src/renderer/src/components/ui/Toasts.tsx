import { Check, CircleAlert, Info, X } from 'lucide-react'
import clsx from 'clsx'
import { useUi } from '../../store/ui'

export function Toasts() {
  const toasts = useUi((state) => state.toasts)
  const dismiss = useUi((state) => state.dismissToast)

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? Check : toast.kind === 'error' ? CircleAlert : Info
        return (
          <div key={toast.id} className={clsx('toast', `toast--${toast.kind}`)}>
            <span className="toast__icon">
              <Icon size={14} strokeWidth={2.2} />
            </span>
            <div className="toast__copy">
              <div className="toast__message">{toast.message}</div>
              {toast.detail ? <div className="toast__detail">{toast.detail}</div> : null}
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label="关闭提示"
              onClick={() => dismiss(toast.id)}
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
