import type { Locale } from "@/lib/i18n";

// 首页 FAQ:产品级常见问题(承载"免费/开源/密码管理器/自托管"等目标词)。en/zh 原创,其余回退 en。
// 单独成文件(非 landing-pages.ts),避免把全部着陆页长文打进首页 client bundle。
export interface Faq {
  q: string;
  a: string;
}

export const HOME_FAQ: Partial<Record<Locale, Faq[]>> = {
  en: [
    {
      q: "Is KeysArk a free, open-source password manager?",
      a: "Yes. KeysArk is free and open source — an end-to-end encrypted vault for passwords, keys, and secrets. You store the encrypted data in your own cloud drive, with no paid tier.",
    },
    {
      q: "Can KeysArk read my data?",
      a: "No. Encryption and decryption happen only in your browser, using a key derived from a BIP39 phrase you control. The server only handles ciphertext it cannot read.",
    },
    {
      q: "Is it a replacement for 1Password or Bitwarden?",
      a: "KeysArk is an end-to-end encrypted vault for sensitive text and secrets, not an autofill manager. It is built for people who want auditable, self-custody encryption.",
    },
    {
      q: "Can I self-host KeysArk?",
      a: "Yes. The app is open source and self-hostable, and your encrypted data lives in your own Google Drive or Baidu netdisk.",
    },
  ],
  zh: [
    {
      q: "KeysArk 是免费开源的密码管理器吗?",
      a: "是。KeysArk 免费且开源——一个面向密码、密钥与密文的端到端加密保管库。加密数据存在你自己的云盘里,没有付费档位。",
    },
    {
      q: "KeysArk 能读到我的数据吗?",
      a: "不能。加解密只在你的浏览器里完成,密钥由你掌握的 BIP39 助记词派生。服务端只经手它读不懂的密文。",
    },
    {
      q: "它能替代 1Password 或 Bitwarden 吗?",
      a: "KeysArk 是面向敏感文本与密钥的端到端加密保管库,而非自动填充工具。它为想要可审计、自我保管加密的人而造。",
    },
    {
      q: "可以自托管 KeysArk 吗?",
      a: "可以。应用开源且可自托管,加密数据存在你自己的 Google Drive 或百度网盘里。",
    },
  ],
};
