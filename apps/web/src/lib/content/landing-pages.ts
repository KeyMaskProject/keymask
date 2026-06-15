import type { Block } from "@/components/prose";
import type { Locale } from "@/lib/i18n";

// 长尾 SEO 着陆页内容:一词一意图,每页原创(非模板换词)。en/zh 全量,其余语言回退 en。
// 定位诚实:KeysArk 是端到端加密的密钥/密文保管库,不是 1Password 式自动填充密码管理器。
export interface LandingFaq {
  q: string;
  a: string;
}
export interface LandingPageContent {
  title: string; // <title>(不含品牌后缀)
  description: string; // meta description
  h1: string;
  lead: Block[]; // 首屏正文(原创)
  faqs: LandingFaq[];
}
export interface LandingPage {
  slug: string;
  related: string[]; // 内链到其它着陆页的 slug
  locales: Partial<Record<Locale, LandingPageContent>>;
}

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "open-source-password-manager",
    related: ["free-secrets-vault", "env-file-backup", "bip39-backup"],
    locales: {
      en: {
        title: "Open-source password manager — free & end-to-end encrypted",
        description:
          "KeysArk is a free, open-source, end-to-end encrypted vault for your most sensitive text — an auditable alternative to closed-source password managers. Your key never leaves your browser.",
        h1: "A free, open-source password & secrets vault",
        lead: [
          {
            k: "p",
            t: "KeysArk is a free and open-source vault for the secrets you cannot afford to lose: recovery phrases, API keys, passwords, private notes. Everything is encrypted in your browser with a key only you hold — the server only ever stores ciphertext.",
          },
          {
            k: "p",
            t: "Be clear on what it is: KeysArk is an end-to-end encrypted text vault, not an autofill browser extension. If you want a self-custody place to keep secrets that no company — including us — can read, and code you can actually audit, this is built for you.",
          },
          { k: "h2", t: "Why open source matters for a password manager" },
          {
            k: "p",
            t: "“We can't read your data” is only a promise until you can verify it. Because KeysArk is open source, anyone can confirm the key is derived in the browser and that plaintext never reaches the server. Security you cannot audit is faith, not proof.",
          },
          {
            k: "ul",
            items: [
              "Free and open source — no paid tier gating your own data.",
              "End-to-end encrypted with AES-256-GCM; the key is derived from a BIP39 phrase in your browser.",
              "Your ciphertext lives in your own Google Drive or Baidu netdisk — you can self-host the app.",
              "A command-line client (ark) for reading and writing your vault from the terminal.",
            ],
          },
        ],
        faqs: [
          {
            q: "Is KeysArk a free password manager?",
            a: "Yes. KeysArk is free and open source. There is no paid tier and no account fee — you store your encrypted data in your own cloud drive.",
          },
          {
            q: "Is it a replacement for 1Password or Bitwarden?",
            a: "Not exactly. KeysArk is an end-to-end encrypted vault for sensitive text and secrets, not an autofill manager. It is for people who want auditable, self-custody encryption rather than browser autofill.",
          },
          {
            q: "Can anyone at KeysArk read my passwords?",
            a: "No. Encryption and decryption happen only in your browser. The server and storage backends handle opaque ciphertext only — the master key and plaintext never reach them.",
          },
          {
            q: "Is the code really open source?",
            a: "Yes. The code is open so anyone can verify there is no backdoor: that the key is derived client-side and plaintext never leaves your device.",
          },
        ],
      },
      zh: {
        title: "开源密码管理器 —— 免费、端到端加密",
        description:
          "KeysArk 是免费开源、端到端加密的保管库,存放你最敏感的文本——一个可审计的闭源密码管理器替代品。密钥永不离开浏览器。",
        h1: "免费开源的密码与密钥保管库",
        lead: [
          {
            k: "p",
            t: "KeysArk 是一个免费开源的保管库,守护你输不起的秘密:助记词、API 密钥、密码、私密笔记。一切都在你的浏览器里用只有你掌握的密钥加密——服务端只存密文。",
          },
          {
            k: "p",
            t: "请先看清它是什么:KeysArk 是端到端加密的文本保管库,不是自动填充的浏览器扩展。如果你想要一个连任何公司(包括我们)都读不到、且代码可审计的自我保管之地,它就是为你而造。",
          },
          { k: "h2", t: "密码管理器为什么要开源" },
          {
            k: "p",
            t: "在你能验证之前,「我们读不到你的数据」只是一句承诺。因为 KeysArk 开源,任何人都能确认密钥在浏览器里派生、明文从不到达服务端。无法审计的安全是信仰,不是证明。",
          },
          {
            k: "ul",
            items: [
              "免费且开源——不用付费才能用自己的数据。",
              "端到端 AES-256-GCM 加密;密钥由 BIP39 助记词在浏览器里派生。",
              "密文存进你自己的 Google Drive 或百度网盘——应用可自托管。",
              "命令行客户端(ark),在终端读写你的保险库。",
            ],
          },
        ],
        faqs: [
          {
            q: "KeysArk 是免费的密码管理器吗?",
            a: "是。KeysArk 免费且开源,没有付费档位、没有账号费——你把加密数据存在自己的云盘里。",
          },
          {
            q: "它能替代 1Password 或 Bitwarden 吗?",
            a: "不完全是。KeysArk 是面向敏感文本与密钥的端到端加密保管库,而非自动填充工具。它适合想要可审计、自我保管加密的人,而非浏览器自动填充。",
          },
          {
            q: "KeysArk 的人能读到我的密码吗?",
            a: "不能。加解密只在你的浏览器里完成。服务端与存储后端只经手不透明密文——主密钥与明文永不到达它们。",
          },
          {
            q: "代码真的开源吗?",
            a: "是。代码开源,任何人都能验证没有后门:密钥在客户端派生、明文从不离开你的设备。",
          },
        ],
      },
    },
  },
  {
    slug: "free-secrets-vault",
    related: ["open-source-password-manager", "env-file-backup", "bip39-backup"],
    locales: {
      en: {
        title: "Free secrets manager — encrypted key & token vault",
        description:
          "Store API keys, tokens, and secrets in a free, end-to-end encrypted vault. Keys are derived in your browser from a BIP39 phrase; the server only sees ciphertext.",
        h1: "A free, encrypted vault for keys, tokens & secrets",
        lead: [
          {
            k: "p",
            t: "KeysArk is a free secrets vault for the credentials that should never sit in plaintext: API keys, access tokens, database URLs, private keys. Each item is sealed with AES-256-GCM in your browser before it ever leaves your device.",
          },
          {
            k: "p",
            t: "Unlike a hosted secrets manager, KeysArk never holds your key. It is derived from a BIP39 recovery phrase you control, so even if the storage backend were compromised, the contents stay unreadable.",
          },
          { k: "h2", t: "What you can keep in it" },
          {
            k: "ul",
            items: [
              "API keys and access tokens for the services you build on.",
              "Database connection strings and other deployment secrets.",
              "Private keys, recovery phrases, and license keys.",
              "Any sensitive note you want encrypted and synced to your own cloud.",
            ],
          },
        ],
        faqs: [
          {
            q: "Is the secrets manager free?",
            a: "Yes — KeysArk is free and open source. Your encrypted secrets are stored in your own Google Drive or Baidu netdisk.",
          },
          {
            q: "How are my secrets encrypted?",
            a: "Each item is encrypted in your browser with AES-256-GCM, using a key derived from your BIP39 phrase. The server only stores opaque ciphertext.",
          },
          {
            q: "Can I use it from the command line / CI?",
            a: "Yes. The ark CLI reads and writes your vault from the terminal, with the mnemonic supplied via an environment variable for scripts and CI.",
          },
          {
            q: "What happens if I lose my recovery phrase?",
            a: "True end-to-end encryption means nobody — including us — can recover it for you. The phrase is the only key, so back it up carefully.",
          },
        ],
      },
      zh: {
        title: "免费密钥管理器 —— 加密的密钥与令牌保管库",
        description:
          "把 API 密钥、令牌、密钥存进免费的端到端加密保管库。密钥由 BIP39 助记词在浏览器里派生,服务端只看到密文。",
        h1: "免费、加密的密钥 / 令牌 / 密钥保管库",
        lead: [
          {
            k: "p",
            t: "KeysArk 是一个免费的密钥保管库,专放绝不该以明文存在的凭据:API 密钥、访问令牌、数据库地址、私钥。每个条目在离开设备前,都先在你的浏览器里用 AES-256-GCM 封装。",
          },
          {
            k: "p",
            t: "与托管式密钥管理服务不同,KeysArk 永不持有你的密钥。密钥由你掌握的 BIP39 助记词派生——即便存储后端被攻破,内容依旧无法读取。",
          },
          { k: "h2", t: "你可以存些什么" },
          {
            k: "ul",
            items: [
              "你所构建服务的 API 密钥与访问令牌。",
              "数据库连接串等部署密钥。",
              "私钥、助记词、许可证密钥。",
              "任何你想加密并同步到自己云盘的敏感笔记。",
            ],
          },
        ],
        faqs: [
          {
            q: "这个密钥管理器免费吗?",
            a: "免费——KeysArk 免费且开源。你的加密密钥存在自己的 Google Drive 或百度网盘里。",
          },
          {
            q: "我的密钥怎么加密?",
            a: "每个条目在浏览器里用 AES-256-GCM 加密,密钥由你的 BIP39 助记词派生。服务端只存不透明密文。",
          },
          {
            q: "能在命令行 / CI 里用吗?",
            a: "能。ark 命令行在终端读写你的保险库,脚本与 CI 可用环境变量提供助记词。",
          },
          {
            q: "弄丢助记词会怎样?",
            a: "真正的端到端加密意味着没有人(包括我们)能帮你找回。助记词是唯一的钥匙,请妥善备份。",
          },
        ],
      },
    },
  },
  {
    slug: "env-file-backup",
    related: ["free-secrets-vault", "open-source-password-manager", "bip39-backup"],
    locales: {
      en: {
        title: "Encrypt & back up your .env files securely",
        description:
          "Back up .env files and developer secrets encrypted end-to-end. The ark CLI saves and restores them straight from your git repo; the server only handles ciphertext.",
        h1: "Encrypt and back up your .env files",
        lead: [
          {
            k: "p",
            t: "Your .env files hold the keys to everything — and they are the one thing you must never commit to git. KeysArk gives them a safe home: encrypted in your browser or terminal, synced to your own cloud, restorable on any machine.",
          },
          {
            k: "p",
            t: "The ark CLI is git-aware: run it inside a repo and it derives the target path from your git origin, so a single command backs up or restores the right .env without you spelling out where it goes.",
          },
          { k: "h2", t: "How developers use it" },
          {
            k: "ul",
            items: [
              "`ark save .env` from a project directory — encrypted and stored under your repo's path.",
              "`ark get github.com/me/app/.env .env` to restore it on a new machine.",
              "Supply the mnemonic via an environment variable for non-interactive CI use.",
              "Binary secrets (keystores, .p12) are stored as encrypted file items too.",
            ],
          },
        ],
        faqs: [
          {
            q: "Why not just keep .env files in a private git repo?",
            a: "Anything committed to git is plaintext to anyone with repo access and lives forever in history. KeysArk keeps them end-to-end encrypted, so even the storage backend can't read them.",
          },
          {
            q: "Can I restore a .env on a new machine?",
            a: "Yes. With your recovery phrase, `ark get` decrypts and writes the file back to the right path — even years later, offline from a backup.",
          },
          {
            q: "Does this work in CI?",
            a: "Yes. Provide the mnemonic through an environment variable and the ark CLI runs non-interactively to fetch secrets during a build.",
          },
          {
            q: "Is it free?",
            a: "Yes — KeysArk is free and open source; your encrypted backups live in your own cloud drive.",
          },
        ],
      },
      zh: {
        title: "安全加密备份你的 .env 文件",
        description:
          "把 .env 文件与开发密钥端到端加密备份。ark 命令行直接在 git 仓库里保存与还原,服务端只经手密文。",
        h1: "加密备份你的 .env 文件",
        lead: [
          {
            k: "p",
            t: ".env 文件握着通往一切的钥匙——也是你绝不能提交进 git 的东西。KeysArk 给它一个安全的家:在浏览器或终端里加密,同步到你自己的云盘,在任何机器上还原。",
          },
          {
            k: "p",
            t: "ark 命令行懂 git:在仓库里运行,它会按 git origin 推断目标路径,一条命令就备份或还原对应的 .env,无需你手写它放在哪。",
          },
          { k: "h2", t: "开发者怎么用" },
          {
            k: "ul",
            items: [
              "在项目目录里 `ark save .env`——加密后存到仓库对应路径下。",
              "`ark get github.com/me/app/.env .env` 在新机器上还原。",
              "非交互 CI 场景用环境变量提供助记词。",
              "二进制密钥(keystore、.p12)也以加密文件条目存储。",
            ],
          },
        ],
        faqs: [
          {
            q: "为什么不直接把 .env 放进私有 git 仓库?",
            a: "提交进 git 的内容对有仓库权限的人都是明文,且永远留在历史里。KeysArk 让它们端到端加密,连存储后端也读不到。",
          },
          {
            q: "能在新机器上还原 .env 吗?",
            a: "能。有助记词,`ark get` 就能解密并写回正确路径——哪怕多年以后、离线从备份还原。",
          },
          {
            q: "在 CI 里能用吗?",
            a: "能。用环境变量提供助记词,ark 命令行就能在构建时非交互地拉取密钥。",
          },
          {
            q: "免费吗?",
            a: "免费——KeysArk 免费且开源;加密备份存在你自己的云盘里。",
          },
        ],
      },
    },
  },
  {
    slug: "bip39-backup",
    related: ["open-source-password-manager", "free-secrets-vault", "env-file-backup"],
    locales: {
      en: {
        title: "BIP39 recovery phrase backup — encrypted & self-custody",
        description:
          "Back up your BIP39 mnemonic in an end-to-end encrypted vault. Standard 24-word phrases, importable into MetaMask; the key is derived in your browser and never leaves it.",
        h1: "Back up your BIP39 recovery phrase",
        lead: [
          {
            k: "p",
            t: "Your BIP39 recovery phrase is the master key to everything it protects — and a sticky note is no way to keep it. KeysArk stores it end-to-end encrypted, derived from a phrase only you hold, synced to your own cloud.",
          },
          {
            k: "p",
            t: "KeysArk speaks the standard: new vaults use a 24-word BIP39 phrase (256 bits of entropy) that you can import into MetaMask or any BIP39 wallet. Nothing proprietary to lock you in.",
          },
          { k: "h2", t: "Why a vault beats paper or a screenshot" },
          {
            k: "ul",
            items: [
              "Encrypted with AES-256-GCM in your browser — a screenshot in your photos is plaintext.",
              "Synced to your own Google Drive or Baidu netdisk, not a company database.",
              "Exports carry a provenance manifest so you can still decrypt them years later.",
              "Open source, so you can verify the phrase never reaches any server.",
            ],
          },
        ],
        faqs: [
          {
            q: "Is it safe to store a recovery phrase online?",
            a: "Only if it is encrypted before it leaves your device. KeysArk encrypts in your browser with a key derived from a phrase only you hold — the server stores ciphertext it cannot read.",
          },
          {
            q: "Does KeysArk use standard BIP39?",
            a: "Yes. New vaults generate a standard 24-word BIP39 phrase, importable into MetaMask or any BIP39-compatible wallet.",
          },
          {
            q: "Can I still decrypt my backup years from now?",
            a: "Yes. Every export embeds a provenance manifest recording the exact software and crypto spec that made it, so a future you can reproduce the environment and decrypt.",
          },
          {
            q: "Is it free?",
            a: "Yes — KeysArk is free and open source, with your encrypted backup stored in your own cloud drive.",
          },
        ],
      },
      zh: {
        title: "BIP39 助记词备份 —— 加密且自我保管",
        description:
          "把你的 BIP39 助记词存进端到端加密保管库。标准 24 词助记词,可导入 MetaMask;密钥在浏览器里派生,绝不外泄。",
        h1: "备份你的 BIP39 助记词",
        lead: [
          {
            k: "p",
            t: "你的 BIP39 助记词是它所保护的一切的主钥匙——靠一张便利贴可守不住。KeysArk 把它端到端加密存储,密钥由只有你掌握的助记词派生,同步到你自己的云盘。",
          },
          {
            k: "p",
            t: "KeysArk 遵循标准:新库使用 24 词 BIP39 助记词(256 位熵),可导入 MetaMask 或任何 BIP39 钱包。没有任何专有格式把你锁死。",
          },
          { k: "h2", t: "保管库为什么胜过纸或截图" },
          {
            k: "ul",
            items: [
              "在浏览器里用 AES-256-GCM 加密——相册里的截图却是明文。",
              "同步到你自己的 Google Drive 或百度网盘,而非某公司的数据库。",
              "导出带出处清单,多年以后仍能解密。",
              "开源,你可以验证助记词从不到达任何服务端。",
            ],
          },
        ],
        faqs: [
          {
            q: "把助记词存在线上安全吗?",
            a: "只有在它离开设备前就被加密时才安全。KeysArk 在浏览器里用只有你掌握的助记词派生的密钥加密——服务端存的是它读不懂的密文。",
          },
          {
            q: "KeysArk 用的是标准 BIP39 吗?",
            a: "是。新库生成标准 24 词 BIP39 助记词,可导入 MetaMask 或任何兼容 BIP39 的钱包。",
          },
          {
            q: "多年以后还能解密我的备份吗?",
            a: "能。每份导出都内嵌出处清单,记录生成它的确切软件与加密规格,未来的你可复现环境并解密。",
          },
          {
            q: "免费吗?",
            a: "免费——KeysArk 免费且开源,加密备份存在你自己的云盘里。",
          },
        ],
      },
    },
  },
];

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
