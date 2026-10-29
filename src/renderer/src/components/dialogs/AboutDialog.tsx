import { Layers, Palette, ScanLine, Sparkles } from 'lucide-react'
import { useUi } from '../../store/ui'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { platformVersion, isDesktop } from '../../platform'

const PRINCIPLES = [
  {
    icon: ScanLine,
    title: '像素级无插值',
    text: '画布缩放、绘制与 PNG 导出全程 nearest-neighbor，不引入任何抗锯齿或平滑像素。'
  },
  {
    icon: Palette,
    title: '调色卡是一等公民',
    text: '调色卡可命名、保存、复用，并作为独立于图像的数据对象存在；色块可直接拖到画布。'
  },
  {
    icon: Layers,
    title: '遵循像素画色彩规范',
    text: '阴影向蓝紫偏冷并保留色度，高光向暖色收敛；明度在 OKLCh 空间等距分布。'
  }
]

export function AboutDialog() {
  const closeDialog = useUi((state) => state.closeDialog)
  const version = platformVersion()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
      eyebrow="ABOUT"
      title="PixelRamp Studio"
      width={600}
      footer={
        <>
          <div className="dialog-footer__hint mono">A PALETTE-FIRST PIXEL TOOL</div>
          <Button variant="primary" onClick={closeDialog}>
            开始创作
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
          <p>
            为 Minecraft 材质创作者打造。先画基色，再让色阶围绕调色卡工作，而不是在取色器里反复猜阴影和高光。
          </p>
          <div className="about-hero__meta mono">
            <span>VERSION {version || '0.1.0'}</span>
            <span>{isDesktop ? 'DESKTOP BUILD' : 'WEB PREVIEW'}</span>
            <span>LOCAL FIRST</span>
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
                <h3>{principle.title}</h3>
                <p>{principle.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="about-tech">
        <span className="eyebrow">IMPLEMENTATION NOTE</span>
        <p>
          一期实现使用 Electron + React + TypeScript，颜色统计与合并运行在 Web Worker 中，避免阻塞绘制。
          图像与颜色计算层保持独立，后续可迁移到 Tauri + Rust 核心。
        </p>
        <div className="about-tech__row mono">
          <span>NO INTERPOLATION</span>
          <span>OKLCH RAMPS</span>
          <span>LOCAL JSON PALETTES</span>
        </div>
      </div>

      <div className="about-sign">
        <Sparkles size={13} />
        <span>为像素画而生 · 调色卡优先</span>
      </div>
    </Dialog>
  )
}
