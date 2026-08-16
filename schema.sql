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
