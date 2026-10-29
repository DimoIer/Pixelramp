import type { DesktopApi } from '../shared/types'

declare global {
  interface Window {
    pixelramp?: DesktopApi
  }
}

export {}
