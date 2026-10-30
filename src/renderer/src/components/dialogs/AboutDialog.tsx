import { Layers, Palette, ScanLine } from 'lucide-react'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { platformVersion, isDesktop } from '../../platform'
import { useT } from '../../i18n'

const PRINCIPLES = [
  {
    icon: ScanLine,
    title: '像素级无插值',
    text: '画布缩放、绘制和 PNG 导出使用最近邻采样，不添加抗锯齿。'
  },
  {
    icon: Palette,
    title: '调色卡工作流',
    text: '调色卡可命名、保存和复用；色块可直接拖到画布。'
  },
  {
    icon: Layers,
    title: 'OKLCh 色阶',
    text: '按感知明度生成色阶，并提供阴影偏冷、高光偏暖与色度收敛控制。'
  }
]

export function AboutDialog() {
  const t = useT()
  const closeDialog = useUi((state) => state.closeDialog)
  const version = platformVersion()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow={t('关于')}
      title="PixelRamp Studio"
      width={600}
      footer={
        <>
          <div className="dialog-footer__hint mono">{t('Tauri · 本地优先')}</div>
          <Button variant="primary" onClick={closeDialog}>
            {t('关闭')}
          </Button>
        </>
      }
    >
      <div className="about-hero">
        <div className="about-hero__mark" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <div className="about-hero__title">
            PIXELRAMP<span>.</span>
          </div>
          <p>{t('面向 Minecraft 材质创作的像素画与调色工作台。')}</p>
          <div className="about-hero__meta mono">
            <span>{t('版本 {version}', { version: version || '0.2.12' })}</span>
            <span>{isDesktop ? t('桌面版') : t('网页预览')}</span>
            <span>{t('本地优先')}</span>
          </div>
        </div>
      </div>

      <div className="about-principles">
        {PRINCIPLES.map((principle, index) => {
          const Icon = principle.icon
          return (
            <div key={principle.title} className="about-principle">
              <span className="about-principle__index mono">0{index + 1}</span>
              <span className="about-principle__icon">
                <Icon size={15} />
              </span>
              <div>
                <h3>{t(principle.title)}</h3>
                <p>{t(principle.text)}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="about-tech">
        <span className="eyebrow">{t('技术实现')}</span>
        <p>
          {t(
            'Tauri v2 + Rust 后端，React + TypeScript 渲染层。颜色统计与合并运行在 Web Worker 中，调色卡以本地 JSON 保存。'
          )}
        </p>
        <div className="about-tech__row mono">
          <span>{t('无插值')}</span>
          <span>{t('OKLCh 色阶')}</span>
          <span>{t('本地 JSON 调色卡')}</span>
        </div>
      </div>
    </Dialog>
  )
}
