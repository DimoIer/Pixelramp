import { TriangleAlert } from 'lucide-react'
import { useUi } from '../../store/ui'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { useT } from '../../i18n'

export function ConfirmDialog() {
  const t = useT()
  const confirm = useUi((state) => state.confirm)
  const resolveConfirm = useUi((state) => state.resolveConfirm)

  return (
    <Dialog
      open={!!confirm}
      onOpenChange={(open) => {
        if (!open) resolveConfirm(false)
      }}
      title={confirm?.title ?? ''}
      eyebrow="CONFIRM"
      description={confirm?.description}
      width={430}
      layer="top"
      className="confirm-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={() => resolveConfirm(false)}>
            {confirm?.cancelLabel ?? t('取消')}
          </Button>
          <Button
            variant={confirm?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => resolveConfirm(true)}
          >
            {confirm?.confirmLabel ?? t('继续')}
          </Button>
        </>
      }
    >
      <div className="confirm-body">
        <span className="confirm-body__icon">
          <TriangleAlert size={18} />
        </span>
        <p>{t('此操作不会被撤销。请确认已经保存需要保留的内容。')}</p>
      </div>
    </Dialog>
  )
}
