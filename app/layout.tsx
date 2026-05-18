import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "claude OS — atlas",
  description:
    "A force-directed map of every project, skill, and tool Surya has built. Auto-derived from his filesystem.",
  openGraph: {
    title: "claude OS — atlas",
    description:
      "A force-directed map of every project, skill, and tool Surya has built.",
    type: "website",
    siteName: "claude OS",
  },
  twitter: {
    card: "summary_large_image",
    title: "claude OS — atlas",
    description:
      "A force-directed map of every project, skill, and tool Surya has built.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
