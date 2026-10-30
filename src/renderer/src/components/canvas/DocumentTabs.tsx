import { Plus, X } from 'lucide-react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useWorkbench } from '../../store/workbench'
import { useUi } from '../../store/ui'
import { closeDocumentTabCommand } from '../../commands'
import { useT } from '../../i18n'

export function DocumentTabs() {
  const t = useT()
  const { tabs, activeTabId, doc, switchTab } = useWorkbench(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      doc: state.doc,
      switchTab: state.switchTab
    }))
  )
  const openDialog = useUi((state) => state.openDialog)

  return (
    <div className="doc-tabs" role="tablist" aria-label={t('打开的文档')}>
      <div className="doc-tabs__strip">
        {tabs.map((tab) => {
          const current = tab.id === activeTabId ? doc : tab.doc
          const active = tab.id === activeTabId
          return (
            <div key={tab.id} className={clsx('doc-tab', active && 'is-active')}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="doc-tab__main"
                title={current.projectPath ?? current.sourcePath ?? current.name}
                onClick={() => switchTab(tab.id)}
              >
                {current.dirty ? <span className="doc-tab__dirty" aria-label={t('未保存')} /> : null}
                <span className="doc-tab__name">{current.name}</span>
                <span className="doc-tab__size mono">
                  {current.width}×{current.height}
                </span>
              </button>
              <button
                type="button"
                className="doc-tab__close"
                aria-label={t('关闭 {name}', { name: current.name })}
                onClick={() => void closeDocumentTabCommand(tab.id)}
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="doc-tabs__new"
        aria-label={t('新建画布标签页')}
        title={t('新建画布')}
        onClick={() => openDialog('new-canvas')}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
