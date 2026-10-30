import { ChevronDown, ChevronUp, PictureInPicture2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../../i18n'

export function SectionHead({
  index,
  eyebrow,
  title,
  aside,
  action,
  collapsed = false,
  floating = false,
  onCollapse,
  onFloat
}: {
  index: string
  eyebrow?: string
  title: string
  aside?: ReactNode
  action?: ReactNode
  collapsed?: boolean
  floating?: boolean
  onCollapse?: () => void
  onFloat?: () => void
}) {
  const t = useT()
  return (
    <div className="section-head">
      <div className="section-head__left">
        <span className="section-index mono">{index}</span>
        <div className="section-head__copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2 className="section-title">{title}</h2>
        </div>
      </div>
      <div className="section-head__right">
        {action}
        {aside ? <div className="section-head__aside">{aside}</div> : null}
        {onCollapse ? (
          <button
            type="button"
            className="section-control"
            aria-label={collapsed ? t('展开') : t('收起')}
            title={collapsed ? t('展开') : t('收起')}
            onClick={onCollapse}
          >
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        ) : null}
        {onFloat ? (
          <button
            type="button"
            className="section-control"
            aria-label={floating ? t('停靠') : t('悬浮')}
            title={floating ? t('停靠') : t('悬浮')}
            onClick={onFloat}
          >
            <PictureInPicture2 size={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
