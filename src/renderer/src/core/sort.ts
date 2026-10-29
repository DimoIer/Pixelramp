import type { PaletteColor, SortDimension, SortDirection } from '@shared/types'
import { rgbaToHex, rgbaToOklch } from './color'

const metric = (color: PaletteColor, dimension: SortDimension): number => {
  const lch = rgbaToOklch(color.rgba)
  switch (dimension) {
    case 'lightness':
      return lch.L
    case 'hue':
      return lch.h
    case 'chroma':
      return lch.C
    case 'frequency':
      return color.count ?? 0
  }
}

export function sortPaletteColors(
  colors: PaletteColor[],
  dimension: SortDimension,
  direction: SortDirection
): PaletteColor[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...colors].sort((a, b) => {
    const delta = metric(a, dimension) - metric(b, dimension)
    if (Math.abs(delta) > 1e-9) return delta * sign
    const lA = rgbaToOklch(a.rgba).L
    const lB = rgbaToOklch(b.rgba).L
    if (Math.abs(lA - lB) > 1e-9) return (lA - lB) * sign
    return rgbaToHex(a.rgba).localeCompare(rgbaToHex(b.rgba))
  })
}

export const SORT_LABELS: Record<SortDimension, string> = {
  lightness: 'Lightness',
  hue: 'Hue',
  chroma: 'Chroma',
  frequency: 'Frequency'
}
