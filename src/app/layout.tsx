import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ihsan | IT-Freelancer — Webentwicklung, Data & KI für KMUs",
  description:
    "Moderne IT-Lösungen für kleine und mittelständische Unternehmen. Webentwicklung, Data Engineering, KI-Integration und IT-Beratung aus einer Hand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
