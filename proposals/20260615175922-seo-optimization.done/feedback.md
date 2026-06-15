# Feedback

执行 proposal 期间冒出的、未在当前会话处理的事项。收尾后由用户决定要不要新开 proposal / plan 处理。

---

## [plans/003] about / privacy 长文未译为 7 种新语言

- **类型**:范围外发现
- **位置**:`src/lib/content/about.ts`、`src/lib/content/privacy.ts`(均只有 en/zh)
- **描述**:Locale 扩到 9 种后,about/privacy 页对 es/fr/de/ja/ko/pt/ru 回退英文(`pickLocale`)。proposal 只声明"UI 文案 + blog 正文"机翻,长文内容页不在范围,故未译。
- **建议**:若要这两页也全语言,新开一份 plan 用与 004 相同的并行子 agent 机翻(各 ~1-2 屏长文 ×7 语言),结构已就绪(`DocContent` 已是 `Partial`,加语言键即可)。待决策。

## [plans/003] 机翻词典待人工校对

- **类型**:优化
- **位置**:`src/lib/i18n/{es,fr,de,ja,ko,pt,ru}.ts`
- **描述**:7 语言 UI 词典为 LLM 机翻,各子 agent 报告了若干不确定键(如 `store_baidu` 的 "Baidu netdisk" 译法、`view_flat` 短标签、复数处理、相对时间缩写)。en 为权威源。
- **建议**:上线后按 GSC 实际语言流量优先级,逐语言人工校对高曝光页(landing/定价/CTA)文案。低优先,不阻塞。

## [plans/002] landing 的 SoftwareApplication 未改用 JsonLd 组件

- **类型**:重构
- **位置**:`src/components/landing.tsx:120-146`
- **描述**:已建 `JsonLd` 统一组件并用于 Organization/WebSite/Article/Breadcrumb,但 landing 的 SoftwareApplication 仍用其原内联 `<script dangerouslySetInnerHTML>`。
- **建议**:把 landing 改用 `<JsonLd data={...} />`,删掉重复内联写法。极小改动,低优先。

## [plans/004] OG 卡片各语言视觉一致(当前 en 标题)

- **类型**:范围外发现 / 设计调整
- **位置**:`src/app/blog/[slug]/_card/render.tsx`
- **描述**:OG 分享卡片标题对所有语言用英文(决策 ②,零字体成本)。非拉丁语言(zh/ja/ko/ru)分享时卡片标题仍是英文。
- **建议**:若要各语言 OG 视觉一致,给 og/twitter-image 路由加 locale 参数(经 query 或 per-locale 预渲染),并为 CJK/西里尔引入对应 Noto 子集字体。中等成本,待 GSC 数据决定优先级。

## [plans/005] 着陆页 7 语言原创/机翻(当前回退 en)

- **类型**:范围外发现
- **位置**:`src/lib/content/landing-pages.ts`、`src/lib/content/home-faq.ts`
- **描述**:4 个长尾着陆页 + 首页 FAQ 为 en/zh 原创,其余 7 语言回退 en(canonical/hreflang 仍各自正确)。
- **建议**:按 GSC 实际语言流量,对高曝光着陆页用并行子 agent 机翻 7 语言(结构已就绪:`locales` 为 `Partial<Record<Locale,...>>`,加语言键即可),再人工校 CTA/FAQ。
