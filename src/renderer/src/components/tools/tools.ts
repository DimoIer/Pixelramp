import {
  Eraser,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Scan,
  Square,
  type LucideIcon
} from 'lucide-react'
import type { ToolId } from '../../store/workbench'

export interface ToolDefinition {
  id: ToolId
  label: string
  shortcut: string
  detail: string
  icon: LucideIcon
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'pencil',
    label: '铅笔',
    shortcut: 'B',
    detail: '1 px 硬边 · 像素完美',
    icon: Pencil
  },
  {
    id: 'eraser',
    label: '橡皮',
    shortcut: 'E',
    detail: '擦除为透明',
    icon: Eraser
  },
  {
    id: 'bucket',
    label: '油漆桶',
    shortcut: 'G',
    detail: '容差 0 · 精确匹配',
    icon: PaintBucket
  },
  {
    id: 'eyedropper',
    label: '吸管',
    shortcut: 'I',
    detail: '从画布读取颜色',
    icon: Pipette
  },
  {
    id: 'line',
    label: '直线',
    shortcut: 'L',
    detail: '像素级对齐 · 无抗锯齿',
    icon: Minus
  },
  {
    id: 'rectangle',
    label: '矩形',
    shortcut: 'R',
    detail: '硬边描边 · Shift 正方形',
    icon: Square
  },
  {
    id: 'select',
    label: '选区',
    shortcut: 'V',
    detail: '框选、移动与提取颜色',
    icon: Scan
  }
]

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((tool) => [tool.id, tool])) as Record<
  ToolId,
  ToolDefinition
>
