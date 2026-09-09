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
        <a
          href="/ramen-tech-2026/"
          aria-label="RAMEN TECH 2026 特設サイトを開く"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            width: "100%",
            minHeight: "44px",
            padding: "9px 18px",
            background: "#FFE248",
            color: "#111111",
            borderBottom: "2px solid #111111",
            fontSize: "13px",
            fontWeight: 900,
            lineHeight: 1.45,
            textAlign: "center",
            textDecoration: "none",
            letterSpacing: "0.01em",
          }}
        >
          <span style={{ fontSize: "10px", letterSpacing: "0.12em" }}>SPECIAL SITE</span>
          <strong>RAMEN TECH 2026</strong>
          <span>イベント検索・マイスケジュール →</span>
        </a>
        {children}
        <div className="preopenNotice" role="status">
          プレオープン｜試験公開中
        </div>
      </body>
    </html>
  );
}
