import { Loader2 } from 'lucide-react'
import { useUi } from '../../store/ui'

export function BusyIndicator() {
  const busy = useUi((state) => state.busy)
  if (!busy) return null
  return (
    <>
      <div className="busy-line" aria-hidden />
      <div className="busy-pill" role="status">
        <Loader2 size={13} className="spin" />
        <span>{busy}</span>
      </div>
    </>
  )
}
