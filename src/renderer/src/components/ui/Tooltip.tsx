import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export const TooltipProvider = TooltipPrimitive.Provider

interface TooltipProps {
  content: ReactNode
  shortcut?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactNode
  delayDuration?: number
}

export function Tooltip({ content, shortcut, side = 'top', children, delayDuration = 320 }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tooltip" side={side} sideOffset={7} collisionPadding={10}>
          <span>{content}</span>
          {shortcut ? <kbd className="tooltip__kbd">{shortcut}</kbd> : null}
          <TooltipPrimitive.Arrow className="tooltip__arrow" width={9} height={4} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
