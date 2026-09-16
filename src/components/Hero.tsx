"use client";
import { LeistungZeile } from "./Leistungen";

// Der Einstieg: kein eigener Spruch mehr, sondern direkt die erste Leistung
// (Smart Websites) mit Bild ueber dem KI-Motiv. Traegt die h1 der Seite.

export default function Hero() {
  return (
    <section
      id="leistungen"
      className="hero-bg surface-alt relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-16"
    >
      <div className="hero-photo" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full animate-fade-in-up">
        <LeistungZeile i={0} h1 />
      </div>
    </section>
  );
}
