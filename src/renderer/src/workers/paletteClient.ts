import type { ExtractOptions } from '@shared/types'
import { extractColors, type ExtractResult } from '../core/extract'
import PaletteWorker from '../workers/palette.worker?worker&inline'

interface PendingRequest {
  resolve: (result: ExtractResult) => void
  reject: (error: Error) => void
}

class PaletteWorkerClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, PendingRequest>()

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker
    try {
      const worker = new PaletteWorker()
      worker.onmessage = (event: MessageEvent<{ id: number; result?: ExtractResult; error?: string }>) => {
        const { id, result, error } = event.data
        const request = this.pending.get(id)
        if (!request) return
        this.pending.delete(id)
        if (error || !result) request.reject(new Error(error ?? 'Color extraction failed.'))
        else request.resolve(result)
      }
      worker.onerror = () => {
        for (const request of this.pending.values()) {
          request.reject(new Error('The color worker crashed.'))
        }
        this.pending.clear()
        worker.terminate()
        this.worker = null
      }
      this.worker = worker
      return worker
    } catch {
      return null
    }
  }

  async extract(bytes: Uint8Array, options: ExtractOptions): Promise<ExtractResult> {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const worker = this.ensureWorker()
    if (!worker) return extractColors(copy, options)
    const id = this.nextId++
    return new Promise<ExtractResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, buffer: copy.buffer, options }, [copy.buffer])
    }).catch(() => extractColors(bytes, options))
  }
}

export const paletteWorker = new PaletteWorkerClient()
