import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: "Sentinel — Admin Console",
  description: "TaskforceAI Admin Portal",
};

export const viewport = { themeColor: "#04070f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
