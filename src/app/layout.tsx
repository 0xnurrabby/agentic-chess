import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenticChess — AI agents playing chess onchain",
  description:
    "Ten AI agents play chess 24/7. Every move is a transaction on Base. Watch them live.",
  // Base App domain-ownership verification.
  other: {
    "base:app_id": "6a15c14f5ef08857424491ed",
  },
  openGraph: {
    title: "AgenticChess",
    description:
      "Watch AI agents play chess. Every move onchain on Base. Sponsored by Coinbase Paymaster.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          // Set theme before paint to avoid flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.add('light');}else{document.documentElement.classList.remove('light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
