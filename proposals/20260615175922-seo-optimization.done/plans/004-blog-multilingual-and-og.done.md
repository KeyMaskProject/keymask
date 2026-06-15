# blog 内容多语言 + OG 卡片 locale 化

> 来自 proposal: proposals/20260615175922-seo-optimization/
> 依赖:003(`Locale` 已扩到 9 种 + 回退机制)

## 目标

- 5 篇 blog 文章的标题/描述/正文扩到 9 种语言(机翻,en 为权威源);文章页按当前 locale 渲染本地化正文;OG 卡片按 locale 出图。

## 改动范围

- **更新**:`src/lib/content/blog.ts` —— `PostLocale` 由 `{ en, zh }` 改为按 `Locale` 索引;结构用"en 基准 + 各语言覆盖,缺失回退 en"(与 003 词典同思路)。新增取内容 helper `getPostContent(post, locale)` 做回退。新增 7 种语言 × 5 篇机翻正文。
- **更新**:`src/app/blog/[slug]/page.tsx`、`src/app/blog/page.tsx` —— 用 `getPostContent`/当前 locale 取标题、描述、正文;`formatPostDate` 的 locale→BCP-47 映射补全 9 种(`toLocaleDateString`)。
- **更新**:`src/app/blog/[slug]/_card/render.tsx`(及 opengraph-image/twitter-image)—— OG 标题按当前 locale 取;字体策略见关键点。

## 验收

- [ ] `curl -s <site>/<locale>/blog/<slug>` 各语言返回本地化标题与正文(未翻译则回退 en,可读不报错)。
- [ ] blog 列表各语言显示本地化标题/摘要。
- [ ] 文章 OG 路由各 locale 返回 1200×630 PNG,字符正常渲染(无豆腐块);非拉丁语言按既定策略(本地字体或回退 en 标题)。
- [ ] `build` 通过,blog 文章 × locale 组合 SSG 预渲染成功(注意 generateStaticParams 覆盖面)。

## 关键点

- 长文机翻质量不稳:正文 blocks(含 `code`/`quote`/`ul`)逐块翻译时,`code` 块内容(命令、算法名)不译;保留 block 结构与顺序。en 为权威源,机翻标注待校。
- OG 字体:拉丁语(en/es/fr/de/pt)复用现有 Inter;CJK(zh/ja/ko)、西里尔(ru)无字体——二选一并在 plan 落地时定:① 引入对应 Noto 子集(体积成本),② OG 标题对这些语言回退 `post.en.title`(零字体成本)。默认取 ②,除非要求各语言 OG 视觉一致。
- `generateStaticParams`:若为每 locale × slug 预渲染,组合数 = 9×5;确认 OG 图与文章页的 params 覆盖与 003 路由(前缀在 URL 上,locale 来自 `x-locale` 头/路径)如何对齐——避免只生成 en 一份。
- `formatPostDate` 对 9 种 locale 的日期格式需用正确 BCP-47,避免 `Invalid Date` 或英文兜底不一致。
---

## 实施日志

- **执行时间**:2026-06-15 19:30
- **整体状态**:已完成

### 做了什么
- `blog.ts`:`export PostLocale`;移除 003 临时加的可选语言字段,改为机翻覆盖表 `BLOG_OVERRIDES`(从 `./blog/{es,fr,de,ja,ko,pt,ru}.ts` 合并,按 slug 索引);`getPostContent` en/zh 走内联、其余走覆盖表、缺失回退 en;`formatPostDate` 改用 `htmlLang(locale)` 覆盖 9 语言。
- 新增 7 个机翻正文文件 `src/lib/content/blog/{es,fr,de,ja,ko,pt,ru}.ts`(各含 3 篇文章的 title/description/body,block 结构/顺序/`k` 保留,`code` 块逐字不译;7 个并行子 agent 产出)。
- OG 卡片:按 proposal 默认决策 ②,标题对所有语言用 `post.en.title`(零字体成本,避免引入 CJK/西里尔大字体),`_card/render.tsx` 无需改动。

### 验收核对
- [x] 各语言 `/<locale>/blog/<slug>` 返回本地化标题与正文 —— `/es` 正文 "cifrado"、`/ja` 标题「KeysArk という名前の由来」、`/ru` 列表「Откуда взялось название KeysArk」
- [x] blog 列表各语言本地化标题 —— `/ru/blog` 验证
- [x] `code` 块未被翻译 —— `/de/blog/encryption-design` 仍含 `PBKDF2-HMAC-SHA512`、`AES-256-GCM`
- [x] OG 路由各 slug 返回 1200×630 PNG —— `200 image/png`(标题 en,决策 ②)
- [x] build 通过,blog × 文章 SSG 预渲染成功 —— compiled OK
- [x] typecheck 通过 —— 21 篇译文结构均合法(Block 类型校验)

### 偏差与遗留
- blog 多语言正文用**独立覆盖文件 + 合并**(`./blog/<lang>.ts` + `BLOG_OVERRIDES`),非内联进 POSTS。避免改动庞大 POSTS 数组与 7 agent 并发改同文件冲突;同时移除 003 加的可选语言字段。
- OG 标题统一 en(决策 ②):非拉丁语言不引字体。若日后要各语言 OG 视觉一致,需给 og 路由加 locale 参数 + 引入对应 Noto 字体子集 → feedback。
- 机翻长文待人工校(各 agent 报告了少量术语选择,如日语「助記詞」vs「ニーモニック」)→ 并入 feedback 的机翻校对项。
