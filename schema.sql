-- D1-Schema für den AIY-Adminbereich
-- Einspielen mit:  npx wrangler d1 execute aiy-dashboard --remote --file=./schema.sql

-- Kontaktanfragen von der Website
CREATE TABLE IF NOT EXISTS anfragen (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  betrieb      TEXT,
  nachricht    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'neu',   -- neu | in_bearbeitung | beantwortet | archiviert
  notiz        TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_anfragen_status ON anfragen(status);
CREATE INDEX IF NOT EXISTS idx_anfragen_datum  ON anfragen(erstellt_am DESC);

-- Instagram-Redaktionsplan
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  titel        TEXT NOT NULL,
  caption      TEXT,
  hashtags     TEXT,
  geplant_am   TEXT,                          -- YYYY-MM-DD
  status       TEXT NOT NULL DEFAULT 'idee',  -- idee | entwurf | geplant | veroeffentlicht
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Einnahmen & Ausgaben (Beträge IMMER in ganzen Cent — keine Rundungsfehler)
CREATE TABLE IF NOT EXISTS transaktionen (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  art           TEXT NOT NULL,                -- einnahme | ausgabe
  betrag_cent   INTEGER NOT NULL,
  beschreibung  TEXT NOT NULL,
  kategorie     TEXT,
  datum         TEXT NOT NULL,                -- YYYY-MM-DD
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trans_datum ON transaktionen(datum DESC);

-- Selbständigkeit: Aufgaben, Ideen, Termine, Behördenkram
CREATE TABLE IF NOT EXISTS notizen (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  titel        TEXT NOT NULL,
  inhalt       TEXT,
  kategorie    TEXT,                          -- Aufgabe | Idee | Steuer | Behörde | Sonstiges
  erledigt     INTEGER NOT NULL DEFAULT 0,
  faellig_am   TEXT,                          -- YYYY-MM-DD
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notizen_erledigt ON notizen(erledigt);

-- Galerie: Verzeichnis der Bilder. Die Dateien selbst liegen in R2 (Binding BILDER),
-- hier stehen nur Schlüssel und Größe, damit der Speicherstand abfragbar bleibt.
CREATE TABLE IF NOT EXISTS bilder (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  schluessel   TEXT NOT NULL UNIQUE,
  dateiname    TEXT,
  groesse      INTEGER NOT NULL DEFAULT 0,
  typ          TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bilder_datum ON bilder(erstellt_am DESC);

-- Dokumentenarchiv: Rechnungen, Belege, Verträge, Behördenpost.
-- Dateien liegen wie die Galerie in R2 (Binding BILDER), unter dem Präfix "dokumente/".
CREATE TABLE IF NOT EXISTS dokumente (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  schluessel   TEXT NOT NULL UNIQUE,
  dateiname    TEXT,
  kategorie    TEXT,                          -- Rechnung | Beleg | Vertrag | Behörde | Sonstiges
  notiz        TEXT,
  groesse      INTEGER NOT NULL DEFAULT 0,
  typ          TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dokumente_datum ON dokumente(erstellt_am DESC);

-- Kleine Schlüssel-Wert-Ablage (z. B. verlängerter Instagram-Token —
-- Secrets sind aus Functions heraus nicht beschreibbar, die DB schon)
CREATE TABLE IF NOT EXISTS einstellungen (
  schluessel  TEXT PRIMARY KEY,
  wert        TEXT,
  geaendert   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fehlgeschlagene Login-Versuche (Brute-Force-Bremse)
CREATE TABLE IF NOT EXISTS login_versuche (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT,
  zeitpunkt  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_zeit ON login_versuche(zeitpunkt);

-- Jeder Absendeversuch des Kontaktformulars, auch die, aus denen keine
-- Anfrage wurde. Daraus baut das Monitoring die Tabelle "Anfragen nach
-- Formular": ok | ungueltig (Pflichtfeld fehlte) | fehler (Versand
-- scheiterte) | bot (Honeypot ausgefuellt).
CREATE TABLE IF NOT EXISTS eingaenge (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  zeitpunkt TEXT NOT NULL,
  formular  TEXT NOT NULL,
  ergebnis  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eingaenge_zeit ON eingaenge(zeitpunkt);

-- „Demo ansehen“ auf der Startseite: wer die Demo-Links per E-Mail
-- angefordert hat. Adresse, Zeitpunkt, Sprache und ob der Versand klappte –
-- keine IP. Dient der Bremse (je Adresse einmal am Tag) und dem Nachhalten.
CREATE TABLE IF NOT EXISTS demo_zugaenge (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  zeitpunkt TEXT NOT NULL,
  email     TEXT NOT NULL,
  sprache   TEXT NOT NULL DEFAULT 'de',
  versandt  INTEGER NOT NULL DEFAULT 0,
  fehler    TEXT,
  auswahl   TEXT NOT NULL DEFAULT 'beide'   -- autohaus | cafe | beide
);
CREATE INDEX IF NOT EXISTS idx_demo_zugaenge_zeit  ON demo_zugaenge(zeitpunkt);
CREATE INDEX IF NOT EXISTS idx_demo_zugaenge_email ON demo_zugaenge(email);

-- Akquise: Autohaeuser und Werkstaetten aus OpenStreetMap, deren Website
-- automatisch geprueft und bewertet wird. Ziel: etablierte Betriebe mit
-- schwacher Website finden. Kontakt spaeter per Brief oder Besuch.
CREATE TABLE IF NOT EXISTS akquise_betriebe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quelle TEXT NOT NULL DEFAULT 'osm',            -- osm | manuell
  quelle_id TEXT,                                 -- z. B. node/123456 oder way/98765
  name TEXT NOT NULL,
  art TEXT,                                       -- car | car_repair
  marken TEXT,                                    -- aus OSM brand, kommasepariert
  strasse TEXT, plz TEXT, ort TEXT,
  lat REAL, lng REAL,
  telefon TEXT, email TEXT,
  website TEXT,                                   -- normalisiert (Schema ergänzt), NULL wenn keine
  oeffnungszeiten TEXT,
  region TEXT,                                    -- Bezeichnung des Suchlaufs
  status TEXT NOT NULL DEFAULT 'neu',             -- neu | beobachten | brief | kontakt | kunde | aus
  notiz TEXT,
  score_website INTEGER,                          -- Schwäche der Website 0–100 (hoch = schlecht)
  score_betrieb INTEGER,                          -- Stärke des Betriebs 0–100
  prioritaet INTEGER,                             -- round(0.6*score_website + 0.4*score_betrieb)
  geprueft_am TEXT,
  angelegt TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_akq_quelle ON akquise_betriebe(quelle, quelle_id);
CREATE INDEX IF NOT EXISTS idx_akq_prio ON akquise_betriebe(prioritaet DESC);

-- Jede Pruefung einzeln, damit sich Veraenderungen ueber die Zeit sehen lassen.
CREATE TABLE IF NOT EXISTS akquise_pruefungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  betrieb_id INTEGER NOT NULL,
  zeitpunkt TEXT NOT NULL DEFAULT (datetime('now')),
  erreichbar INTEGER, https INTEGER, viewport INTEGER,
  cms TEXT, baukasten TEXT, jquery TEXT, copyright_jahr INTEGER,
  impressum INTEGER, datenschutz INTEGER, schema_org INTEGER,
  fahrzeuge_eigen INTEGER, boersen_link INTEGER,
  psi_leistung INTEGER, psi_lcp REAL, psi_cls REAL,
  wayback_erster TEXT, wayback_letzter TEXT, wayback_anzahl INTEGER,
  titel TEXT, generator TEXT, antwort_ms INTEGER, groesse_kb INTEGER,
  signale TEXT,                                   -- JSON: [{code, text, punkte, seite:'website'|'betrieb'}]
  fehler TEXT,
  roh TEXT                                        -- JSON mit allem, was sonst nicht in Spalten passt
);
CREATE INDEX IF NOT EXISTS idx_akq_pruef ON akquise_pruefungen(betrieb_id, zeitpunkt DESC);

-- Suchlaeufe: was wann in welcher Region gesucht wurde.
CREATE TABLE IF NOT EXISTS akquise_laeufe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  art TEXT NOT NULL,                              -- suche
  region TEXT, parameter TEXT,
  gefunden INTEGER, neu INTEGER,
  fehler TEXT,
  zeitpunkt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Woher die Website eines Betriebs stammt: aus OSM, von Hand eingetragen,
-- von der Pruefung geraten (vermutet) oder vom Nutzer bestaetigt.
ALTER TABLE akquise_betriebe ADD COLUMN website_quelle TEXT;

-- Akquise-Post: je Brief eine Zeile, der Token fuehrt zur persoenlichen
-- Landingpage /fuer/<token>. Der Brief selbst liegt als PDF in R2 (BILDER)
-- unter akquise/<token>.pdf.
CREATE TABLE IF NOT EXISTS akquise_briefe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  betrieb_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'entwurf',        -- entwurf | freigegeben | gesendet | zugestellt | fehler | storniert
  art TEXT NOT NULL DEFAULT 'brief',              -- brief | nachfass | test
  empfaenger TEXT,                                -- Anschriftenblock, wie gedruckt (Zeilen mit \n)
  befunde TEXT,                                   -- JSON: die im Brief genannten Befunde
  text TEXT,                                      -- gerenderter Brieftext
  pdf_schluessel TEXT,
  anbieter TEXT, anbieter_id TEXT, kosten_cent INTEGER,
  fehler TEXT,
  aufrufe INTEGER NOT NULL DEFAULT 0,
  zuletzt_aufgerufen TEXT,
  demo_angefordert TEXT,
  angelegt TEXT NOT NULL DEFAULT (datetime('now')),
  gesendet_am TEXT,
  zugestellt_am TEXT
);
CREATE INDEX IF NOT EXISTS idx_akq_brief_betrieb ON akquise_briefe(betrieb_id, angelegt DESC);

-- Wer nicht mehr angeschrieben werden will, steht hier – Pflichtabgleich vor
-- jedem Versand.
CREATE TABLE IF NOT EXISTS akquise_sperrliste (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  betrieb_id INTEGER,
  name TEXT,
  grund TEXT,
  angelegt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Runde 2: Website-Suche ueber Google Places (nur Place-ID dauerhaft, Bewertungs-
-- zahl als Momentaufnahme mit Stand), Auswahl-Stern, Papierkorb und Kategorie.
ALTER TABLE akquise_betriebe ADD COLUMN google_place_id TEXT;
ALTER TABLE akquise_betriebe ADD COLUMN google_bewertung REAL;
ALTER TABLE akquise_betriebe ADD COLUMN google_anzahl INTEGER;
ALTER TABLE akquise_betriebe ADD COLUMN google_stand TEXT;
ALTER TABLE akquise_betriebe ADD COLUMN auswahl INTEGER NOT NULL DEFAULT 0;   -- 1 = vom Nutzer markiert
ALTER TABLE akquise_betriebe ADD COLUMN geloescht TEXT;                        -- Zeitpunkt, wenn im Papierkorb
ALTER TABLE akquise_betriebe ADD COLUMN kategorie TEXT;                        -- ohne_website | nur_boerse | baukasten | veraltet | gepflegt | unbekannt

-- Doppelte Betriebe (OSM fuehrt manche zweimal, etwa Showroom und Werkstatt):
-- der zusammengefuehrte Eintrag bleibt als unsichtbare Zeile stehen
-- (geloescht gesetzt, zeigt auf den Haupteintrag), damit der naechste
-- OSM-Suchlauf ihn nicht wieder als neu anlegt.
ALTER TABLE akquise_betriebe ADD COLUMN zusammengefuehrt_in INTEGER;

-- Von Hand eingetragen (mobile.de-Haendlerseite, Handelsregister): Fahrzeuge
-- im Bestand und Gruendungsjahr. Beides zaehlt als Staerke des Betriebs.
-- Automatisch auslesen verbieten die AGB von mobile.de und AutoScout24.
ALTER TABLE akquise_betriebe ADD COLUMN fahrzeuge INTEGER;
ALTER TABLE akquise_betriebe ADD COLUMN gruendungsjahr INTEGER;

-- Endgueltig geloeschte Betriebe: nur der Quellschluessel bleibt (OSM-ID bzw.
-- Google-Place-ID, kein Name, keine Adresse), damit der naechste Suchlauf sie
-- nicht wieder anlegt.
CREATE TABLE IF NOT EXISTS akquise_ausgeschlossen (
  quelle TEXT NOT NULL,                           -- osm | google
  quelle_id TEXT NOT NULL,
  angelegt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (quelle, quelle_id)
);
