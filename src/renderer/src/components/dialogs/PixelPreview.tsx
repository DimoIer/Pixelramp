import { useEffect, useRef } from 'react'

interface PixelPreviewProps {
  pixels: Uint32Array
  width: number
  height: number
  className?: string
}

export function PixelPreview({ pixels, width, height, className }: PixelPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return
    const imageData = new ImageData(width, height)
    new Uint32Array(imageData.data.buffer).set(pixels)
    context.clearRect(0, 0, width, height)
    context.imageSmoothingEnabled = false
    context.putImageData(imageData, 0, 0)
  }, [height, pixels, width])

  return <canvas ref={ref} className={className ?? 'adjust-preview__canvas'} />
}
