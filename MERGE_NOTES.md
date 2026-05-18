# ProAct 展示页合并说明

## 底座选择

最终项目采用 A 版 `proact-gpt55-review-latest-20260517/frontend` 的静态 HTML/CSS/JS 作为底座。原因是 A 版已有 4 个可用原型流程视频、demo-first 结构、移动端处理和可信度边界；B 版是 React/Vite 项目，视觉表达更强，但包含占位媒体、路线图区块和未经支撑的结果数字，不适合作为整体底座迁移。

## 从 A 版保留

- 4 个原型流程视频与海报素材：finance、engineering、care、casework。
- demo-first 的页面主线：Hero 后立即进入 Demo 区。
- 虚构场景、合成事实表、不含真实用户数据、不代表线上生产效果的边界说明。
- 静态项目交付方式，最终目录不依赖原 zip 的临时路径。

## 从 B 版吸收

- Hero 右侧的空闲窗口 trace 表达，改写为中文为主的“空闲窗口示例 trace（虚构）”。
- 五步 pipeline 卡片，用于替代过重的论文式大图主阅读路径。
- Push / Queue / Drop 的交付策略表达，并统一到安全边界与机制区。
- 更有传播力的“从等待到准备”叙事，但删除了不可靠的 dashboard 式结果呈现。

## 删除或降级

- 删除所有没有完整实验报告、baseline、数据集定义和可复现说明支撑的结果数字。
- 删除视频占位框、预留媒体描述、内部 mock 说明、伪链接和联系入口。
- 删除路线图区块。
- 将评测区改为“评测设计”，不展示无来源 benchmark 结果。
- 不暗示系统会自动安排会议、发送邮件、提交表单、变更账户、处理医疗/福利/金融敏感动作或修改生产系统。

## 如何运行

直接打开：

```bash
open merged-proact-showcase/index.html
```

或启动本地静态服务：

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory merged-proact-showcase
```

然后访问 `http://127.0.0.1:4173/`。

## Smoke Test

运行：

```bash
node merged-proact-showcase/site-smoke.mjs
```

测试覆盖：

- 必要 HTML/CSS/JS、海报和 4 个 mp4 素材存在。
- 主要 section 顺序为 Hero、Demo、价值、对比、机制、安全、评测设计、FAQ、CTA。
- CTA 和导航锚点指向真实 section。
- 页面不包含占位媒体、伪链接、未经支撑的结果数字等高风险公开内容。
- 本机可用 Playwright 或 Chrome DevTools 时，检查 390px 移动端无页面级横向溢出，并确认 Demo 区进入首屏附近。

可选导出移动端截图：

```bash
PROACT_MOBILE_SCREENSHOT=/private/tmp/proact-merged-mobile.png node merged-proact-showcase/site-smoke.mjs
```

## 已执行检查

- `node merged-proact-showcase/site-smoke.mjs`
- `PROACT_MOBILE_SCREENSHOT=/private/tmp/proact-merged-mobile-cdp-2.png node merged-proact-showcase/site-smoke.mjs`
- `python3 -m http.server 4173 --bind 127.0.0.1 --directory merged-proact-showcase`
- `curl -I http://127.0.0.1:4173/`
- Headless Chrome 截图自检：桌面 `/private/tmp/proact-merged-desktop.png`，移动端 `/private/tmp/proact-merged-mobile-cdp-2.png`

## 仍需人工补充

- 若后续有正式论文、代码仓库、可复现实验报告或公开 demo 地址，可以补充真实链接；当前页面故意不放空链接。
- 若未来有真实系统录屏，可以替换现有原型流程视频，但需要继续保留虚构数据和用户确认边界说明。
