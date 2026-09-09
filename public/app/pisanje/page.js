"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, akzentSetzen, punkteDazu, aktivitaetDazu, vorlesen, TEZINA } from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";

/* Feste Aufträge — kosten nichts und sind auf A1 zugeschnitten. */
const ZADACI = [
  "Pozdravi nekoga ujutro i pitaj kako je.",
  "Reci kako se zoveš i odakle si.",
  "Naruči kavu i vodu.",
  "Reci koliko je sati (npr. 15:30).",
  "Reci da si gladna i da želiš juhu.",
  "Pitaj gdje je kolodvor.",
  "Reci da imaš brata i sestru.",
  "Pitaj koliko nešto košta.",
  "Reci da učiš njemački i da ti je teško.",
  "Reci u koliko sati ustaješ.",
  "Pitaj nekoga govori li engleski.",
  "Reci da danas radiš do 18 sati.",
  "Zamoli za račun u restoranu.",
  "Reci da ti se ne sviđa hladno vrijeme.",
  "Pitaj gdje je toalet.",
  "Reci da živiš u Zagrebu i da ti je stan malen.",
  "Objasni da ne razumiješ i zamoli da se ponovi.",
  "Reci što si jela za doručak.",
  "Pitaj kolegu kakav mu je bio vikend.",
  "Reci da sutra imaš slobodan dan."
];

export default function Pisanje() {
  const router = useRouter();
  const pocetak = useRef(Date.now());

  const [uid, setUid] = useState(null);
  const [zadatak, setZadatak] = useState("");
  const [tekst, setTekst] = useState("");
  const [radi, setRadi] = useState(false);
  const [rez, setRez] = useState(null);
  const [broj, setBroj] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      setUid(s.session.user.id);
      const { data: p } = await supabase.from("profile")
        .select("akzent").eq("user_id", s.session.user.id).maybeSingle();
      akzentSetzen(p?.akzent);
      setZadatak(ZADACI[Math.floor(Math.random() * ZADACI.length)]);
    })();
  }, [router]);

  async function posalji() {
    if (!tekst.trim()) return;
    setRadi(true);
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nacin: "ispravak", zadatak, tekst })
      });
      const d = await r.json();
      if (d.greska) setRez({ greska: d.greska });
      else {
        setRez(d);
        vorlesen(d.ispravak);
      }
    } catch {
      setRez({ greska: "Nema veze sa serverom." });
    }
    setRadi(false);
  }

  function sljedeci() {
    const n = broj + 1;
    setBroj(n);
    if (uid) {
      punkteDazu(uid, 10);
      aktivitaetDazu(uid, 1, Math.round((Date.now() - pocetak.current) / 1000), TEZINA.recenica);
      pocetak.current = Date.now();
    }
    setRez(null);
    setTekst("");
    let novi = zadatak;
    while (novi === zadatak) novi = ZADACI[Math.floor(Math.random() * ZADACI.length)];
    setZadatak(novi);
  }

  const boja = rez?.ocjena === "pokusaj_ponovno"
    ? "border border-alarm/30 bg-alarm/10" : "ploca";

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>
          <span className="text-xs text-tiho">Slobodno pisanje · {broj}</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl">
        <p className="text-sm text-tiho">Napiši na njemačkom</p>
        <p className="mt-2 text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
          {zadatak}
        </p>

        {!rez && (
          <textarea rows={3} value={tekst} onChange={(e) => setTekst(e.target.value)}
            placeholder="Piši ovdje..." autoCapitalize="sentences"
            className="polje mt-6 resize-none text-lg" />
        )}

        {rez?.greska && (
          <div className="mt-6 rounded-2xl border border-alarm/30 bg-alarm/10 p-4 text-sm">
            {rez.greska}
          </div>
        )}

        {rez && !rez.greska && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-rub bg-pod p-4">
              <p className="text-xs text-tiho">Napisala si</p>
              <p className="mt-1">{tekst}</p>
            </div>

            <div className={`rounded-2xl p-5 ${boja}`}>
              <p className="text-xs text-tiho">Ispravljeno</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="text-xl font-semibold tracking-tight text-akzent">{rez.ispravak}</p>
                <button onClick={() => vorlesen(rez.ispravak)}
                  className="shrink-0 rounded-lg border border-rub px-3 py-2 text-sm text-tiho">
                  Slušaj
                </button>
              </div>
              <p className="mt-3 text-sm text-tiho">{rez.objasnjenje}</p>
              {rez.pohvala && <p className="mt-2 text-sm font-medium">{rez.pohvala}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md md:max-w-2xl">
        {!rez ? (
          <button onClick={posalji} disabled={radi || !tekst.trim()}
            className="knopf-voll w-full disabled:opacity-40">
            {radi ? "Provjeravam..." : "Provjeri"}
          </button>
        ) : (
          <button onClick={sljedeci} className="knopf-voll w-full">Sljedeći zadatak</button>
        )}
        <Podnozje />
      </div>
    </div>
  );
}
