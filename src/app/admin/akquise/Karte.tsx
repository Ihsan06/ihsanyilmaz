"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

// Karte der Akquise im Lagebild: jeder Betrieb mit Koordinate als Punkt,
// Farbe nach Kategorie, Groesse nach Prioritaet. Es gelten dieselben Filter
// wie in der Liste – die Karte bekommt nur die sichtbaren Betriebe.
// Die Legende liegt auf der Karte und filtert: ein Klick auf eine Kategorie
// wirkt wie der Knopf ueber der Liste.
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
export const KAT_FARBE: Record<string, string> = {
  ohne_website: "#12557F", nur_boerse: "#c2410c", baukasten: "#7c3aed",
  veraltet: "#dc2626", mittel: "#ca8a04", gepflegt: "#16a34a", offen: "#94a3b8",
};
const LABEL: Record<string, string> = {
  nur_boerse: "Nur Börse", ohne_website: "Ohne Website", veraltet: "Veraltet", baukasten: "Baukasten",
  mittel: "Mittel", gepflegt: "Gepflegt", offen: "Offen",
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// punkte: letzter Umriss aller Punkte; nutzer: hat selbst verschoben oder
// gezoomt – dann passt sich der Ausschnitt nicht mehr von allein an.
type Zustand = { L: typeof import("leaflet"); m: LeafletMap; g: LayerGroup; gezoomt: boolean; nutzer: boolean; punkte: [number, number][] };

// Punkte zeichnen; die wichtigsten zuletzt, damit sie oben liegen. Nur beim
// ersten Mal passt sich der Ausschnitt an – danach springt die Karte beim
// Filtern nicht.
function punkteZeichnen(z: Zustand, betriebe: KartenBetrieb[]) {
  const { L, g } = z;
  g.clearLayers();
  const punkte: [number, number][] = [];
  const sortiert = [...betriebe].sort((a, b) => (a.prioritaet ?? 0) - (b.prioritaet ?? 0));
  for (const b of sortiert) {
    if (b.lat == null || b.lng == null) continue;
    const farbe = KAT_FARBE[b.kategorie || "offen"] || KAT_FARBE.offen;
    const prio = b.prioritaet ?? 0;
    const radius = 4 + Math.round(Math.max(0, Math.min(100, prio)) / 12);
    const punkt: CircleMarker = L.circleMarker([b.lat, b.lng], {
      radius, color: b.auswahl ? "#f59e0b" : "#ffffff", weight: b.auswahl ? 3 : 1.5,
      fillColor: farbe, fillOpacity: prio >= 60 ? 0.95 : 0.75,
    });
    const website = b.website
      ? `<a href="${esc(b.website)}" target="_blank" rel="noopener noreferrer">${esc(b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>`
      : "keine Website";
    const google = b.google_anzahl != null ? `<span>★ ${esc(String(b.google_bewertung ?? "").replace(".", ","))} · ${esc(b.google_anzahl)} Bewertungen</span>` : "";
    punkt.bindPopup(
      `<div class="akq-karte-popup">` +
      `<span class="akq-karte-popup-kat" style="--kat:${farbe}">${esc(LABEL[b.kategorie || "offen"] || "Offen")} · Priorität ${esc(b.prioritaet ?? "—")}</span>` +
      `<b>${esc(b.name)}</b>` +
      `<span>${esc([b.art === "car_repair" ? "Werkstatt" : "Autohaus", b.ort].filter(Boolean).join(" · "))}</span>` +
      google + `<span>${website}</span>` +
      `<button type="button" data-details="${b.id}">Details in der Liste</button></div>`,
      { closeButton: false, className: "akq-popup-huelle" },
    );
    punkt.bindTooltip(esc(b.name), { direction: "top", offset: [0, -radius], className: "akq-karte-tooltip" });
    // Beim Ueberfahren waechst der Punkt – man sieht, welcher gemeint ist.
    punkt.on("mouseover", () => punkt.setRadius(radius + 3));
    punkt.on("mouseout", () => punkt.setRadius(radius));
    punkt.addTo(g);
    punkte.push([b.lat, b.lng]);
  }
  z.punkte = punkte;
  if (punkte.length && !z.gezoomt) {
    einpassen(z);
    z.gezoomt = true;
  }
}

// Unten liegt die Legende – die Punkte sollen nicht darunter verschwinden.
function einpassen(z: Zustand) {
  if (!z.punkte.length) return;
  z.m.invalidateSize();
  z.m.fitBounds(z.L.latLngBounds(z.punkte), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 110], maxZoom: 13 });
}

