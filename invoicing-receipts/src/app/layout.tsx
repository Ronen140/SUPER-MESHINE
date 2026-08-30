import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "חשבוניות וקבלות",
  description: "מערכת חשבוניות וקבלות רב-עסקית.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html dir="rtl" lang="he" className={assistant.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
