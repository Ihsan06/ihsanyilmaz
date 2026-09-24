"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

// Kartenansicht der Akquise: jeder Betrieb mit Koordinate als Punkt, Farbe
// nach Kategorie, Groesse nach Prioritaet. Es gelten dieselben Filter wie in
// der Liste – die Karte bekommt nur die sichtbaren Betriebe.
// Leaflet wird erst im Browser geladen: es greift beim Import auf window zu,
// und der statische Export rendert die Seite vorab ohne window.

export type KartenBetrieb = {
  id: number; name: string; ort: string | null; art: string | null;
  lat: number | null; lng: number | null;
  kategorie: string | null; prioritaet: number | null;
  website: string | null; google_bewertung: number | null; google_anzahl: number | null;
  auswahl: number;
};

// Dieselben Farben wie die Kategorie-Chips in globals.css (.akq-kat.*).
const FARBE: Record<string, string> = {
  ohne_website: "#12557F", nur_boerse: "#b45309", baukasten: "#6d28d9",
  veraltet: "#b91c1c", mittel: "#9a6b00", gepflegt: "#1d8a52",
};
const LABEL: Record<string, string> = {
  ohne_website: "Ohne Website", nur_boerse: "Nur Börse", baukasten: "Baukasten",
  veraltet: "Veraltet", mittel: "Mittel", gepflegt: "Gepflegt",
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

type Zustand = { L: typeof import("leaflet"); m: LeafletMap; g: LayerGroup; gezoomt: boolean };

// Punkte der gefilterten Betriebe zeichnen. Nur beim ersten Mal passt sich
// der Ausschnitt an – danach springt die Karte beim Filtern nicht.
function punkteZeichnen(z: Zustand, betriebe: KartenBetrieb[]) {
  const { L, m, g } = z;
  g.clearLayers();
  const punkte: [number, number][] = [];
  for (const b of betriebe) {
    if (b.lat == null || b.lng == null) continue;
    const farbe = FARBE[b.kategorie || ""] || "#7C8A97";
    const prio = b.prioritaet ?? 0;
    const radius = 5 + Math.round(Math.max(0, Math.min(100, prio)) / 14);
    const punkt = L.circleMarker([b.lat, b.lng], {
      radius, color: b.auswahl ? "#d99a06" : "#fff", weight: b.auswahl ? 3 : 1.5,
      fillColor: farbe, fillOpacity: 0.85,
    });
    const website = b.website
      ? `<a href="${esc(b.website)}" target="_blank" rel="noopener noreferrer">${esc(b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`
      : "keine Website";
    const google = b.google_anzahl != null ? ` · ★ ${esc(String(b.google_bewertung ?? "").replace(".", ","))} (${esc(b.google_anzahl)})` : "";
    punkt.bindPopup(
      `<div class="akq-karte-popup"><b>${esc(b.name)}</b>` +
      `<span>${esc([b.art === "car_repair" ? "Werkstatt" : "Autohaus", b.ort].filter(Boolean).join(" · "))}</span>` +
      `<span><i style="background:${farbe}"></i>${esc(LABEL[b.kategorie || ""] || "Offen")} · Priorität ${esc(b.prioritaet ?? "—")}${google}</span>` +
      `<span>${website}</span>` +
      `<button type="button" data-details="${b.id}">Details in der Liste</button></div>`,
    );
    punkt.bindTooltip(esc(b.name), { direction: "top", offset: [0, -radius] });
    punkt.addTo(g);
    punkte.push([b.lat, b.lng]);
  }
  if (punkte.length && !z.gezoomt) {
    m.fitBounds(L.latLngBounds(punkte), { padding: [30, 30], maxZoom: 13 });
    z.gezoomt = true;
  }
}

export default function Karte({ betriebe, onDetails }: { betriebe: KartenBetrieb[]; onDetails: (id: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const zustand = useRef<Zustand | null>(null);
  const betriebeRef = useRef(betriebe);
  const detailsRef = useRef(onDetails);
  useEffect(() => { detailsRef.current = onDetails; }, [onDetails]);

  // Karte einmal anlegen.
  useEffect(() => {
    let weg = false;
    import("leaflet").then(L => {
      if (weg || !box.current || zustand.current) return;
      const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: true }).setView([49.79, 9.95], 10);
      // OSM-Standardkacheln: fuer ein Werkzeug mit einem Nutzer im Rahmen der
      // Nutzungsrichtlinie, Namensnennung ist Pflicht.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      // Ein Klick auf "Details" im Popup oeffnet die Zeile in der Liste.
      m.getContainer().addEventListener("click", e => {
        const ziel = (e.target as HTMLElement).closest("[data-details]") as HTMLElement | null;
        if (ziel) detailsRef.current(Number(ziel.dataset.details));
      });
      zustand.current = { L, m, g: L.layerGroup().addTo(m), gezoomt: false };
      punkteZeichnen(zustand.current, betriebeRef.current);
    });
    return () => {
      weg = true;
      zustand.current?.m.remove();
      zustand.current = null;
    };
  }, []);

  // Punkte neu zeichnen, sobald sich die gefilterte Liste aendert.
  useEffect(() => {
    betriebeRef.current = betriebe;
    if (zustand.current) punkteZeichnen(zustand.current, betriebe);
  }, [betriebe]);

  const ohneKoordinate = betriebe.filter(b => b.lat == null || b.lng == null).length;
  return (
    <div className="akq-karte-huelle">
      <div ref={box} className="akq-karte" />
      <div className="akq-karte-legende">
        {Object.entries(LABEL).map(([k, l]) => (
          <span key={k}><i style={{ background: FARBE[k] }} />{l}</span>
        ))}
        <span><i style={{ background: "#7C8A97" }} />Offen</span>
        <span className="akq-hinweis">Größe = Priorität · gelber Rand = Auswahl{ohneKoordinate ? ` · ${ohneKoordinate} ohne Koordinate nicht auf der Karte` : ""}</span>
      </div>
    </div>
  );
}
