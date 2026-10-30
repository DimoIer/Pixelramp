import { MousePointer2, Pencil, Sparkles } from 'lucide-react'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Kbd } from '../ui/Kbd'
import { useT } from '../../i18n'

interface ShortcutItem {
  keys: string[]
  label: string
}

const GROUPS: Array<{ title: string; hint?: string; items: ShortcutItem[] }> = [
  {
    title: '工具',
    hint: '单键切换',
    items: [
      { keys: ['B'], label: '铅笔' },
      { keys: ['E'], label: '橡皮' },
      { keys: ['G'], label: '油漆桶' },
      { keys: ['I'], label: '吸管' },
      { keys: ['L'], label: '直线' },
      { keys: ['R'], label: '矩形' },
      { keys: ['V'], label: '矩形选区' },
      { keys: ['X'], label: '交换前景 / 背景色' }
    ]
  },
  {
    title: '画布',
    items: [
      { keys: ['Scroll'], label: '以光标为锚点缩放' },
      { keys: ['Space', '拖拽'], label: '平移画布' },
      { keys: ['Shift', '点击'], label: '吸管取背景色' },
      { keys: ['Shift'], label: '直线 / 矩形约束' },
      { keys: ['+', '−'], label: '放大 / 缩小' },
      { keys: ['Ctrl', '0'], label: '适合窗口' },
      { keys: ['Shift', 'G'], label: '显示 / 隐藏网格' },
      { keys: ['Esc'], label: '取消选区 / 取消当前笔画' }
    ]
  },
  {
    title: '编辑与文件',
    items: [
      { keys: ['Ctrl', 'Z'], label: '撤销' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: '重做' },
      { keys: ['Ctrl', 'C'], label: '复制' },
      { keys: ['Ctrl', 'X'], label: '剪切选区' },
      { keys: ['Ctrl', 'V'], label: '粘贴' },
      { keys: ['Del'], label: '删除选区像素' },
      { keys: ['Ctrl', 'A'], label: '全选' },
      { keys: ['Ctrl', 'N'], label: '新建画布' },
      { keys: ['Ctrl', 'O'], label: '打开图像 / 工程' },
      { keys: ['Ctrl', 'S'], label: '保存工程' },
      { keys: ['Ctrl', 'Shift', 'S'], label: '工程另存为' },
      { keys: ['Ctrl', 'Shift', 'E'], label: '导出 PNG' }
    ]
  }
]

export function ShortcutsDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="KEYBOARD"
      title={t('键盘快捷键')}
      description={t('画布与编辑操作的快捷键。')}
      width={720}
      footer={
        <>
          <div className="dialog-footer__hint">
            <MousePointer2 size={12} />
            {t('空格 + 拖拽可平移画布')}
          </div>
          <Button variant="primary" onClick={closeDialog}>
            {t('关闭')}
          </Button>
        </>
      }
    >
      <div className="shortcut-grid">
        {GROUPS.map((group) => (
          <section key={group.title} className="shortcut-group">
            <div className="shortcut-group__head">
              <h3>{t(group.title)}</h3>
              {group.hint ? <span className="mono">{t(group.hint)}</span> : null}
            </div>
            <div className="shortcut-list">
              {group.items.map((item) => (
                <div key={item.label} className="shortcut-row">
                  <span>{t(item.label)}</span>
                  <span className="shortcut-row__keys">
                    {item.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="shortcut-callout">
        <span className="shortcut-callout__icon">
          <Sparkles size={15} />
        </span>
        <div>
          <strong>{t('像素完美')}</strong>
          <p>{t('拖动铅笔时移除 L 形冗余拐角，斜线保持 1 px。')}</p>
        </div>
        <Pencil size={16} className="shortcut-callout__pencil" />
      </div>
    </Dialog>
  )
}
