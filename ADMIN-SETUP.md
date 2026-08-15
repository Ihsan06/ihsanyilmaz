# Adminbereich einrichten — Schritt für Schritt

Ziel: **https://ihsan-yilmaz.de/admin** funktioniert und du kannst dich mit deinem Passwort anmelden.

Du brauchst: deinen Cloudflare-Login. Dauer: ca. 10 Minuten.
Reihenfolge einhalten — Schritt 4 funktioniert erst, wenn Schritt 2 fertig ist.

---

## Schritt 0 — Passwörter vorbereiten (2 Min.)

Das machst du **zuerst**, damit du sie später nur noch einfügen musst.

Öffne das Terminal (Programme → Dienstprogramme → Terminal) und führe aus:

```bash
openssl rand -base64 48
```

Es erscheint eine lange Zeichenkette wie `k8Jd2...==`. **Kopiere sie** in eine Notiz — das wird
gleich dein `SESSION_SECRET`.

Dann überleg dir dein **Admin-Passwort** (das, mit dem du dich später einloggst).
Mindestens 12 Zeichen, nicht dasselbe wie bei anderen Diensten.

> ⚠️ Beide Werte **nur** in Cloudflare eintippen/einfügen. Nicht in den Code, nicht per WhatsApp
> oder Mail verschicken, nicht hier in den Chat. Wer das `SESSION_SECRET` kennt, kommt ohne
> Passwort in dein Dashboard.

---

## Schritt 1 — Datenbank anlegen (2 Min.)

1. Öffne: **https://dash.cloudflare.com/?to=/:account/workers/d1**
   *(Falls du nicht eingeloggt bist, erst anmelden — danach landest du automatisch richtig.)*
2. Du siehst die Seite **D1 SQL Database**.
3. Klick rechts oben auf den blauen Button **`Create database`** (oder `Create`).
4. Feld **Database name**: `aiy-dashboard` eintragen — **genau so schreiben**.
5. **Location / Region**: einfach so lassen (Automatic).
6. Klick **`Create`**.

✅ Jetzt siehst du die Übersichtsseite deiner neuen Datenbank `aiy-dashboard`.

---

## Schritt 2 — Tabellen anlegen (2 Min.)

Du bist noch auf der Seite der Datenbank `aiy-dashboard`.

1. Oben siehst du Reiter wie **Metrics / Tables / Console / Settings**.
   Klick auf **`Console`**.
2. Du siehst ein großes Eingabefeld für SQL-Befehle.
3. Öffne jetzt die Datei **`schema.sql`** aus deinem Projektordner
   (`/Users/ihsan/Desktop/ihsanyilmaz/schema.sql`) — z. B. mit TextEdit.
4. **Kompletten Inhalt markieren** (⌘A), **kopieren** (⌘C).
5. Zurück im Browser: in das Console-Feld **einfügen** (⌘V).
6. Klick auf **`Execute`** (bzw. `Run`).

✅ Es erscheint eine Erfolgsmeldung. Unter dem Reiter **`Tables`** siehst du jetzt 5 Tabellen:
`anfragen`, `posts`, `transaktionen`, `notizen`, `login_versuche`.

> Wenn du eine Fehlermeldung bekommst: Du hast wahrscheinlich nur einen Teil kopiert.
> Nochmal komplett von `-- D1-Schema…` bis zur letzten Zeile markieren.

---

## Schritt 3 — Datenbank mit der Website verbinden (2 Min.)

Jetzt sagen wir deiner Website, dass sie diese Datenbank benutzen darf.

1. Öffne: **https://dash.cloudflare.com/?to=/:account/workers-and-pages**
2. In der Liste dein Projekt anklicken — das ist die Seite **ihsan-yilmaz.de**
   (heißt vermutlich `ihsanyilmaz` oder ähnlich).
3. Oben auf den Reiter **`Settings`** klicken.
4. In der Liste den Punkt **`Bindings`** suchen und anklicken.
5. Button **`+ Add`** → im Menü **`D1 database`** wählen.
6. Jetzt zwei Felder ausfüllen:

   | Feld | Was eintragen |
   |---|---|
   | **Variable name** | `DB` — nur diese zwei Großbuchstaben, sonst nichts |
   | **D1 database** | aus der Liste `aiy-dashboard` auswählen |

7. Klick **`Save`** (bzw. `Add binding`).

> ⚠️ Der Variablenname muss **exakt `DB`** sein. Nicht `db`, nicht `DB1`, keine Leerzeichen —
> sonst findet die Website die Datenbank nicht.

✅ Unter „Bindings" steht jetzt eine Zeile `DB → aiy-dashboard`.

---

## Schritt 4 — Passwörter hinterlegen (3 Min.)

Du bleibst im selben Projekt unter **`Settings`**.

1. Suche den Abschnitt **`Variables and Secrets`** und klick ihn an.
2. Klick **`+ Add`**.
3. **Ersten Wert** anlegen:

   | Feld | Wert |
   |---|---|
   | **Type** | **`Secret`** auswählen (⚠️ **nicht** `Text`/`Plaintext`) |
   | **Variable name** | `ADMIN_PASSWORD` |
   | **Value** | dein Wunsch-Passwort aus Schritt 0 |

   → **`Save`**

