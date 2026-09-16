import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Leistungen from "@/components/Leistungen";
import About from "@/components/About";
import Portfolio from "@/components/Portfolio";
import Instagram from "@/components/Instagram";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { SpracheProvider } from "@/lib/sprache";

export default function Home() {
  return (
    <SpracheProvider>
      <Header />
      <main>
        <Hero />
        <Leistungen />
        <About />
        <Instagram />
        <Portfolio />
        <Contact />
      </main>
      <Footer />
    </SpracheProvider>
  );
}
