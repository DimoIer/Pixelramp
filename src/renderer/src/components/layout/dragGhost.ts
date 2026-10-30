export interface DragGhost {
  move: (x: number, y: number) => void
  remove: () => void
}

export function createDragGhost(
  source: HTMLElement,
  x: number,
  y: number,
  size?: { width: number; height: number }
): DragGhost {
  const rect = source.getBoundingClientRect()
  const width = size?.width ?? rect.width
  const height = size?.height ?? rect.height
  const clone = source.cloneNode(true) as HTMLElement
  clone.classList.add('panel-drag-clone')
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.left = `${x - 34}px`
  clone.style.top = `${y - 18}px`
  document.body.appendChild(clone)
  return {
    move: (nextX: number, nextY: number) => {
      clone.style.left = `${nextX - 34}px`
      clone.style.top = `${nextY - 18}px`
    },
    remove: () => clone.remove()
  }
}
