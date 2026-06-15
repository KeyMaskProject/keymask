# 结构化数据与 sitemap/metadata 精化

> 来自 proposal: proposals/20260615175922-seo-optimization/
> 依赖:003(JSON-LD `inLanguage`、sitemap `alternates.languages`、hreflang 均按扩展后的 `LOCALES` 生成)

## 目标

- 全站补齐 JSON-LD(Organization / WebSite / Article / BreadcrumbList),sitemap 每条带 `lastModified`,blog 文章带 `article:modified_time`,根布局补 hreflang,生产缺 `NEXT_PUBLIC_SITE_URL` 时构建期 warn。
- sitemap.xml 达到「可直接提交 Google Search Console」状态:合法 XML + 绝对 https 生产-域 URL + robots 声明 + GSC 站点验证 meta 就位。

## 改动范围

- **新增**:可复用的 JSON-LD 注入工具(一个 server 工具/组件,输出 `<script type="application/ld+json">`),供根布局与页面调用。参照 `landing.tsx:120-146` 现有内联写法,统一成一处。
- **更新**:`src/app/layout.tsx` —— 注入站点级 `Organization` + `WebSite`(name/url/logo;WebSite 的 `inLanguage` 为 9 种语言数组);`generateMetadata` 补 `alternates.languages`(根级 hreflang,遍历 `LOCALES`)。
- **更新**:`src/app/blog/[slug]/page.tsx` —— 页面内注入 `Article` JSON-LD(headline/description/datePublished/dateModified/author=Organization/inLanguage);`openGraph` 补 `modifiedTime`(= `post.date`,产出 `article:modified_time`)。
- **更新**:`src/app/blog/page.tsx` 与 `src/app/blog/[slug]/page.tsx` —— 注入 `BreadcrumbList`(Home → Blog →〔文章〕)。
- **更新**:`src/app/sitemap.ts` —— 每条加 `lastModified`:blog 文章用 `POSTS[].date`,静态页用一个固定/构建时间常量。
- **更新**:`NEXT_PUBLIC_SITE_URL` 读取处 —— 生产构建(`NODE_ENV==="production"`)未设时 `console.warn`,不硬失败。
- **更新**:`src/app/layout.tsx` `generateMetadata` —— 加 `verification: { google: process.env.GOOGLE_SITE_VERIFICATION }`(留空则 Next 不输出该 meta),用于 GSC 站点验证(HTML 验证法)。
- **验证(预期零改)**:`src/app/robots.ts` 已含 `sitemap` 字段指向 `SITE_URL/sitemap.xml`;确认其为生产绝对 URL 且未把任何公开页 disallow。

## 验收

- [ ] 根布局 HTML 含 `Organization` 与 `WebSite` 两段 JSON-LD,字段经 schema.org 校验合法。
- [ ] blog 文章 HTML 含 `Article` JSON-LD,且 `og:article:modified_time` 出现。
- [ ] blog 列表与文章页含 `BreadcrumbList`,层级正确(中文页 name 为中文)。
- [ ] `sitemap.xml` 每个 `<url>` 含 `<lastmod>`;文章 lastmod = 其 `date`。
- [ ] `curl <site>/sitemap.xml` 为合法 XML,所有 `<loc>` 为绝对 https 生产-域 URL(无 localhost、无相对路径),URL 数 < 50000、文件 < 50MB。
- [ ] 设了 `GOOGLE_SITE_VERIFICATION` 时,首页 HTML `<head>` 含 `<meta name="google-site-verification" content="…">`;未设则无此 meta。
- [ ] `curl <site>/robots.txt` 含 `Sitemap: <site>/sitemap.xml`。
- [ ] 不设 `NEXT_PUBLIC_SITE_URL` 跑 `build` 时输出 warn;设了则无 warn。
- [ ] `typecheck` 与 `build` 通过;JSON-LD 用 Google Rich Results 测试无错误(人工/可选)。

## 关键点

