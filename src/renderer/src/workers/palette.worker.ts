import type { ExtractOptions } from '@shared/types'
import { extractColors } from '../core/extract'

interface ExtractRequest {
  id: number
  buffer: ArrayBuffer
  options: ExtractOptions
}

self.onmessage = (event: MessageEvent<ExtractRequest>) => {
  const { id, buffer, options } = event.data
  try {
    const result = extractColors(new Uint8Array(buffer), options)
    ;(self as unknown as Worker).postMessage({ id, result })
  } catch (error) {
    ;(self as unknown as Worker).postMessage({
      id,
      error: error instanceof Error ? error.message : 'Color extraction failed.'
    })
  }
}
