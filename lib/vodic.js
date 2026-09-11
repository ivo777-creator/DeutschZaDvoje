"use client";

import { useState } from "react";

/* Einführung beim ersten Start. Alles auf Kroatisch,
   kurze Sätze, ein Gedanke pro Bildschirm. */
const KORACI = [
  {
    naslov: "Dobrodošla!",
    tekst: "Hallo-Bok je tvoja aplikacija za učenje njemačkog. Sve je na hrvatskom, samo su riječi koje učiš na njemačkom.",
    savjet: "Uči kad ti paše — 10 minuta dnevno je dovoljno."
  },
  {
    naslov: "Put do A1",
    tekst: "Gradivo je podijeljeno na tri dijela. Svaki dio ima nekoliko razina, a svaka razina 20 kartica.",
    savjet: "Sljedeći dio se otvara tek kad položiš ispit iz prethodnog."
  },
  {
    naslov: "Kartica mora sjesti dvaput",
    tekst: "Kad neku riječ znaš prvi put, kružić se djelomično oboji. Ista kartica vrati se za dva sata. Znaš je i tada — kružić je pun.",
    savjet: "Zato razina ne postane plava odmah. To nije greška."
  },
  {
    naslov: "Gramatika",
    tekst: "Na vrhu puta stoji Gramatika — devet kratkih lekcija. Članovi der/die/das, glagoli sein i haben, nastavci, red riječi.",
    savjet: "Pročitaj ih prije kartica. Puno toga onda odmah ima smisla."
  },
  {
    naslov: "Razina X i ispit",
    tekst: "Riječi koje su ti zadavale muke skupljaju se u razini X. Kad je i nju prođeš, otvara se ispit tog dijela.",
    savjet: "Ispit je 20 pitanja, za prolaz treba 80 posto. Može se ponavljati koliko god puta."
  },
  {
    naslov: "Ne samo kartice",
    tekst: "U Pisanju sama pišeš rečenicu i dobiješ ispravak s objašnjenjem. U Razgovoru vodiš kratki dijalog — u trgovini, na recepciji, kod liječnika.",
    savjet: "Svaku njemačku riječ možeš čuti — pritisni Slušaj."
  },
  {
    naslov: "Zajedno s Ivom",
    tekst: "Kad Ivo pokrene Zajednički sat, tvoj ekran se sam otvori. On vidi rješenje, ti prvo pokušaj naglas.",
    savjet: "U Igrama ga možeš izazvati na dvoboj."
  }
];

export function Vodic({ onKraj }) {
  const [i, setI] = useState(0);
  const k = KORACI[i];
  const zadnji = i === KORACI.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-pod px-6"
         style={{ paddingTop: "max(env(safe-area-inset-top), 2rem)",
                  paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-lg">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {KORACI.map((_, n) => (
              <span key={n} className={`h-1.5 w-6 rounded-full transition ${
                n <= i ? "bg-akzent" : "bg-rub"}`} />
            ))}
          </div>
          <button onClick={onKraj} className="text-sm text-tiho">Preskoči</button>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {k.naslov}
          </p>
          <p className="mt-4 text-lg leading-relaxed text-tekst/90">{k.tekst}</p>
          <p className="mt-6 rounded-xl border border-rub bg-ploha p-4 text-sm text-tiho">
            {k.savjet}
          </p>
        </div>

        <div className="flex gap-3">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="knopf-leer flex-1">Natrag</button>
          )}
          <button onClick={() => (zadnji ? onKraj() : setI(i + 1))}
            className="knopf-voll flex-[2]">
            {zadnji ? "Krenimo!" : "Dalje"}
          </button>
        </div>
      </div>
    </div>
  );
}
