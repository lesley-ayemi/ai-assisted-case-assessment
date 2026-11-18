import type { Metadata } from "next";
import { IBM_Plex_Sans, Literata } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/product";
import "./globals.css";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const literata = Literata({ variable: "--font-literata", subsets: ["latin"] });

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "AI-assisted preliminary case assessment for solicitor review",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plex.variable} ${literata.variable} bg-canvas text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
