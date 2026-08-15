# Adminbereich einrichten

Der Adminbereich liegt unter **https://ihsan-yilmaz.de/admin**. Damit er funktioniert,
brauchst du drei Dinge in Cloudflare: eine Datenbank, zwei Passwörter (Secrets) und die Verbindung dazwischen.
Dauert einmalig ca. 10 Minuten.

---

## 1. Datenbank anlegen

Cloudflare Dashboard → **Storage & Databases → D1 SQL Database → Create database**

- Name: `aiy-dashboard`
- Region: Automatisch / Europa

## 2. Tabellen anlegen

In der neuen Datenbank auf den Reiter **Console** gehen, den kompletten Inhalt der Datei
`schema.sql` (liegt im Projekt) hineinkopieren und ausführen.

Alternativ im Terminal:

```bash
npx wrangler d1 execute aiy-dashboard --remote --file=./schema.sql
```

## 3. Datenbank mit der Website verbinden

Dashboard → **Workers & Pages → dein Projekt → Settings → Bindings → Add binding**

- Typ: **D1 database**
- Variable name: **`DB`** (genau so schreiben, groß)
- D1 database: `aiy-dashboard`

## 4. Zugangsdaten hinterlegen

Gleiche Seite → **Variables and Secrets → Add**. Beide als Typ **Secret** anlegen
(nicht als „Text" — Secrets sind danach nicht mehr auslesbar):

| Name | Wert |
|---|---|
| `ADMIN_PASSWORD` | Dein Wunsch-Passwort für den Adminbereich |
| `SESSION_SECRET` | Eine lange Zufallszeichenkette (siehe unten) |

Zufallswert für `SESSION_SECRET` erzeugen:

```bash
openssl rand -base64 48
```

> **Wichtig:** Diese beiden Werte nirgends in den Code schreiben und nicht per Chat/E-Mail
> verschicken — nur direkt im Cloudflare-Dashboard eintragen. Das `SESSION_SECRET` signiert
> deine Anmeldung; wer es kennt, kommt ohne Passwort rein.

## 5. Neu deployen

Nach dem Setzen der Bindings einmal **Deployments → Retry deployment** (oder einen neuen Push),
damit die Einstellungen aktiv werden.

---

## Fertig

Aufrufen: **https://ihsan-yilmaz.de/admin** → Passwort eingeben.

Was drin ist:

- **Übersicht** — Kennzahlen auf einen Blick
- **Anfragen** — jede Nachricht aus dem Kontaktformular landet hier automatisch, mit Status (Neu → In Bearbeitung → Beantwortet → Archiviert)
- **Instagram** — Beiträge planen: Titel, Caption, Hashtags, Termin, Status; „Text kopieren" für die Insta-App
- **Finanzen** — Einnahmen & Ausgaben mit Kategorien, Jahressummen und Saldo
- **Selbständigkeit** — Aufgaben, Ideen, Steuer- und Behördentermine zum Abhaken

## Sicherheit

- Login über signiertes, `HttpOnly`-Cookie (12 Stunden gültig)
- Nach 8 Fehlversuchen aus derselben IP für 15 Minuten gesperrt
- Alle Datenendpunkte prüfen die Anmeldung serverseitig
- Der Adminbereich ist per `noindex` von Suchmaschinen ausgeschlossen

## Später: automatisch auf Instagram posten

Möglich, aber nur mit Instagram-**Business**- oder Creator-Account, verknüpfter Facebook-Seite,
eigener Meta-App und deren Freigabeprozess. Der Planer ist so gebaut, dass das später
ergänzt werden kann, ohne die vorhandenen Beiträge zu verlieren.
