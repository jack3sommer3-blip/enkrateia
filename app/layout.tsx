import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/app/components/layout/TopNav";
import SystemTime from "@/app/components/layout/SystemTime";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Enkrateia",
  description: "A system for self-mastery and daily tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="command-grid">
          <TopNav />
          {children}
          <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-gray-500">
            System Time: <SystemTime />
          </footer>
        </div>
      </body>
    </html>
  );
}
