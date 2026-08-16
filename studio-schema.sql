-- Tabellen für das Content-Studio (1:1-Port des Diezmann-Bereichs "Content erstellen").
-- Präfix studio_ trennt sie von den AIY-Dashboard-Tabellen.
-- Schema aus dem portierten Code abgeleitet (INSERT/SELECT/UPDATE-Spalten).
-- Einspielen:  npx wrangler d1 execute aiy-dashboard --remote --file=./studio-schema.sql

-- Galerie-Verzeichnis des Studios (Dateien in R2, Binding BILDER)
CREATE TABLE IF NOT EXISTS studio_bilder (
  schluessel  TEXT PRIMARY KEY,
  groesse     INTEGER NOT NULL DEFAULT 0,
  typ         TEXT,
  angelegt    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Galerie-Kategorien
CREATE TABLE IF NOT EXISTS studio_kategorien (
  id        TEXT PRIMARY KEY,
  titel     TEXT NOT NULL,
  hinweis   TEXT,
  fest      INTEGER NOT NULL DEFAULT 0,
  angelegt  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Themenvorrat (KI-beschriebene Galerie-Motive für Beiträge)
CREATE TABLE IF NOT EXISTS studio_vorrat (
  schluessel       TEXT PRIMARY KEY,
  quelle           TEXT,
  motiv            TEXT,
  beschreibung     TEXT,
  personen         INTEGER DEFAULT 0,
  freigabe         INTEGER DEFAULT 0,
  zuletzt_benutzt  TEXT,
  geloescht_am     TEXT,
  angelegt         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gedächtnis: welcher Beitrag zu welchem Thema/Fahrzeug schon gebaut wurde
CREATE TABLE IF NOT EXISTS studio_beitraege (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fahrzeug_id  TEXT,
  thema        TEXT,
  notiz        TEXT,
  zeitpunkt    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Instagram-Kennzahlen-Verlauf (Spalte "studio_beitraege" = Beitragszahl;
CREATE TABLE IF NOT EXISTS studio_instagram (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  zeitpunkt         TEXT NOT NULL DEFAULT (datetime('now')),
  follower          INTEGER,
  beitraege         INTEGER,
  quelle            TEXT
);

-- Schlüssel-Wert-Ablage des Studios (z. B. gespeicherte Stile)
CREATE TABLE IF NOT EXISTS studio_einstellungen (
  schluessel  TEXT PRIMARY KEY,
  wert        TEXT,
  geaendert   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fahrzeug-Gedächtnis (im AIY-Kontext zunächst leer — Fahrzeug-Funktionen
-- bleiben nutzbar, sobald hier Daten liegen)
CREATE TABLE IF NOT EXISTS studio_bestand (
  fahrzeug_id      TEXT PRIMARY KEY,
  titel            TEXT,
  marke            TEXT,
  preis            INTEGER,
  bild             TEXT,
  zuerst_gesehen   TEXT,
  zuletzt_gesehen  TEXT,
  verschwunden_am  TEXT
);

-- API-Zugänge/Token-Verlängerungs-Gedächtnis
CREATE TABLE IF NOT EXISTS studio_zugaenge (
  name      TEXT PRIMARY KEY,
  wert      TEXT,
  erneuert  TEXT
);

-- Eingangs-/Zugangs-Protokoll (vom Bestandsabgleich genutzt)
CREATE TABLE IF NOT EXISTS studio_eingaenge (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  zeitpunkt  TEXT NOT NULL DEFAULT (datetime('now')),
  inhalt     TEXT
);

-- Warteschlange fuer zeitversetztes Posten. Die Bilder sind beim Einplanen
-- schon fertig zugeschnitten und liegen in R2 (Pfade als JSON-Array) — der
-- Cron-Worker (worker/planer) muss sie nur noch bei Instagram einreichen.
CREATE TABLE IF NOT EXISTS studio_warteschlange (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  zeitpunkt    TEXT NOT NULL,                       -- UTC, wann gepostet wird
  format       TEXT NOT NULL DEFAULT 'beitrag',     -- beitrag | story
  text         TEXT,
  bilder       TEXT NOT NULL,                       -- JSON-Array von /bilder/-Pfaden
  status       TEXT NOT NULL DEFAULT 'geplant',     -- geplant | laeuft | gepostet | fehler
  fehler       TEXT,
  beitrag_id   TEXT,
  weg          TEXT,                                -- Permalink nach dem Posten
  angelegt     TEXT NOT NULL DEFAULT (datetime('now')),
  gepostet_am  TEXT
);
CREATE INDEX IF NOT EXISTS idx_warteschlange_faellig ON studio_warteschlange(status, zeitpunkt);
