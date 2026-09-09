"use client";

/* Ein Level sind 20 Karten. */
export const PO_LEVELU = 20;
export const PRAG = 2;              // ab 2x richtig gilt eine Karte als gekonnt
export const PAUZA_SATI = 2;        // so lange muss zwischen den zwei Treffern liegen

export const ISPIT_SEKCIJA = 20;    // Fragen in einer Abschnittsprüfung
export const ISPIT_VELIKI  = 40;    // Fragen in der grossen Prüfung
export const ISPIT_PRAG    = 0.8;   // 80 Prozent zum Bestehen

/* Wie viele Wörter ein Niveau mindestens braucht, damit die grosse
   Prüfung überhaupt aufgeht. Ohne das wäre "A1 bestanden" nur ein
   Etikett auf einem Drittel des Stoffs. */
export const MIN_RIJECI = { A1: 600, A2: 1300, B1: 2500, B2: 4000, C1: 6000, C2: 8000 };

export const SEKCIJE = [
  { kljuc: "osnove",       ime: "Osnove",         opis: "Pozdravi, brojevi, pitanja, boje" },
  { kljuc: "svakodnevica", ime: "Svakodnevica",   opis: "Obitelj, hrana, dom, put, vrijeme" },
  { kljuc: "posao",        ime: "Posao i život",  opis: "Tijelo, odjeća, posao, učenje" }
];

/* Karten in der Lernreihenfolge */
export function poredak(karte, teme) {
  const red = {};
  teme.forEach((t) => (red[t.id] = t.reihenfolge));
  return [...karte].sort((a, b) => {
    const r = (red[a.thema_id] || 0) - (red[b.thema_id] || 0);
    return r !== 0 ? r : a.id - b.id;
  });
}

/* Nur Karten des aktuellen Niveaus. Alles Höhere bleibt zu. */
export function karteNivoa(karte, teme, niveau) {
  const mojaTema = {};
  teme.forEach((t) => (mojaTema[t.id] = t));
  return karte.filter((k) => (mojaTema[k.thema_id]?.stufe || "A1") === niveau);
}

export function karteSekcije(karte, teme, niveau, sekcija) {
  const mojaTema = {};
  teme.forEach((t) => (mojaTema[t.id] = t));
  return poredak(
    karte.filter((k) => {
      const t = mojaTema[k.thema_id];
      return t && (t.stufe || "A1") === niveau && t.sekcija === sekcija;
    }), teme);
}

/* Der ganze Pfad: Abschnitte mit Leveln, Abschnittsprüfung,
   und ganz am Ende die grosse Prüfung. */
export function staza(karte, teme, napredak, niveau, pruefungen) {
  const znano = {}, muka = {}, zadnjeTocno = {};
  napredak.forEach((n) => {
    znano[n.karte_id] = n.richtig >= PRAG;
    muka[n.karte_id] = (n.falsch || 0) > 0;          // hat Mühe gemacht
    zadnjeTocno[n.karte_id] = n.zadnji_tocan !== false;
  });

  const polozene = new Set(
    (pruefungen || [])
      .filter((p) => p.bestanden && p.niveau === niveau && p.sekcija)
      .map((p) => p.sekcija)
  );

  let prethodnaGotova = true;
  const sekcije = SEKCIJE.map((s) => {
    const karteS = karteSekcije(karte, teme, niveau, s.kljuc);

    const razine = [];
    for (let i = 0; i < karteS.length; i += PO_LEVELU) {
      const dio = karteS.slice(i, i + PO_LEVELU);
      const gotovih = dio.filter((k) => znano[k.id]).length;
      razine.push({
        broj: razine.length + 1,
        karte: dio,
        gotovih,
        ukupno: dio.length,
        gotovo: gotovih === dio.length
      });
    }

    const sveRazine = razine.length > 0 && razine.every((r) => r.gotovo);

    /* Level X: alle Karten dieses Abschnitts, bei denen sie
       schon einmal danebenlag. Es reicht ein sauberer Durchgang. */
    const popravak = karteS.filter((k) => muka[k.id]);
    const popravakGotov = popravak.every((k) => zadnjeTocno[k.id]);
    const popravakOtvoren = sveRazine && !popravakGotov;

    const ispitPolozen = polozene.has(s.kljuc);
    const otvorena = prethodnaGotova;
    prethodnaGotova = ispitPolozen;

    return {
      ...s,
      razine,
      karte: karteS,
      sveRazine,
      popravak,
      popravakGotov,
      popravakOtvoren,
      ispitPolozen,
      ispitOtvoren: sveRazine && popravakGotov && !ispitPolozen,
      otvorena,
      gotovih: razine.filter((r) => r.gotovo).length
    };
  });

  const sveSekcije = sekcije.every((s) => s.ispitPolozen);
  const ukupnoRijeci = karteNivoa(karte, teme, niveau).length;
  const dovoljnoGradiva = ukupnoRijeci >= (MIN_RIJECI[niveau] || 600);

  return {
    sekcije,
    sveSekcije,
    ukupnoRijeci,
    trebaRijeci: MIN_RIJECI[niveau] || 600,
    dovoljnoGradiva,
    velikiIspitOtvoren: sveSekcije && dovoljnoGradiva
  };
}

/* Welches Niveau ist gerade dran — zählt nur die grosse Prüfung */
export function trenutnoNiveau(pruefungen) {
  const red = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const polozeni = new Set(
    (pruefungen || []).filter((p) => p.bestanden && !p.sekcija).map((p) => p.niveau)
  );
  for (const n of red) if (!polozeni.has(n)) return n;
  return "C2";
}

/* Aufgabenart beim Üben */
export function vrstaZadatka(karta, napredakZaKartu) {
  const r = napredakZaKartu?.richtig || 0;
  const clan = /^(der|die|das)\s/i.test(karta.de);
  if (r >= 5 && clan) return "clan";
  if (r >= 3) return "tipkanje";
  return "otkrivanje";
}

/* Aufgabenart in einer Prüfung — gemischt, damit sie nicht
   nur wiedererkennen muss. */
export function vrstaPitanja(karta, indeks, veliki) {
  const clan = /^(der|die|das)\s/i.test(karta.de);
  const uzorak = indeks % 5;
  if (veliki) {
    if (clan && uzorak === 0) return "clan";
    if (uzorak === 1 || uzorak === 3) return "tipkanje";
    return "izbor";
  }
  if (clan && uzorak === 0) return "clan";
  if (uzorak === 2) return "tipkanje";
  return "izbor";
}

/* Tippfehler grosszügig behandeln */
export function usporedi(upisano, tocno) {
  const cisto = (s) => s.toLowerCase().trim()
    .replace(/^(der|die|das)\s+/, "")
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ");
  const a = cisto(upisano), b = cisto(tocno);
  if (a === b) return "tocno";

  const zamjene = { "ä": "a", "ö": "o", "ü": "u", "ß": "ss" };
  const n = (s) => s.replace(/[äöüß]/g, (c) => zamjene[c]);
  return (n(a) === n(b) || razmak(a, b) <= 1) ? "skoro" : "netocno";
}

function razmak(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
