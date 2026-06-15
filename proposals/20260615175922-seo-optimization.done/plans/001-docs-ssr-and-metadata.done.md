# Docs 页服务端渲染 + 多语言 metadata

> 来自 proposal: proposals/20260615175922-seo-optimization/
> 依赖:003(`LOCALES` 已扩到 9 种;hreflang/canonical 须覆盖全部语言)

## 目标

- `/docs` 及各语言变体(`/zh/docs`、`/es/docs` …)的命令文档正文在 HTML 中可直接读到(无需 JS),并各带正确 canonical + 覆盖 9 种语言的 hreflang。

## 改动范围

- **更新**:`src/components/docs.tsx` —— 拆分:静态内容(命令表 `COMMANDS`、示例 `EXAMPLES`、选项、env 文本、标题)由 server component 渲染;只把含交互的部分(复制按钮 / 任何 `useState`/事件)抽成 `"use client"` 子组件。文案仍走 i18n,按 server 传入的 locale 取。
- **更新**:`src/app/docs/page.tsx` —— 删静态 `metadata`,改 `generateMetadata`(读 `getServerLocale`),对齐 `about/page.tsx` 的写法:`title`/`description` 走 i18n,`alternates.canonical = localeHref("/docs", locale)`,`alternates.languages` 由 003 提供的 helper 遍历 `LOCALES` 生成(9 种 + `x-default`),不硬编码 en/zh。

## 验收

- [ ] `curl -s <site>/docs` 的 HTML 直接包含每个 `ark` 命令名(如 `ark sync`、`ark get`)与示例文本,grep 得到。
- [ ] `curl -s <site>/zh/docs` 同样包含命令与中文说明文本(其它语言变体随 003 词典回退,正文可读)。
- [ ] `/docs` HTML 含 `<link rel="canonical" href=".../docs">` 与覆盖 9 种语言的 hreflang + `x-default`;`/zh/docs` 的 canonical 指向 `.../zh/docs`。
- [ ] 复制按钮等交互在浏览器仍可用(client 子组件正常 hydrate)。
- [ ] `pnpm -C apps/web typecheck` 与 `build` 通过;`/docs` 在 build 输出为 SSG/SSR(非纯 client)。

## 关键点

- docs.tsx 是 `"use client"`,直接去掉指令会因事件处理/`useState` 报错;必须先定位所有交互点(复制按钮、任何状态)再抽离,残余静态部分才能 server 化。
- 文案是双语词典(`i18n.ts`),server 渲染时务必按当前 locale 取,别写死英文——否则 `/zh/docs` 内容仍是英文,hreflang 失真。
- 与 `ContentShell`(已非 client)对齐渲染外壳,避免重复造布局容器;新增/保留的布局容器按硬约束补 `testId()`。

---

## 实施日志

- **执行时间**:2026-06-15 18:45
- **整体状态**:已完成

### 做了什么
- 新增 `src/components/docs-code-block.tsx`("use client"):把唯一交互(代码块复制按钮,useState+clipboard)抽成 client 组件。
- `src/components/docs.tsx`:去掉 `"use client"`,改为服务端组件 `Docs({ locale })`;`useT()` 换成 `translate(locale, …)`;`CodeBlock` 改为 import 自新 client 组件;移除 useState/Check/Copy。命令表/选项/env/示例/Section 等静态内容均服务端渲染。`HeaderControls`(client)作为岛屿嵌入。
- `src/app/docs/page.tsx`:删静态 `metadata`,改 `generateMetadata`(title/description 走 i18n,canonical=`localeHref("/docs")`,hreflang 用 `buildLanguageAlternates`);页面 `await getServerLocale()` 后 `<Docs locale={locale} />`。

### 验收核对
- [x] `/docs` HTML 直接含每个 `ark` 命令名与示例文本(无需 JS)—— grep 到 ark get/login/reset-anchor/save/sync、`npm install -g @keysark/cli`、`ark get github.com/me/app/.env`
- [x] `/zh/docs` 含命令与中文说明,canonical=`/zh/docs`
- [x] `/docs` canonical=`/docs` + 10 条 hreflang(9 语言 + x-default)
- [x] 复制按钮(client 岛屿)仍在 —— `aria-label="copy install/login"`
- [x] typecheck 与 build 通过;`/docs` 为 SSG/SSR(非纯 client)

### 偏差与遗留
- docs 页保留其专属极光背景布局(未强行套用 about 的 `ContentShell`)——plan 关键点提到"与 ContentShell 对齐",但 docs 的视觉外壳本就与内容页不同,沿用原布局更稳,未新增重复布局容器。
