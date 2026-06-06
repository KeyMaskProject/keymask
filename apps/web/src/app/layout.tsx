import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keyper",
  description: "端到端加密的网盘文本保管库",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
