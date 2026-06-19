import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ihsan — Websites für Restaurants, Cafés & Gastronomiebetriebe",
  description:
    "Ich erstelle professionelle Websites für Restaurants, Cafés, Bars und andere Gastronomiebetriebe. Schnell, modern und zu fairen Preisen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
