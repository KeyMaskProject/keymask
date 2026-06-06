import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "KeysArk — 端到端加密保管库",
  description:
    "端到端加密的文本保管库。内容在你的浏览器里用 BIP39 助记词派生密钥加密,服务端与百度网盘只经手密文。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
