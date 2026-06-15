# KeysArk SEO 优化方案

> Created: 2026-06-15

## 结论

- 做四件事:① 把 `/docs` 从纯客户端渲染改为服务端渲染(命令文档进 HTML),并补它缺失的多语言 metadata;② 补全站点结构化数据(Article / Organization / WebSite / BreadcrumbList / FAQPage JSON-LD)与 sitemap 精度(`lastModified` / `article:modified_time`);③ 把多语言从 en/zh 扩到 **9 种 LTR 主流语言**(en, zh, es, fr, de, ja, ko, pt, ru):UI 文案 + blog 正文全部机翻,缺失键运行时回退 en,sitemap/hreflang 随 `LOCALES` 自动覆盖全部语言;④ **内容/相关性 SEO**:为长尾目标词建"一词一页"着陆页 + FAQ + landing 正文融入目标词,把现状"目标词只在 meta、不在正文、只有一个通用落地页"补成"每个搜索意图有专属可索引页面"。
- 不做:blog 文章页"显式设 `openGraph.images`"——已实测 HTML 已注入 `og:image`/`twitter:image`(Next 文件约定自动生效),无需改;不纳入 RTL 语言(阿拉伯语等),避免全站 `dir` 适配;不硬蹭"密码管理器/password manager"红海词(被 1Password/Bitwarden 垄断、意图错配),主攻长尾蓝海 + "免费/开源"修饰词。
- 完成的可观测信号:
  - `curl /docs` 与 `curl /zh/docs` 返回的 HTML 直接包含全部 `ark` 命令名与示例文本(不需 JS);两页各有正确的 `canonical` 与 `hreflang`。
  - blog 文章页 HTML 含 `application/ld+json` 的 `Article`;根布局 HTML 含 `Organization` + `WebSite`;blog 列表/文章含 `BreadcrumbList`。
  - `sitemap.xml` 每条 `<url>` 带 `<lastmod>`,且 `alternates.languages` 列出全部 9 种语言;blog 文章页含 `article:modified_time`。
  - sitemap.xml 是合法 XML、全部为绝对 https 生产-域 URL,可直接在 Google Search Console「站点地图」提交并被抓取;HTML `<head>` 含 `google-site-verification`(由环境变量提供)用于 GSC 站点验证;`robots.txt` 声明 `Sitemap:` 指向它。
  - `curl /es`、`/fr`、`/ja`、`/ru` … 9 种语言各返回本地化 HTML;每页 `hreflang` 含 9 条 + `x-default`;任一未翻译 key 渲染为 en 文案而非报错/空白。
  - 每个长尾目标词有一个专属着陆页(如 `/open-source-password-manager`、`/free-secrets-vault`、`/env-file-backup`、`/bip39-backup`),H1/标题/正文围绕该词、内链回主站、进 sitemap;landing 与着陆页含 FAQPage JSON-LD。

## 约束(推导依据)

- 多语言为"不同 URL":默认 `en` 无前缀,`zh` 走 `/zh` 前缀,`src/proxy.ts` 按 `x-locale` 请求头内部 rewrite,`/en/*` 301 → 无前缀。hreflang 架构成立(`src/lib/locale-server.ts:getServerLocale`、`src/lib/i18n.ts:localeHref`)。
- 现状已具备:根 `layout.tsx:generateMetadata` 有 openGraph/twitter/robots/keywords + `metadataBase`;`page.tsx`/`about`/`blog`/`blog/[slug]`/`privacy` 各自带 `alternates.canonical` + `languages`;`sitemap.ts` 已含全路由 + 每条 `alternates.languages`;`robots.ts` 已 disallow `/api/`、`/google/`、`/cli-auth`。
- 唯一整页不可索引页:`/docs`。`src/components/docs.tsx` 是 `"use client"`,命令表(`COMMANDS`)、示例(`EXAMPLES`)、选项、env 全在 JS bundle 内;`src/app/docs/page.tsx:4-8` 用静态 `metadata`,英中混写,缺 `generateMetadata`/`canonical`/`hreflang`。
- 结构化数据现状:仅 `src/components/landing.tsx:120-146` 首页未登录时输出 `SoftwareApplication`。无 Organization / WebSite / Article / BreadcrumbList。
- sitemap(`src/app/sitemap.ts`)每条缺 `lastModified`;数据源 `src/lib/content/blog.ts:POSTS` 每篇有 `date`(ISO),可作 lastmod 与 `article:modified_time` 的来源。
- 站点绝对 URL 全部来自 `NEXT_PUBLIC_SITE_URL`(layout/robots/sitemap/_card 各自定义),未设时回退 `localhost`,会污染 canonical/og/sitemap。无构建期校验。
- i18n 规模:`src/lib/i18n.ts` 632 个文案 key,en/zh 双语**手写**,`Locale = "zh"|"en"`,`MsgKey` 由词典推导;`htmlLang()`(line 860)做 locale→html lang 映射。每加一种语言 = 632 条文案。
- blog 规模:`src/lib/content/blog.ts` 5 篇文章,标题/描述/正文 blocks 手写双语(`{ en, zh }`)。blog 全语言 = 5×9=45 篇正文。
- 路由数据驱动:`src/proxy.ts` 完全靠 `LOCALES`/`NON_DEFAULT_LOCALES` 驱动(前缀 rewrite + `/en/*` 308 + `x-locale` 头),扩 `LOCALES` 数组即自动支持新前缀,**路由逻辑零改动**。
- OG 卡片字体限制:`_card/render.tsx` 仅打包 Inter 拉丁子集,标题取 `post.en.title`。拉丁语(es/fr/de/pt)Inter 覆盖;CJK(zh/ja/ko)、西里尔(ru)无字体。
- sitemap hreflang 现为硬编码 en+zh-CN(`src/app/sitemap.ts`),需改成遍历 `LOCALES`。

