import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Leistungen from "@/components/Leistungen";
import Geo from "@/components/Geo";
import About from "@/components/About";
import Portfolio from "@/components/Portfolio";
import Instagram from "@/components/Instagram";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Leistungen />
        <Geo />
        <About />
        <Portfolio />
        <Instagram />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
