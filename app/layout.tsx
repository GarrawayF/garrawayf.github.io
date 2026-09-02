import type { Metadata } from "next";
import "./globals.css";
import { withBasePath } from "./base-path";

export const metadata: Metadata = {
  title: "Garraway F｜社会課題に挑戦する、まちのリビングラボ",
  description: "人が出会い、想いが混ざり、挑戦が動き出す。福岡・天神CLASS 3Fの共創拠点 Garraway F。",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: withBasePath("/favicon.svg"),
    shortcut: withBasePath("/favicon.svg"),
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <div className="preopenNotice" role="status">
          プレオープン｜試験公開中
        </div>
      </body>
    </html>
  );
}
