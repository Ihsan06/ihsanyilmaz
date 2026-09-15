// Animierter Hintergrund fuer den GEO-Abschnitt: Bahnen aus allen Richtungen,
// auf denen Lichtimpulse zur Mitte laufen – wie Fragen, die bei der KI ankommen.
// Rein CSS-animiert (siehe .geo-* in globals.css), bei "weniger Bewegung"
// steht es still. Die Zahlen sind einmal ausgewuerfelt und fest eingebaut,
// damit Server und Browser dasselbe zeichnen.
export default function GeoNetz() {
  return (
    <svg className="geo-netz" viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-40,241 C526,241 526,252 800,252" className="geo-bahn" />
      <path d="M-40,241 C526,241 526,252 800,252" className="geo-impuls" style={{ animationDuration: "10.3s", animationDelay: "-3.7s" }} />
      <path d="M-40,76 C535,76 535,352 800,352" className="geo-bahn" />
      <path d="M-40,76 C535,76 535,352 800,352" className="geo-impuls" style={{ animationDuration: "9.3s", animationDelay: "-2.4s" }} />
      <path d="M-40,382 C1086,382 1086,227 800,227" className="geo-bahn" />
      <path d="M-40,382 C1086,382 1086,227 800,227" className="geo-impuls" style={{ animationDuration: "11.0s", animationDelay: "-5.8s" }} />
      <path d="M-40,78 C1105,78 1105,374 800,374" className="geo-bahn" />
      <path d="M-40,78 C1105,78 1105,374 800,374" className="geo-impuls" style={{ animationDuration: "6.4s", animationDelay: "-8.6s" }} />
      <path d="M-40,220 C845,220 845,250 800,250" className="geo-bahn" />
      <path d="M-40,220 C845,220 845,250 800,250" className="geo-impuls" style={{ animationDuration: "10.5s", animationDelay: "-6.8s" }} />
      <path d="M-40,104 C718,104 718,370 800,370" className="geo-bahn" />
      <path d="M-40,104 C718,104 718,370 800,370" className="geo-impuls" style={{ animationDuration: "10.4s", animationDelay: "-0.6s" }} />
      <path d="M1640,77 C977,77 977,268 800,268" className="geo-bahn" />
      <path d="M1640,77 C977,77 977,268 800,268" className="geo-impuls" style={{ animationDuration: "9.7s", animationDelay: "-9.2s" }} />
      <path d="M-40,264 C927,264 927,280 800,280" className="geo-bahn" />
      <path d="M-40,264 C927,264 927,280 800,280" className="geo-impuls" style={{ animationDuration: "8.0s", animationDelay: "-5.7s" }} />
      <path d="M1640,366 C664,366 664,455 800,455" className="geo-bahn" />
      <path d="M1640,366 C664,366 664,455 800,455" className="geo-impuls" style={{ animationDuration: "13.8s", animationDelay: "-1.2s" }} />
      <path d="M-40,299 C1077,299 1077,422 800,422" className="geo-bahn" />
      <path d="M-40,299 C1077,299 1077,422 800,422" className="geo-impuls" style={{ animationDuration: "9.4s", animationDelay: "-9.6s" }} />
      <path d="M1640,88 C698,88 698,366 800,366" className="geo-bahn" />
      <path d="M1640,88 C698,88 698,366 800,366" className="geo-impuls" style={{ animationDuration: "8.8s", animationDelay: "-5.0s" }} />
      <path d="M-40,534 C1085,534 1085,229 800,229" className="geo-bahn" />
      <path d="M-40,534 C1085,534 1085,229 800,229" className="geo-impuls" style={{ animationDuration: "9.8s", animationDelay: "-6.6s" }} />
      <path d="M1640,78 C662,78 662,406 800,406" className="geo-bahn" />
      <path d="M1640,78 C662,78 662,406 800,406" className="geo-impuls" style={{ animationDuration: "9.1s", animationDelay: "-6.7s" }} />
      <path d="M-40,54 C871,54 871,339 800,339" className="geo-bahn" />
      <path d="M-40,54 C871,54 871,339 800,339" className="geo-impuls" style={{ animationDuration: "9.9s", animationDelay: "-2.2s" }} />
      <circle cx="485" cy="493" r="3.2" className="geo-knoten" style={{ animationDelay: "-5.5s" }} />
      <circle cx="795" cy="150" r="3.2" className="geo-knoten" style={{ animationDelay: "-1.7s" }} />
      <circle cx="263" cy="308" r="3.7" className="geo-knoten" style={{ animationDelay: "-4.2s" }} />
      <circle cx="1520" cy="460" r="3.1" className="geo-knoten" style={{ animationDelay: "-1.4s" }} />
      <circle cx="183" cy="141" r="4.0" className="geo-knoten" style={{ animationDelay: "-0.1s" }} />
      <circle cx="1290" cy="159" r="2.8" className="geo-knoten" style={{ animationDelay: "-0.9s" }} />
      <circle cx="851" cy="416" r="3.0" className="geo-knoten" style={{ animationDelay: "-0.8s" }} />
      <circle cx="1332" cy="620" r="4.0" className="geo-knoten" style={{ animationDelay: "-4.4s" }} />
      <circle cx="736" cy="573" r="4.9" className="geo-knoten" style={{ animationDelay: "-4.1s" }} />
      <circle cx="888" cy="289" r="3.2" className="geo-knoten" style={{ animationDelay: "-2.9s" }} />
      <circle cx="653" cy="164" r="5.0" className="geo-knoten" style={{ animationDelay: "-2.6s" }} />
      <circle cx="223" cy="410" r="2.3" className="geo-knoten" style={{ animationDelay: "-3.4s" }} />
      <circle cx="854" cy="619" r="3.8" className="geo-knoten" style={{ animationDelay: "-0.4s" }} />
      <circle cx="368" cy="276" r="3.9" className="geo-knoten" style={{ animationDelay: "-5.7s" }} />
      <circle cx="951" cy="334" r="2.3" className="geo-knoten" style={{ animationDelay: "-2.9s" }} />
      <circle cx="1507" cy="338" r="2.9" className="geo-knoten" style={{ animationDelay: "-0.9s" }} />
      <circle cx="1170" cy="494" r="3.4" className="geo-knoten" style={{ animationDelay: "-4.2s" }} />
      <circle cx="824" cy="173" r="4.9" className="geo-knoten" style={{ animationDelay: "-2.2s" }} />
      <circle cx="1081" cy="598" r="4.3" className="geo-knoten" style={{ animationDelay: "-1.8s" }} />
      <circle cx="1012" cy="105" r="4.5" className="geo-knoten" style={{ animationDelay: "-3.1s" }} />
      <circle cx="1404" cy="263" r="2.7" className="geo-knoten" style={{ animationDelay: "-3.2s" }} />
      <circle cx="804" cy="432" r="3.8" className="geo-knoten" style={{ animationDelay: "-4.7s" }} />
      <circle cx="1182" cy="167" r="2.7" className="geo-knoten" style={{ animationDelay: "-2.4s" }} />
      <circle cx="1249" cy="170" r="3.5" className="geo-knoten" style={{ animationDelay: "-4.4s" }} />
      <circle cx="1525" cy="524" r="3.4" className="geo-knoten" style={{ animationDelay: "-1.2s" }} />
      <circle cx="956" cy="257" r="4.4" className="geo-knoten" style={{ animationDelay: "-4.3s" }} />
      <circle cx="577" cy="635" r="2.2" className="geo-knoten" style={{ animationDelay: "-0.6s" }} />
      <circle cx="756" cy="253" r="3.4" className="geo-knoten" style={{ animationDelay: "-5.9s" }} />
    </svg>
  );
}
