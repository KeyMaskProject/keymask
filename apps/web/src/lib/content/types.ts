import type { Block } from "@/components/prose";
import type { Locale } from "@/lib/i18n";

/** 一篇内容页(about / privacy)的双语数据。 */
export interface DocPage {
  title: string;
  description: string;
  body: Block[];
}

// en/zh 为全量;其余语言可缺省,读取时回退 en(见 i18n 的 pickLocale)。
export type DocContent = Partial<Record<Locale, DocPage>>;
