import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Layers2,
  Merge,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { IconButton } from '../ui/Button'
import { RangeSlider } from '../ui/Slider'
import { useT } from '../../i18n'

interface LayersPanelProps {
  open: boolean
  onClose: () => void
}

export function LayersPanel({ open, onClose }: LayersPanelProps) {
  const t = useT()
  const {
    doc,
    addLayer,
    duplicateLayer,
    removeLayer,
    selectLayer,
    setLayerVisibility,
    setLayerOpacity,
    renameLayer,
    moveLayer,
    mergeLayerDown
  } = useWorkbench(
    useShallow((state) => ({
      doc: state.doc,
      addLayer: state.addLayer,
      duplicateLayer: state.duplicateLayer,
      removeLayer: state.removeLayer,
      selectLayer: state.selectLayer,
      setLayerVisibility: state.setLayerVisibility,
      setLayerOpacity: state.setLayerOpacity,
      renameLayer: state.renameLayer,
      moveLayer: state.moveLayer,
      mergeLayerDown: state.mergeLayerDown
    }))
  )
  const askConfirm = useUi((state) => state.askConfirm)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  useEffect(() => {
    setEditing(null)
  }, [doc.id])

  if (!open) return null

  const active = doc.layers[doc.activeLayer]
  const canRemove = doc.layers.length > 1

  const commitName = (id: string, index: number): void => {
    renameLayer(index, draftName)
    setEditing(null)
  }

  const confirmRemove = async (index: number): Promise<void> => {
    const layer = doc.layers[index]
    if (!layer || !canRemove) return
    const confirmed = await askConfirm({
      title: t('删除「{name}」？', { name: layer.name }),
      description: t('该图层的像素数据会从当前画布移除，可用撤销恢复。'),
      confirmLabel: t('删除图层'),
      tone: 'danger'
    })
    if (confirmed) removeLayer(index)
  }

  return (
    <aside className="layers-panel" aria-label={t('图层面板')}>
      <div className="layers-panel__head">
        <span className="layers-panel__title">
          <Layers2 size={14} />
          {t('图层')}
          <span className="layers-panel__count mono">{doc.layers.length}</span>
        </span>
        <IconButton label={t('关闭图层面板')} size="sm" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>

      <div className="layers-panel__toolbar">
        <IconButton label={t('新建图层')} size="sm" onClick={addLayer}>
          <Plus size={14} />
        </IconButton>
        <IconButton label={t('复制当前图层')} size="sm" onClick={() => duplicateLayer()}>
          <Copy size={14} />
        </IconButton>
        <IconButton
          label={t('向下合并')}
          size="sm"
          onClick={() => mergeLayerDown()}
          disabled={doc.activeLayer === 0}
        >
          <Merge size={14} />
        </IconButton>
        <IconButton
          label={t('上移图层')}
          size="sm"
          onClick={() => moveLayer(doc.activeLayer, 1)}
          disabled={doc.activeLayer >= doc.layers.length - 1}
        >
          <ChevronUp size={14} />
        </IconButton>
        <IconButton
          label={t('下移图层')}
          size="sm"
          onClick={() => moveLayer(doc.activeLayer, -1)}
          disabled={doc.activeLayer <= 0}
        >
          <ChevronDown size={14} />
        </IconButton>
        <span className="layers-panel__spacer" />
        <IconButton
          label={t('删除当前图层')}
          size="sm"
          onClick={() => void confirmRemove(doc.activeLayer)}
          disabled={!canRemove}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>

      {active ? (
        <div className="layers-panel__opacity">
          <span className="layers-panel__label">{t('不透明度')}</span>
          <RangeSlider
            value={active.opacity * 100}
            min={0}
            max={100}
            step={1}
            aria-label={t('图层不透明度')}
            onValueChange={(value) => setLayerOpacity(doc.activeLayer, value / 100)}
          />
          <span className="layers-panel__opacity-value mono">{Math.round(active.opacity * 100)}%</span>
        </div>
      ) : null}

      <div className="layers-panel__list">
        {[...doc.layers].reverse().map((layer, reverseIndex) => {
          const index = doc.layers.length - 1 - reverseIndex
          const selected = index === doc.activeLayer
          return (
            <div
              key={layer.id}
              className={clsx('layer-row', selected && 'is-selected', !layer.visible && 'is-hidden')}
            >
              <button
                type="button"
                className="layer-row__eye"
                aria-label={
                  layer.visible
                    ? t('隐藏 {name}', { name: layer.name })
                    : t('显示 {name}', { name: layer.name })
                }
                onClick={() => setLayerVisibility(index, !layer.visible)}
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                type="button"
                className="layer-row__select"
                onClick={() => selectLayer(index)}
                onDoubleClick={() => {
                  setEditing(layer.id)
                  setDraftName(layer.name)
                }}
              >
                <span className="layer-row__swatch" aria-hidden />
                {editing === layer.id ? (
                  <input
                    className="layer-row__input"
                    value={draftName}
                    autoFocus
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => commitName(layer.id, index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitName(layer.id, index)
                      if (event.key === 'Escape') setEditing(null)
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                ) : (
                  <span className="layer-row__name">{layer.name}</span>
                )}
              </button>
              <span className="layer-row__meta mono">{Math.round(layer.opacity * 100)}%</span>
            </div>
          )
        })}
      </div>
      <p className="layers-panel__hint">{t('双击图层名重命名 · 眼睛图标控制可见性')}</p>
    </aside>
  )
}
