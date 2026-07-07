import type { Metadata } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import "./globals.css";
import VariantSwitcher from "../components/VariantSwitcher";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ihsan — Websites für lokale Betriebe & kleine Unternehmen",
  description:
    "Professionelle Websites für Gastronomie, Einzelhandel, Dienstleister und Handwerk. Schnell, modern und zu fairen Preisen — mit smarten KI-Funktionen, die Zeit sparen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}<VariantSwitcher /></body>
    </html>
  );
}
