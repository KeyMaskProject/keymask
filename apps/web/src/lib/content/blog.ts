import type { Block } from "@/components/prose";
import { htmlLang, type Locale } from "@/lib/i18n";
import es from "./blog/es";
import fr from "./blog/fr";
import de from "./blog/de";
import ja from "./blog/ja";
import ko from "./blog/ko";
import pt from "./blog/pt";
import ru from "./blog/ru";

export interface PostLocale {
  title: string;
  description: string;
  body: Block[];
}

export interface BlogPost {
  slug: string;
  date: string; // ISO yyyy-mm-dd
  // en/zh 为全量人工正文(本文件内);其余语言的机翻正文在 ./blog/<lang>.ts(按 slug 索引),缺失回退 en。
  en: PostLocale;
  zh: PostLocale;
}

// 各语言机翻正文覆盖表(按 slug 索引);en/zh 走 BlogPost 内联字段。
const BLOG_OVERRIDES: Partial<Record<Locale, Record<string, PostLocale>>> = { es, fr, de, ja, ko, pt, ru };

// 新到旧。
export const POSTS: BlogPost[] = [
  {
    slug: "the-name-keysark",
    date: "2026-06-02",
    en: {
      title: "Where the name KeysArk comes from",
      description: "Keys plus Ark — a small word with a deliberate idea behind it.",
      body: [
        {
          k: "p",
          t: "KeysArk is two words: Keys and Ark. The name is small, but the idea behind it is the whole product.",
        },
        { k: "h2", t: "The ark" },
        {
          k: "p",
          t: "An ark is a vessel built to carry something precious safely through danger — Noah's ark through the flood, the ark of the covenant guarding what mattered most. An ark is not a vault you visit; it is a craft that carries your valuables across time and trouble.",
        },
        { k: "h2", t: "Your keys, carried" },
        {
          k: "p",
          t: "Your keys — the recovery phrase that unlocks everything — are exactly that kind of precious cargo. KeysArk is the ark that carries them: across devices, across cloud providers, across years, without ever exposing what is inside.",
        },
        { k: "h2", t: "Sealed from the outside" },
        {
          k: "p",
          t: "There is a second meaning hiding in the word: `ark` shares a root with `arca`, Latin for a chest or strongbox. A sealed chest only the owner can open is the literal shape of zero-knowledge encryption. The ark is closed; only you hold the key.",
        },
        { k: "h2", t: "The logo" },
        {
          k: "p",
          t: "That is why the mark is a shield-shaped ark hull with a keyhole at its center and an amber key inside it. The shield is the ark carrying your keys; the keyhole is the one way in; the colour is the warmth of something kept safe. The name and the picture say the same thing — your keys, in an ark only you can open.",
        },
      ],
    },
    zh: {
      title: "KeysArk 名字的由来",
      description: "Keys 加上 Ark——一个很短的词,背后却藏着刻意的用意。",
      body: [
        {
          k: "p",
          t: "KeysArk 由两个词组成:Keys(钥匙)和 Ark(方舟)。名字很短,但它背后的理念,就是整个产品。",
        },
        { k: "h2", t: "方舟" },
        {
          k: "p",
          t: "方舟是为了载着珍贵之物、安然穿越险境而造的船——挪亚方舟渡过洪水,约柜守护最要紧的东西。方舟不是一个你去拜访的金库,而是一艘载着你的贵重之物、穿越时间与风浪的船。",
        },
        { k: "h2", t: "载着你的钥匙" },
        {
          k: "p",
          t: "你的钥匙——那组能解开一切的助记词——正是这样的珍贵货物。KeysArk 就是载着它的方舟:跨设备、跨云盘、跨越数年,始终不暴露里面的内容。",
        },
        { k: "h2", t: "从外面封死" },
        {
          k: "p",
          t: "这个词里还藏着第二层意思:`ark` 与拉丁语 `arca`(箱子、保险箱)同源。一只只有主人能打开的密封箱子,正是零知识加密最贴切的形状。方舟是闭合的,钥匙只在你手上。",
        },
        { k: "h2", t: "关于 Logo" },
        {
          k: "p",
          t: "所以标识是一只盾形的方舟外壳,中心一个钥匙孔,里面是一把琥珀色的钥匙。盾形是载着钥匙的方舟,钥匙孔是唯一的入口,暖色是「被妥善守护」的温度。名字与图案说的是同一件事——你的钥匙,在一只只有你能打开的方舟里。",
        },
      ],
    },
  },
  {
    slug: "open-source-and-provenance",
    date: "2026-05-28",
    en: {
      title: "Why KeysArk must be open source — and why backups carry a version number",
      description:
        "End-to-end encryption is only a promise until you can verify it. Here is why the code is open, and why every exported backup records the exact software that made it.",
      body: [
        {
          k: "p",
          t: "“End-to-end encrypted” is a claim. Open source is what turns it into something you can actually check.",
        },
        { k: "h2", t: "Trust, but verify" },
        {
          k: "p",
          t: "If you cannot read the code, “we never see your data” is just marketing. Open source lets anyone confirm there is no backdoor: that the key really is derived in the browser, that plaintext really never reaches the server. Security that cannot be audited is not security — it is faith.",
        },
        { k: "h2", t: "The problem nobody talks about" },
        {
          k: "p",
          t: "Self-custody has a long-tail problem. You encrypt a backup today, then go to open it in five or ten years — but by then the website may be gone, the libraries changed, the algorithms tweaked. A backup you can no longer decrypt is not a backup.",
        },
        { k: "h2", t: "So backups carry their own provenance" },
        {
          k: "p",
          t: "Every mnemonic backup KeysArk exports (PDF and HTML) embeds a provenance manifest describing exactly what produced it:",
        },
        {
          k: "ul",
          items: [
            "The ark CLI version, and the source repository + commit hash.",
            "The build time and the Node.js version.",
            "The exact crypto library versions (`hash-wasm`, `@scure/bip39`, `@noble/hashes`).",
            "The full crypto spec: BIP39 24-word phrase, seed → HKDF-SHA256 → AES-256-GCM, and the Argon2id parameters.",
          ],
        },
        { k: "h2", t: "Why the version number matters" },
        {
          k: "p",
          t: "With that manifest, future-you can check out the exact commit that made the backup, reproduce the build environment, and decrypt — even decades later, even if keysark.com no longer exists. The version number is not bookkeeping; it is the map back to the runtime environment that can still open your vault.",
        },
        {
          k: "quote",
          t: "Open source proves there is no backdoor today. Provenance proves you can still get in tomorrow.",
        },
      ],
    },
    zh: {
      title: "为什么 KeysArk 必须开源,以及备份为何带 CLI 版本号",
      description:
        "端到端加密在你能验证之前都只是承诺。本文讲清楚为什么代码要开源,以及每一份导出的备份为何都记录下生成它的确切软件。",
      body: [
        {
          k: "p",
          t: "「端到端加密」是一个说法。开源,才让它变成你可以真正核对的事实。",
        },
        { k: "h2", t: "信任,但要能验证" },
        {
          k: "p",
          t: "如果你读不到代码,「我们看不到你的数据」就只是营销话术。开源让任何人都能确认没有后门:密钥确实在浏览器里派生,明文确实从不到达服务端。无法审计的安全不是安全,是信仰。",
        },
        { k: "h2", t: "没人愿意谈的问题" },
        {
          k: "p",
          t: "自我保管有一个长尾问题。你今天加密了一份备份,五年、十年后再去打开——可那时网站也许早已不在,依赖库变了,算法也调过了。一份你再也解不开的备份,不算备份。",
        },
        { k: "h2", t: "所以备份自带「出处」" },
        {
          k: "p",
          t: "KeysArk 导出的每一份助记词备份(PDF 与 HTML)都内嵌一份出处清单,精确记录是什么生成了它:",
        },
        {
          k: "ul",
          items: [
            "ark CLI 的版本,以及源码仓库地址 + 提交哈希。",
            "构建时间与 Node.js 版本。",
            "确切的加密库版本(`hash-wasm`、`@scure/bip39`、`@noble/hashes`)。",
            "完整的加密规格:BIP39 24 词助记词,seed → HKDF-SHA256 → AES-256-GCM,以及 Argon2id 参数。",
          ],
        },
        { k: "h2", t: "版本号为什么重要" },
        {
          k: "p",
          t: "有了这份清单,未来的你就能检出生成这份备份的那个确切提交、复现构建环境、完成解密——哪怕已是数十年后,哪怕 keysark.com 早已不复存在。版本号不是流水账,而是回到「仍能打开你保险库的运行环境」的那张地图。",
        },
        {
          k: "quote",
          t: "开源证明今天没有后门;出处清单证明明天你仍能进得去。",
        },
      ],
    },
  },
  {
    slug: "encryption-design",
    date: "2026-05-20",
    en: {
      title: "How KeysArk encrypts: the design",
      description:
        "A walk through KeysArk's end-to-end encryption — from a BIP39 phrase to AES-256-GCM ciphertext that only you can open.",
      body: [
        {
          k: "p",
          t: "Every design choice in KeysArk follows one rule: the key never leaves your browser. Here is the chain, from the words you write down to the ciphertext in your cloud.",
        },
        { k: "h2", t: "One phrase to hold everything" },
        {
          k: "p",
          t: "Your master secret is a BIP39 recovery phrase — 24 English words (256 bits of entropy) for new vaults. It is a standard, so you can import it into MetaMask or any BIP39 wallet. Nothing else to download, no key file to babysit.",
        },
        { k: "h2", t: "From words to a key" },
        {
          k: "p",
          t: "The phrase is turned into a key deterministically, entirely in the browser: same phrase, same key, every time, on any device — with no server involved.",
        },
        {
          k: "code",
          t: "BIP39 phrase\n  → seed   (PBKDF2-HMAC-SHA512)\n  → HKDF-SHA256\n  → AES-256 key",
        },
        { k: "h2", t: "Encrypting your content" },
        {
          k: "p",
          t: "Each item is sealed with `AES-256-GCM`, an authenticated cipher: it both hides the content and detects tampering. Every encryption uses a fresh, random 96-bit IV that is never reused — reusing a GCM nonce would be catastrophic, so we never do.",
        },
        { k: "h2", t: "The server is a dumb pipe" },
        {
          k: "p",
          t: "Our API and the storage clients are bytes-in, bytes-out: they move opaque base64 ciphertext and are entirely content-agnostic. The plaintext, the phrase, and the derived key are forbidden from any server code, request, URL, cookie, log, or database.",
        },
        { k: "h2", t: "Unlocking on your machine" },
        {
          k: "p",
          t: "When you store your phrase locally (in the web app or the ark CLI), it is wrapped with an unlock password using `Argon2id` (512 MB, t=4, p=1) — a deliberately memory-hard function that makes brute-forcing the password expensive. The parameters travel with the credential, so they can be raised over time.",
        },
        { k: "h2", t: "The trade-off we accept" },
        {
          k: "quote",
          t: "True end-to-end encryption means even we cannot help you recover your data. Lose the recovery phrase and it is gone. That is the price of nobody — including us — being able to read it.",
        },
      ],
    },
    zh: {
      title: "KeysArk 的加密设计思路",
      description:
        "一篇走查 KeysArk 端到端加密的文章——从一组 BIP39 助记词,到只有你能打开的 AES-256-GCM 密文。",
      body: [
        {
          k: "p",
          t: "KeysArk 的每一个设计取舍都服从同一条规则:密钥永不离开你的浏览器。下面是这条链路——从你写下的那串词,到云盘里的密文。",
        },
        { k: "h2", t: "一组助记词,守护一切" },
        {
          k: "p",
          t: "你的主密钥是一组 BIP39 助记词——新库为 24 个英文单词(256 位熵)。它是标准,可导入 MetaMask 或任何 BIP39 钱包。没有别的要下载,也没有密钥文件要操心。",
        },
        { k: "h2", t: "从词到密钥" },
        {
          k: "p",
          t: "助记词在浏览器里被确定性地变成密钥:同一组词,在任何设备上每次都派生出同一把密钥——全程不经过服务端。",
        },
        {
          k: "code",
          t: "BIP39 助记词\n  → seed   (PBKDF2-HMAC-SHA512)\n  → HKDF-SHA256\n  → AES-256 密钥",
        },
        { k: "h2", t: "加密你的内容" },
        {
          k: "p",
          t: "每个条目都用 `AES-256-GCM` 封装——这是一种认证加密:既隐藏内容,又能检测篡改。每次加密都用一个全新的随机 96 位 IV,绝不复用——复用 GCM 的 nonce 会是灾难性的,所以我们从不这么做。",
        },
        { k: "h2", t: "服务端只是一根管道" },
        {
          k: "p",
          t: "我们的 API 与存储客户端都是字节进、字节出:只搬运不透明的 base64 密文,与内容无关。明文、助记词和派生密钥,被禁止出现在任何服务端代码、请求、URL、cookie、日志或数据库里。",
        },
        { k: "h2", t: "在你的机器上解锁" },
        {
          k: "p",
          t: "当你把助记词存在本地(网页端或 ark 命令行),它会用一个解锁口令包裹,采用 `Argon2id`(512 MB,t=4,p=1)——一个刻意「内存困难」的函数,让暴力破解口令变得昂贵。参数随凭据一起保存,因此可以逐步调高。",
        },
        { k: "h2", t: "我们接受的取舍" },
        {
          k: "quote",
          t: "真正的端到端加密,意味着连我们也无法帮你找回数据。弄丢助记词,它就没了。这正是「没有人——包括我们——能读到它」的代价。",
        },
      ],
    },
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** 取某篇文章在当前语言下的正文:en/zh 用内联字段,其余语言用机翻覆盖表,缺失回退 en。 */
export function getPostContent(post: BlogPost, locale: Locale): PostLocale {
  if (locale === "en") return post.en;
  if (locale === "zh") return post.zh;
  return BLOG_OVERRIDES[locale]?.[post.slug] ?? post.en;
}

export function formatPostDate(iso: string, locale: Locale): string {
  // htmlLang 给出合法 BCP-47(en/zh-CN/es/fr/de/ja/ko/pt/ru),直接用于日期本地化。
  return new Date(iso).toLocaleDateString(htmlLang(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
