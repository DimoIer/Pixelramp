import type { ReactNode } from 'react'

export function SectionHead({
  index,
  eyebrow,
  title,
  aside
}: {
  index: string
  eyebrow?: string
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="section-head">
      <div className="section-head__left">
        <span className="section-index mono">{index}</span>
        <div className="section-head__copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2 className="section-title">{title}</h2>
        </div>
      </div>
      {aside ? <div className="section-head__aside">{aside}</div> : null}
    </div>
  )
}