4. Nochmal **`+ Add`** und den **zweiten Wert** anlegen:

   | Feld | Wert |
   |---|---|
   | **Type** | **`Secret`** |
   | **Variable name** | `SESSION_SECRET` |
   | **Value** | die lange Zeichenkette aus Schritt 0 |

   → **`Save`**

> Warum `Secret` und nicht `Text`? Secrets sind nach dem Speichern nicht mehr auslesbar —
> auch nicht für jemanden, der Zugriff auf dein Dashboard bekommt. Bei `Text` stünde dein
> Passwort im Klartext da.

✅ Du siehst jetzt zwei Einträge, beide mit dem Wert `••••••` (versteckt).

---

## Schritt 5 — Neu deployen (2 Min.)

Die neuen Einstellungen greifen erst nach einem frischen Deployment.

1. Im selben Projekt oben auf den Reiter **`Deployments`** klicken.
2. Ganz oben steht das neueste Deployment.
3. Rechts daneben auf das **`···`**-Menü (drei Punkte) klicken.
4. **`Retry deployment`** wählen.
5. Ca. 1–2 Minuten warten, bis der Status auf **`Success`** springt.

---

## Fertig — Testen

1. Öffne **https://ihsan-yilmaz.de/admin**
2. Du siehst die Login-Maske „Adminbereich".
3. Dein Passwort aus Schritt 0 eingeben → **Anmelden**.
4. Du landest auf der Übersicht mit den Kacheln.

**Sofort testen, ob alles greift:** Geh auf deine normale Seite ganz nach unten, füll das
Kontaktformular aus und schick es ab. Dann im Adminbereich auf **Anfragen** — die Nachricht
muss dort auftauchen.

---

## Wenn etwas nicht klappt

| Was du siehst | Was los ist | Lösung |
|---|---|---|
| „Adminbereich ist noch nicht konfiguriert." | Die Secrets fehlen oder heißen anders | Schritt 4 prüfen: Schreibweise `ADMIN_PASSWORD` / `SESSION_SECRET` exakt? |
| „Datenbank ist nicht verbunden." | Das Binding fehlt oder heißt nicht `DB` | Schritt 3 prüfen: Variable name exakt `DB`? |
| „Falsches Passwort." obwohl richtig | Deployment war vor dem Setzen der Secrets | Schritt 5 wiederholen (Retry deployment) |
| Fehler mit „no such table" | Schema nicht eingespielt | Schritt 2 wiederholen |
| „Zu viele Fehlversuche" | 8× falsches Passwort | 15 Minuten warten, dann wieder möglich |

Ändert sich später dein Passwort-Wunsch: Schritt 4, bei `ADMIN_PASSWORD` auf **Edit**,
neuen Wert speichern, dann Schritt 5.

---

## Optional: API-Verbrauch mit Tageszahlen (Finanzen → API & Verbrauch)

Die Seite zeigt Datenbankgröße, Bildspeicher und Mail-Verbrauch **sofort ohne Setup**.
Für die Tageszahlen (gelesene/geschriebene Zeilen, Seitenaufrufe) braucht es einen
lesenden Cloudflare-Token:

1. **https://dash.cloudflare.com/profile/api-tokens** → **Create Token**
2. Unten **Create Custom Token** → **Get started**
3. Name: `aiy-verbrauch` — Berechtigungen (beide nur **Read**):
   - **Account → Account Analytics → Read**
   - **Account → D1 → Read**
4. **Continue to summary** → **Create Token** → den Token kopieren
   (wird nur einmal angezeigt).
5. Im Pages-Projekt unter **Settings → Variables and Secrets** zwei Einträge anlegen:

   | Typ | Name | Wert |
   |---|---|---|
   | Secret | `CF_API_TOKEN` | der eben erzeugte Token |
   | Text | `CF_ACCOUNT_ID` | deine Account-ID (Dashboard → rechte Seitenleiste unter „API", oder in der URL nach `dash.cloudflare.com/`) |

6. **Deployments → Retry deployment.**

Der Token kann nur lesen — selbst wenn er abhandenkommt, kann damit niemand etwas
ändern oder löschen. Trotzdem: wie ein Passwort behandeln.

## Was der Adminbereich kann

- **Übersicht** — Kennzahlen auf einen Blick
- **Anfragen** — jede Nachricht aus dem Kontaktformular landet automatisch hier,
  mit Status (Neu → In Bearbeitung → Beantwortet → Archiviert)
- **Instagram** — Beiträge planen: Titel, Caption, Hashtags, Termin, Status.
  „Text kopieren" legt Caption + Hashtags in die Zwischenablage für die Insta-App
- **Finanzen** — Einnahmen & Ausgaben mit Kategorien, Jahressummen und Saldo
- **Selbständigkeit** — Aufgaben, Ideen, Steuer- und Behördentermine zum Abhaken

### Sicherheit

- Anmeldung über ein signiertes `HttpOnly`-Cookie, 12 Stunden gültig
- Nach 8 Fehlversuchen aus derselben IP: 15 Minuten gesperrt
- Jeder Datenzugriff wird serverseitig auf Anmeldung geprüft
- Der Adminbereich ist per `noindex` von Google ausgeschlossen

### Später: automatisch auf Instagram posten

Möglich, aber nur mit Instagram-**Business**- oder Creator-Account, verknüpfter Facebook-Seite,
eigener Meta-App und deren Freigabeprozess. Der Planer ist so gebaut, dass das später ergänzt
werden kann, ohne vorhandene Beiträge zu verlieren.
