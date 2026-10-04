import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark h-full">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
