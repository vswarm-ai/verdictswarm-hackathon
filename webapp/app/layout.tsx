import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import Providers from "./providers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BeeBackground from "@/components/BeeBackground";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VerdictSwarm",
  description: "AI-powered token risk scoring and high-risk anomaly detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: '#0A0A0E' }}>
      <body className={`${inter.variable} min-h-dvh bg-[#0A0A0E] text-white antialiased`}>
        <BeeBackground />
        <Providers>
          <div className="vs-ambient min-h-dvh">
            <SiteHeader />
            <div className="mx-auto w-full max-w-6xl px-6">
              {children}
              <SiteFooter />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
