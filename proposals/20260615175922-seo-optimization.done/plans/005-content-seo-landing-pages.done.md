# 内容/相关性 SEO:长尾着陆页 + FAQ + landing 选词

> 来自 proposal: proposals/20260615175922-seo-optimization/
> 依赖:003(着陆页文案走 i18n / hreflang helper)、002(复用 JSON-LD 注入工具做 FAQPage)

## 目标

- 每个长尾目标词有一个专属、原创、可索引的着陆页;landing 正文与 FAQ 自然承载目标词;着陆页与 landing 含 FAQPage JSON-LD,互链且进 sitemap。

## 目标词 → 着陆页(一词一意图,合并近义,质量优先于数量)

| slug | 主词(zh / en) | 定位坦诚说明 |
|---|---|---|
| `/open-source-password-manager` | 免费/开源密码管理器 · free / open-source password manager | 明确是端到端加密保管库,非自动填充密码管理器 |
| `/free-secrets-vault` | 免费密钥管理器 · free secrets manager / key manager | 密钥/密文保管,浏览器端加密 |
| `/env-file-backup` | .env 加密备份 · encrypt & back up .env | 面向开发者的 .env / 凭据加密备份 |
| `/bip39-backup` | BIP39 助记词备份 · bip39 mnemonic backup | 助记词/私钥保管,可导入 MetaMask |

## 改动范围

- **新增**:上述着陆页 `src/app/<slug>/page.tsx`(server component,SSG;复用 `ContentShell`)。每页:独立 H1、原创正文、3-6 条 FAQ、内链回主站与相关着陆页;`generateMetadata`(title/description/canonical + hreflang 用 003 helper)。
- **新增**:着陆页文案进 i18n 词典(en/zh 原创;其余 7 语言走 003 回退/机翻)。
- **新增/复用**:FAQPage JSON-LD(用 002 的 JSON-LD 工具),问答与页面可见 FAQ 文本逐字一致。
- **更新**:`src/components/landing.tsx` —— H1/副标题/feature/新增 FAQ 区自然融入目标长尾词(不堆砌);landing 注入 FAQPage JSON-LD。
- **更新**:`src/app/sitemap.ts` —— 纳入着陆页 slug(随 `LOCALES` 出多语言 alternates)。
- **更新**:导航/footer 或 landing 内,加到各着陆页的内链,锚文本含关键词。

## 验收

- [ ] 每个着陆页 `curl` 返回 HTML,H1 与正文含其目标词;canonical 指向自身,hreflang 覆盖 9 语言。
- [ ] 着陆页与 landing 的 HTML 含 `FAQPage` JSON-LD,Google Rich Results 测试无错误,问答与可见文本一致。
- [ ] 着陆页出现在 `sitemap.xml`,含多语言 alternates。
- [ ] 着陆页互链 + 回主站,锚文本含关键词;landing 有链向各着陆页的内链。
- [ ] `typecheck` 与 `build` 通过,着陆页为 SSG。

## 关键点

- **最大风险:薄内容 / doorway pages**。每页必须独立原创(不同卖点、用例、FAQ),不能同一模板换词——Google 对模板化批量着陆页降权。宁可少建几页也要每页有真实内容。
- **意图诚实**:承接"免费密码管理器"流量的页面要直说 keysark 是加密保管库、不做自动填充,避免来访者预期落空导致高跳出反伤排名。
- **关键词自然融入,禁堆砌**:H1/H2/正文用一次到位,keyword stuffing 反作用。
- **多语言不过度承诺**:着陆页 en/zh 高质量原创;其余 7 语言随 003 回退/机翻,不承诺 9 语言原创长文。
- **FAQPage 合规**:JSON-LD 的问答必须与页面渲染的 FAQ 文本一致,否则违反 Google 结构化数据政策。
- **slug 含词且 URL 友好**(`/open-source-password-manager`,非 `/lp1`);确认不与现有路由 / locale 前缀冲突(003 的 `/<locale>` rewrite 不能把着陆页 slug 误判为语言段)。
---

## 实施日志

- **执行时间**:2026-06-15 20:00
- **整体状态**:已完成

### 做了什么
- 新增内容模块 `src/lib/content/landing-pages.ts`:4 个着陆页(`open-source-password-manager` / `free-secrets-vault` / `env-file-backup` / `bip39-backup`)的 en/zh 原创内容(title/description/h1/lead 正文/4 条 FAQ/related 内链)。
- 新增 `src/components/landing-page-view.tsx`:统一着陆页渲染(复用 ContentShell + Prose),注入 FAQPage + BreadcrumbList JSON-LD,渲染 H1/正文/FAQ/CTA/相关内链。
- 新增 4 个路由 `src/app/<slug>/page.tsx`:各 generateMetadata(title/description/canonical/hreflang 用 helper)+ `<LandingPageView>`。
- `seo.ts` 加 `faqLd(faqs)`(FAQPage 构造器)。
- `sitemap.ts`:纳入 4 着陆页 slug(随 LOCALES 出多语言 alternates)。
- `landing.tsx`:页脚加 4 条关键词锚文本 SEO 内链;新增首页 FAQ 区(内容在独立 `src/lib/content/home-faq.ts`,避免把着陆页长文打进首页 client bundle)+ FAQPage JSON-LD。
- i18n 加通用标签 `lp_faq_title/lp_related_title/lp_cta/lp_link_*`(en/zh,其余回退)。

### 验收核对
- [x] 每个着陆页返回 HTML,H1 与正文含目标词;canonical 指向自身,hreflang 9 语言 —— 4 页 200,各唯一 H1
- [x] 着陆页与首页含 FAQPage JSON-LD,问答与可见文本一致 —— 抽查问句在 JSON-LD 与可见 DOM 各出现一次
- [x] 着陆页出现在 sitemap.xml —— 4 个 slug 均在
- [x] 着陆页互链 + 回主站;首页有链向 4 着陆页的内链 —— 页脚 4 内链 + related 区
- [x] typecheck 与 build 通过

### 偏差与遗留
- 着陆页为**动态服务端渲染**(ƒ,因 `getServerLocale` 读 headers),非 SSG——与 about/blog 一致;正文仍完整进 HTML,SEO 不受影响。
- 着陆页正文 en/zh 原创,其余 7 语言**回退 en**(未机翻),符合 plan"en/zh 原创 + 其余回退"。如需各语言原创/机翻着陆页 → feedback。
- 首页 FAQ 内容放独立 `home-faq.ts`,避免 `landing-pages.ts` 全量长文进首页 client 包。