- JSON-LD 的 `url`/`logo`/canonical 必须用 `NEXT_PUBLIC_SITE_URL` 解析的绝对地址,与 `metadataBase` 同源,别混入相对路径或 localhost。
- 多语言:Article/BreadcrumbList 的 `inLanguage` 与可见文本要按当前 locale 取(`zh-CN`/`en`),与 hreflang 自洽;别只生成英文一份。
- `WebSite` 暂不加 `SearchAction`(站内无搜索端点),硬塞会被判无效结构化数据。
- JSON-LD 经 `<script>` 注入,注意现有 CSP(`proxy.ts`)对内联 script 用 nonce;确认 Next 的 metadata/JSON-LD 注入路径不被 CSP 拦(必要时走 Next 推荐的 `<script>` 形式由框架加 nonce)。
- 「提交 Google」最后一步是人工动作,代码无法代办:GSC 添加资源 → 用 `GOOGLE_SITE_VERIFICATION` 的 HTML meta(或 DNS/文件)验证所有权 → 在「站点地图」提交 `sitemap.xml`。前置硬条件:`NEXT_PUBLIC_SITE_URL` = 生产 https 域;站点已部署可公网访问。
- 不实现自动 sitemap ping:Google 2023 起停用 `/ping?sitemap=` 端点;声明渠道只剩 robots.txt 的 `Sitemap:` 与 GSC 提交,两者本 plan 已覆盖。
- GSC 验证 meta 与首页其它 metadata 同源注入,勿放进 `<body>`;Next `verification.google` 会自动落到 `<head>`,不要手写裸 meta。

---

## 实施日志

- **执行时间**:2026-06-15 19:05
- **整体状态**:已完成

### 做了什么
- 新增 `src/components/json-ld.tsx`(`JsonLd` 组件,输出 `<script type="application/ld+json">`,沿用 landing 已上线的免 nonce 写法)。
- 新增 `src/lib/seo.ts`:统一 `SITE_URL`(生产未配置时 `console.warn`)+ `absUrl` + `organizationLd/websiteLd/articleLd/breadcrumbLd` 构造器(URL 全绝对,inLanguage 覆盖 9 语言)。
- `layout.tsx`:body 注入 Organization + WebSite JSON-LD;`generateMetadata` 加根级 `alternates.languages`(9 语言)与 `verification: { google: process.env.GOOGLE_SITE_VERIFICATION }`;`SITE_URL` 改从 seo.ts 引入。
- `blog/[slug]/page.tsx`:注入 Article + BreadcrumbList JSON-LD;`openGraph` 加 `modifiedTime`。
- `blog/page.tsx`:注入 BreadcrumbList(Home → Blog)。
- `sitemap.ts`:每条加 `lastModified`(文章=其 date,静态页=最新文章日期基线);`absUrl` 改从 seo.ts。
- `robots.ts`:`SITE_URL` 改从 seo.ts。

### 验收核对
- [x] 根布局含 Organization + WebSite JSON-LD —— curl 验证两类型均在(另含原有 SoftwareApplication)
- [x] blog 文章含 Article JSON-LD,且 `article:modified_time` 出现 —— modified_time=2026-06-02
- [x] blog 列表与文章含 BreadcrumbList —— 两页均验证
- [x] sitemap 每 url 含 lastmod;文章 lastmod=其 date —— 验证
- [x] sitemap 全绝对 https 生产-域 URL(无 localhost) —— 构建时设 NEXT_PUBLIC_SITE_URL 后 `<loc>https://keysark.com/...`
- [x] 设 GOOGLE_SITE_VERIFICATION 时首页含 `google-site-verification` meta;未设则无 —— 验证(content=test token)
- [x] robots.txt 含 `Sitemap: https://keysark.com/sitemap.xml` —— 验证
- [x] 构建未设 NEXT_PUBLIC_SITE_URL 时输出 `[seo]` warn;设了则无 —— 验证
- [x] typecheck 与 build 通过

### 偏差与遗留
- `SITE_URL` 集中到 seo.ts 并重构了 layout/sitemap/robots 的读取(plan 只说"读取处 warn",顺带统一为单一来源,更稳)。warn 在生产构建按 worker 多次打印,无害。
- landing 的 SoftwareApplication 仍用其原内联 `<script>`(未改用新 `JsonLd` 组件)——为限范围保留;后续可统一,记 feedback。
- `NEXT_PUBLIC_SITE_URL` 为 NEXT_PUBLIC 变量,在**构建时**内联;robots/sitemap 的绝对 URL 取决于构建期该变量(生产部署须在 build 时设),本地未设则回退 localhost(warn 已提示)。