export default function Karte({ betriebe, onDetails, kategorien, aktiv, onKategorie }: {
  betriebe: KartenBetrieb[];
  onDetails: (id: number) => void;
  kategorien: Record<string, number>;
  aktiv: string[];
  onKategorie: (k: string) => void;
}) {
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
      const m = L.map(box.current, { zoomControl: false, scrollWheelZoom: true, attributionControl: true }).setView([49.79, 9.95], 10);
      L.control.zoom({ position: "topright" }).addTo(m);
      // OSM-Standardkacheln (Nutzungsrichtlinie: wenig Last, Namensnennung).
      // In globals.css entfaerbt – die farbigen Punkte stehen so deutlicher.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      // Ein Klick auf "Details" im Popup oeffnet die Zeile in der Liste.
      m.getContainer().addEventListener("click", e => {
        const ziel = (e.target as HTMLElement).closest("[data-details]") as HTMLElement | null;
        if (ziel) { m.closePopup(); detailsRef.current(Number(ziel.dataset.details)); }
      });
      const z: Zustand = { L, m, g: L.layerGroup().addTo(m), gezoomt: false, nutzer: false, punkte: [] };
      zustand.current = z;
      // Nur echte Eingaben zaehlen als "selbst bewegt" – fitBounds loest
      // ebenfalls Zoom-Ereignisse aus.
      const selbst = () => { z.nutzer = true; };
      m.getContainer().addEventListener("wheel", selbst, { passive: true });
      m.getContainer().addEventListener("pointerdown", selbst);
      punkteZeichnen(z, betriebeRef.current);
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

  // Die Hoehe haengt am Raster; Leaflet muss nach Groessenaenderungen neu messen.
  useEffect(() => {
    if (!box.current || typeof ResizeObserver === "undefined") return;
    // Die Karte wird oft kleiner angelegt, als sie nach dem Laden der
    // Kennzahlen ist – dann neu messen und, solange niemand selbst
    // verschoben hat, den Ausschnitt wieder auf alle Punkte setzen.
    const ro = new ResizeObserver(() => {
      const z = zustand.current;
      if (!z) return;
      if (z.nutzer) z.m.invalidateSize(); else einpassen(z);
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const ohneKoordinate = betriebe.filter(b => b.lat == null || b.lng == null).length;
  return (
    <div className="akq-karte-huelle">
      <div ref={box} className="akq-karte" />
      {/* Legende unten als Glasleiste: Kategorien zum Anklicken, darunter die
          Groessen-Erklaerung. Unten, weil die Karte hoch ist und breit wenig Platz hat. */}
      <div className="akq-legende" role="group" aria-label="Kategorie auf der Karte">
        <div className="akq-legende-knoepfe">
          {Object.entries(LABEL).map(([k, l]) => {
            const n = kategorien[k] || 0;
            const an = aktiv.includes(k);
            return (
              <button key={k} type="button" onClick={() => onKategorie(k)} disabled={!n} aria-pressed={an}
                      className={`${an ? "an" : ""}${aktiv.length && !an ? " gedimmt" : ""}`}>
                <i style={{ background: KAT_FARBE[k] }} />{l}<b>{n}</b>
              </button>
            );
          })}
        </div>
        <p className="akq-legende-fuss">
          <span className="akq-groessen" aria-hidden="true"><i /><i /><i /></span>
          Größe = Priorität{ohneKoordinate ? ` · ${ohneKoordinate} ohne Koordinate` : ""}
        </p>
      </div>
    </div>
  );
}
