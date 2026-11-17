import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "CaseIQ";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "AI-assisted preliminary case assessment for solicitor review",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased bg-slate-50 text-slate-900`}>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              {PRODUCT_NAME}
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Cases
              </Link>
              <Link href="/legislation" className="hover:underline">
                Legislation
              </Link>
              <span className="hidden text-xs text-slate-500 sm:inline">
                Demo · fictional data · not legal advice
              </span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
