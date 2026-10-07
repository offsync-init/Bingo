import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { THEME_BOOTSTRAP_SCRIPT } from "../lib/theme";

export const metadata: Metadata = {
  title: "Nepali Bingo 1v1 | नेपाली बिङ्गो १v१",
  description: "Real-time 1v1 competitive multiplayer Bingo game inspired by Nepali visual culture",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full" data-theme="traditional" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-rose-500 selection:text-white">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
