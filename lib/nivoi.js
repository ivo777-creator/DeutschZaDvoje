"use client";

/* Ein Level sind 10 Karten. Kommen neue Karten dazu,
   entstehen automatisch neue Level — nichts muss angepasst werden. */
export const PO_LEVELU = 10;
export const PRAG = 2;          // ab 2x richtig gilt eine Karte als gekonnt
export const ISPIT_PITANJA = 30;
export const ISPIT_PRAG = 0.8;  // 80 Prozent zum Bestehen

/* Karten in der Lernreihenfolge: erst nach Thema, dann nach Karten-Nummer */
export function poredak(karte, teme) {
  const red = {};
  teme.forEach((t) => (red[t.id] = t.reihenfolge));
  return [...karte].sort((a, b) => {
    const r = (red[a.thema_id] || 0) - (red[b.thema_id] || 0);
    return r !== 0 ? r : a.id - b.id;
  });
}

/* Baut den Pfad: Level 1 ... Level n, dann die Prüfung. */
export function putanja(karte, teme, napredak, niveau) {
  const svoje = poredak(karte.filter((k) => {
    const t = teme.find((x) => x.id === k.thema_id);
    return (t?.stufe || "A1") === niveau;
  }), teme);

  const znano = {};
  napredak.forEach((n) => (znano[n.karte_id] = n.richtig >= PRAG));

  const razine = [];
  for (let i = 0; i < svoje.length; i += PO_LEVELU) {
    const dio = svoje.slice(i, i + PO_LEVELU);
    const gotovih = dio.filter((k) => znano[k.id]).length;
    razine.push({
      broj: razine.length + 1,
      karte: dio,
      gotovih,
      ukupno: dio.length,
      gotovo: gotovih === dio.length
    });
  }

  const sveGotovo = razine.length > 0 && razine.every((r) => r.gotovo);
  return { razine, sveGotovo, sveKarte: svoje };
}

/* Welches Niveau ist gerade dran */
export function trenutnoNiveau(pruefungen) {
  const red = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const polozeni = new Set(
    (pruefungen || []).filter((p) => p.bestanden).map((p) => p.niveau)
  );
  for (const n of red) if (!polozeni.has(n)) return n;
  return "C2";
}

/* Welche Aufgabenart bekommt diese Karte?
   Je öfter sie saß, desto anspruchsvoller wird sie. */
export function vrstaZadatka(karta, napredakZaKartu) {
  const r = napredakZaKartu?.richtig || 0;
  const clan = /^(der|die|das)\s/i.test(karta.de);
  if (r >= 5 && clan) return "clan";     // nur der/die/das
  if (r >= 3) return "tipkanje";         // selbst schreiben
  return "otkrivanje";                   // aufdecken
}

/* Tippfehler grosszügig behandeln */
export function usporedi(upisano, tocno) {
  const cisto = (s) => s.toLowerCase().trim()
    .replace(/^(der|die|das)\s+/, "")
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ");
  const a = cisto(upisano), b = cisto(tocno);
  if (a === b) return "tocno";

  const blizu = (x, y) => {
    const zamjene = { "ä": "a", "ö": "o", "ü": "u", "ß": "ss" };
    const n = (s) => s.replace(/[äöüß]/g, (c) => zamjene[c]);
    return n(x) === n(y) || razmak(x, y) <= 1;
  };
  return blizu(a, b) ? "skoro" : "netocno";
}

/* Abstand zweier Wörter (wie viele Buchstaben unterscheiden sich) */
function razmak(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[m][n];
}
