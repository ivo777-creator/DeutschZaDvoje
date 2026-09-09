# Deutsch za dvoje — Anleitung

## 1. Konten anlegen
In Supabase: **Authentication → Users → Add user**.
Zwei Konten anlegen (deins und Nikis), jeweils mit E-Mail und Passwort.
Dann die zwei UIDs kopieren und unten in Datei `03_rollen.sql` eintragen
(die auskommentierten Zeilen ganz unten).

## 2. Projekt lokal starten
Im Ordner:

    npm install
    cp .env.local.example .env.local

In `.env.local` die zwei Werte eintragen. Du findest sie in Supabase unter
**Project Settings → API**: die Projekt-URL und den "anon public"-Schlüssel.

    npm run dev

Dann im Browser: http://localhost:3000

## 3. Online stellen
Ordner auf GitHub hochladen, bei Vercel importieren.
Bei Vercel unter **Settings → Environment Variables** dieselben zwei Werte
nochmal eintragen. Fertig.

## 4. Aufs iPhone
Seite in Safari öffnen → Teilen-Symbol → "Zum Home-Bildschirm".
Sieht dann aus wie eine normale App.

## Wie es funktioniert
- **Startseite**: Punkte, Level, Serie und die sechs Themen zum Alleine-Üben.
- **Alleine üben**: Karte kommt auf Kroatisch, sie überlegt, deckt auf,
  sagt selbst ob sie es wusste. Was sie nicht wusste, kommt morgen wieder.
  Was sie wusste, kommt später wieder — der Abstand verdoppelt sich jedes Mal.
- **Zajednički sat** (eure Stunde): Du wählst ein Thema, sie bekommt die Karten
  automatisch auf ihr Handy. Du siehst die Lösung sofort, sie erst wenn du
  auf "Lösung für Niki zeigen" tippst. Du bewertest, sie sammelt Punkte.