## 关键决策

- Docs SSR 拆分方式:静态内容(命令表 / 示例 / 选项 / env 文本)在 server component 直接渲染进 HTML,只把交互(复制按钮等)留在 `"use client"` 子组件。理由:SEO 第一性目标是"爬虫拿到内容";交互不影响可索引性,无需整页 client。
- Docs metadata 改为 `generateMetadata`(对齐其它页):理由是 `/docs` 与 `/zh/docs` 是两个不同 URL 的同源内容,必须各自声明 canonical + hreflang,否则会被判重复/漏收 zh 版。
- JSON-LD 注入位置:Organization + WebSite 放根 `layout.tsx`(全站一次);Article + BreadcrumbList 放各自页面 server 渲染。理由:类型作用域与页面一致,避免全局塞入页面级类型。
- 不显式设 blog `openGraph.images`:偏离调研建议——已实测 HTML 注入成功,加显式字段是冗余且需手拼带 hash 的 URL,反而易错。
- 生产 `NEXT_PUBLIC_SITE_URL` 仅做"构建期 warn",不硬失败:理由是本地 dev 故意回退 localhost,硬失败会阻断 dev。
- 语言集合取 9 种 LTR(en, zh, es, fr, de, ja, ko, pt, ru),不含 RTL:RTL(阿拉伯/希伯来)需全站 `dir=rtl` 重排,成本高一档且当前无该市场依据。偏离"全主流语言":按搜索量与改造成本取性价比子集。
- 翻译用 LLM 机翻 + 运行时回退 en:632×9 + 45 篇正文,人工不可规模化。改 i18n 为"en 基准词典 + 各语言覆盖词典 + 缺失键回退 en",使任一语言未 100% 翻译也能上线,且 `MsgKey` 仍由 en 基准推导(类型不依赖翻译完整度)。
- blog 正文纳入全语言:由用户指定。代价是 45 篇机翻长文质量不稳——在 plan 中标注"机翻、待人工校"并保留 en 原文为权威源。
- OG 卡片字体:非拉丁语言(zh/ja/ko/ru)若不引对应字体,OG 标题回退 `post.en.title`;拉丁语言用本地标题。理由:CJK 全字体体积大,OG 仅品牌图,英文标题可接受——具体取舍留 plan 004。
- GSC 提交就绪:站点验证用 Next metadata 的 `verification.google`,值取环境变量 `GOOGLE_SITE_VERIFICATION`,留空则不输出该 meta(不写死、不污染未配置环境)。不做自动 sitemap ping —— Google 已于 2023 停用 ping 端点,收录靠 GSC 提交 + `robots.txt` 声明。sitemap/canonical 的绝对 URL 依赖 `NEXT_PUBLIC_SITE_URL` 设为生产 https 域(已有构建期 warn 兜底)。
- 选词战略:主攻长尾蓝海 + "免费/开源"修饰词(免费/开源密码管理器、免费密钥管理器、self-hosted secret vault、bip39 备份、.env 加密备份),不打裸"密码管理器"红海。依据:① keysark 真实免费开源,意图匹配;② 红海词被头部产品垄断,新站无外链难排;③ keysark 非自动填充密码管理器,硬接红海词流量会高跳出反伤排名。`meta_keywords` 标签不动也不靠它——Google 2009 起不用于排名。
- 着陆页"一词一页":每个搜索意图独立页面、独立 H1/原创正文,不靠单一落地页蹭所有词。依据:Google 按页面级语义与意图排序,一页无法同时满足"免费密码管理器"(消费向)与"开发密钥管理"(开发者向)两种意图。

## 未决 / 信息不足(非代码交付,排名真正天花板)

- **域名权威度/外链**:代码做不了,是新站排名上限。需站外人工:GitHub README/topics/star、Product Hunt、Hacker News、Reddit、AlternativeTo、Awesome 列表收录、被技术博客引用获取反向链接。本提案不含,但若缺外链,着陆页做得再好也难排中高竞争词。
- **关键词搜索量/竞争度未度量**:目标词的实际月搜索量与难度未用工具(GSC/Ahrefs/Semrush)量化,着陆页选词清单按"意图匹配 + 真实属性"推导,上线后需用 GSC 实际曝光/点击数据回灌、增删着陆页。

## Plans 拆分

执行顺序:003(i18n 地基)先行;004/001/002/005 依赖 003 扩展后的 `LOCALES`。

| 编号 | 标题 | 路径 | 依赖 | 状态 |
|---|---|---|---|---|
| 003 | 多语言地基:9 语言 i18n + 路由/hreflang locale 化 | `plans/003-i18n-nine-languages.done.md` | - | 已完成 |
| 004 | blog 内容多语言 + OG 卡片 locale 化 | `plans/004-blog-multilingual-and-og.done.md` | 003 | 已完成 |
| 001 | Docs 页服务端渲染 + 多语言 metadata | `plans/001-docs-ssr-and-metadata.done.md` | 003 | 已完成 |
| 002 | 结构化数据与 sitemap/metadata 精化 | `plans/002-structured-data-and-sitemap.done.md` | 003 | 已完成 |
| 005 | 内容/相关性 SEO:长尾着陆页 + FAQ + landing 选词 | `plans/005-content-seo-landing-pages.done.md` | 003, 002 | 已完成 |
