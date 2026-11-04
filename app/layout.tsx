import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Spend Audit — see what you're quietly paying for",
    template: "%s · Spend Audit",
  },
  description:
    "Drop in a bank statement CSV. Spend Audit surfaces every recurring charge, totals it, and flags the ones nobody owns — entirely on your device.",
  applicationName: "Spend Audit",
};

export const viewport: Viewport = {
  themeColor: "#fbfbf8",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-page text-ink">{children}</body>
    </html>
  );
}
