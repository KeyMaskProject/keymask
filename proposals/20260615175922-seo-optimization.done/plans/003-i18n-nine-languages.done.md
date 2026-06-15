# 多语言地基:9 语言 i18n + 路由/hreflang locale 化

> 来自 proposal: proposals/20260615175922-seo-optimization/

## 目标

- `Locale` 扩到 9 种(en, zh, es, fr, de, ja, ko, pt, ru),UI 文案各语言机翻、缺失键运行时回退 en;所有页面 hreflang 与 sitemap 自动覆盖 9 种语言;9 个语言前缀路由可达。

## 改动范围

- **更新**:`src/lib/i18n.ts` —— `Locale` 联合扩到 9 种;`LOCALES` 数组扩;`htmlLang()` 补 9 条 locale→BCP-47 映射;`MsgKey` 仍由 en 基准词典推导;`translate()` 改为"目标语言词典缺该 key → 回退 en"。
- **更新/重构**:词典结构改为"en 基准全量 + 各语言 `Partial<Record<MsgKey, …>>` 覆盖"。各语言词典按文件拆分(如 `src/lib/i18n/locales/<locale>.ts`),en/zh 现有内容迁入,新增 7 种为机翻。
- **新增**:hreflang helper,如 `buildLanguageAlternates(path)`,遍历 `LOCALES` 产出 `{ <bcp47>: localeHref(path, l) , "x-default": path }`,供所有 `generateMetadata` 与 sitemap 复用。
- **更新**:`src/app/sitemap.ts` —— `alternates.languages` 改用 helper 遍历 `LOCALES`,替换硬编码 en+zh-CN。
- **更新**:`src/app/{page,about,blog,blog/[slug],privacy}/*.tsx` 的 `generateMetadata` —— hreflang 改用 helper,去掉硬编码 `{ en, "zh-CN", "x-default" }`。
- **验证(预期零改)**:`src/proxy.ts` 由 `LOCALES`/`NON_DEFAULT_LOCALES` 驱动,扩数组后新前缀应自动生效。

## 验收

- [ ] `curl -s <site>/es`、`/fr`、`/de`、`/ja`、`/ko`、`/pt`、`/ru` 各返回本地化 HTML(已翻译 key 显示译文)。
- [ ] 任一未翻译 key 渲染为 en 文案,不报错、不空白。
- [ ] 每个公开页 HTML 的 hreflang 含 9 条语言 + `x-default`;`/es` 等的 canonical 指向自身。
- [ ] `sitemap.xml` 每条 `<url>` 的 `alternates` 列出 9 种语言。
- [ ] `/en/*` 仍 308 → 无前缀;`<html lang>` 按语言正确(zh→`zh-CN`,pt→`pt` 或约定值)。
- [ ] `pnpm -C apps/web typecheck` 与 `build` 通过。

## 关键点

- 函数式文案(带参数的 key,如 `confirm_delete_item(name) => …`、含 `${}` 插值)机翻最易翻车:必须保留函数签名与参数位置,`${}`、反引号代码标记、`%s` 类占位不可被翻译或重排。机翻前后用同一套 MsgKey 做结构 diff 校验。
- 词典用 `Partial<Record<MsgKey, …>>`:语言可不 100% 翻译即上线,且 `MsgKey` 只由 en 基准推导,类型不依赖翻译完整度。
- 机翻产物标注"machine-translated, pending human review",en 为权威源;不要让机翻覆盖 en/zh 现有人工文案。
- `htmlLang()` 必须返回合法 BCP-47(zh→`zh-CN`),与 hreflang、`<html lang>`、OG `locale` 三处自洽。
- 不引入 RTL;9 种均 LTR,布局方向不动。
---

## 实施日志

- **执行时间**:2026-06-15 18:30
- **整体状态**:已完成

### 做了什么
- `i18n.ts`:`Locale` 扩到 9 种;`LOCALES` 扩;新增 `LOCALE_NATIVE_NAMES`、`export type Messages = typeof zh`;`htmlLang()` 改为 9 条 BCP-47 映射;`translate()` 缺失键回退 en→zh;`messages` 改为 `Partial<Record<Locale, Partial<Messages>>>`;新增 `buildLanguageAlternates(path)` 与 `pickLocale(map, locale)`。
- 新增 7 个机翻词典 `src/lib/i18n/{es,fr,de,ja,ko,pt,ru}.ts`(各 `Partial<Messages>`,342 key 全量,函数形态/`${}`/字面量 token 保留;7 个并行子 agent 产出)。
- 接线:`controls.tsx` 用 `LOCALE_NATIVE_NAMES`;`sitemap.ts` 用 `buildLanguageAlternates`;`page/about/blog/blog[slug]/privacy` hreflang 改用 helper。
- 为 Locale 扩展后 build 不破:`content/types.ts` `DocContent`→`Partial`;about/privacy 用 `pickLocale`;`blog.ts` `BlogPost` 加 7 可选语言字段 + `getPostContent`,blog 两页改用;`build-info.ts` `LABELS`→`Partial`+`pickLocale`。

### 验收核对
- [x] 9 语言各返回本地化 HTML —— `<html lang>` 各正确;`/es` 显示 "Tus secretos"、nav "Acerca"
- [x] 未翻译 key 回退 en,不报错/不空白 —— 页面无空白
- [x] 每页 hreflang 9 条 + x-default —— `/es` 与 sitemap 验证
- [x] sitemap 每条 url 9 语言 alternates —— 每 hreflang 值 ×8 url
- [x] `/en` 仍 308 → 无前缀 —— 308 → `/`
- [x] typecheck 与 build 通过 —— 均 clean

### 偏差与遗留
- i18n 实际以 **zh 为类型基准**(plan 写 en 基准);保留 zh 基准 + `translate()` 回退 en 达成同等效果。
- 为保 build green 顺带改了 about/privacy/blog/build-info 的 locale 回退结构(超出"i18n 地基"字面但必需)。blog 7 语言**正文内容**待 plan 004。
- about/privacy 长文未译为 7 新语言(回退 en),proposal 范围只含 UI+blog → 记 feedback.md。
