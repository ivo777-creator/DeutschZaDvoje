"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  supabase, akzentSetzen, punkteDazu, aktivitaetDazu, vorlesen, TEZINA
} from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";
import { karteNivoa, trenutnoNiveau } from "../../lib/nivoi";

/* ============================================================
   Gemeinsame Helfer
   ============================================================ */
function izmijesaj(niz) {
  return [...niz].sort(() => Math.random() - 0.5);
}

function pitanjaOd(pool, koliko) {
  return izmijesaj(pool).slice(0, koliko).map((k) => {
    const krivi = izmijesaj(pool.filter((x) => x.id !== k.id)).slice(0, 2).map((x) => x.de);
    return { karta: k, opcije: izmijesaj([k.de, ...krivi]) };
  });
}

/* ============================================================
   Hauptseite
   ============================================================ */
export default function Igre() {
  const router = useRouter();
  const [uid, setUid] = useState(null);
  const [karte, setKarte] = useState([]);
  const [igra, setIgra] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      setUid(s.session.user.id);

      const [{ data: p }, { data: k }, { data: teme }, { data: isp }] = await Promise.all([
        supabase.from("profile").select("akzent").eq("user_id", s.session.user.id).maybeSingle(),
        supabase.from("karten").select("*"),
        supabase.from("themen").select("*"),
        supabase.from("pruefungen").select("*").eq("user_id", s.session.user.id)
      ]);
      akzentSetzen(p?.akzent);
      // Spiele ziehen nur aus dem Niveau, das gerade dran ist
      setKarte(karteNivoa(k || [], teme || [], trenutnoNiveau(isp)));
    })();
  }, [router]);

  if (!uid || !karte.length) return null;

  if (igra === "brzina")  return <Brzina uid={uid} karte={karte} natrag={() => setIgra(null)} />;
  if (igra === "parovi")  return <Parovi uid={uid} karte={karte} natrag={() => setIgra(null)} />;
  if (igra === "dvoboj")  return <Dvoboj uid={uid} karte={karte} natrag={() => setIgra(null)} />;

  return (
    <div className="stranica mx-auto max-w-md px-5 pt-8 md:max-w-3xl md:px-8">
      <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Igre</h1>
      <p className="mt-1 text-sm text-tiho">
        Kraće i brže od učenja, ali se svejedno broji u napredak.
      </p>

      <div className="mt-6 space-y-3 md:grid md:grid-cols-3 md:gap-3 md:space-y-0">
        <button onClick={() => setIgra("brzina")} className="ploca w-full p-5 text-left">
          <p className="text-lg font-semibold tracking-tight">Brzina</p>
          <p className="mt-1 text-sm text-tiho">
            60 sekundi, koliko riječi stigneš. Sama.
          </p>
        </button>

        <button onClick={() => setIgra("parovi")} className="ploca w-full p-5 text-left">
          <p className="text-lg font-semibold tracking-tight">Parovi</p>
          <p className="mt-1 text-sm text-tiho">
            Spoji njemačku i hrvatsku riječ. Sama.
          </p>
        </button>

        <button onClick={() => setIgra("dvoboj")} className="ploca w-full p-5 text-left">
          <p className="text-lg font-semibold tracking-tight">Dvoboj</p>
          <p className="mt-1 text-sm text-tiho">
            Ista pitanja za oboje. Tko ima više točnih i brže.
          </p>
        </button>
      </div>

      <Podnozje />
    </div>
  );
}

/* ============================================================
   1) Brzina — 60 Sekunden
   ============================================================ */
function Brzina({ uid, karte, natrag }) {
  const [pitanja] = useState(() => pitanjaOd(karte, 60));
  const [i, setI] = useState(0);
  const [tocno, setTocno] = useState(0);
  const [odabrano, setOdabrano] = useState(null);
  const [sekunde, setSekunde] = useState(60);
  const spremljeno = useRef(false);

  useEffect(() => {
    if (sekunde <= 0) return;
    const t = setTimeout(() => setSekunde((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sekunde]);

  useEffect(() => {
    if (sekunde === 0 && !spremljeno.current) {
      spremljeno.current = true;
      punkteDazu(uid, tocno * 3);
      aktivitaetDazu(uid, i, 60, i * TEZINA.igra);
    }
  }, [sekunde, uid, tocno, i]);

  if (sekunde === 0) {
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-6xl font-semibold tracking-tight">{tocno}</p>
        <p className="mt-2 text-tiho">točnih od {i} u 60 sekundi</p>
        <p className="mt-1 text-sm text-tiho">+{tocno * 3} bodova</p>
        <button onClick={natrag} className="knopf-voll mt-8">Natrag na igre</button>
        <Podnozje />
      </div>
    );
  }

  const p = pitanja[i];

  function odgovori(o) {
    if (odabrano) return;
    const je = o === p.karta.de;
    setOdabrano(o);
    if (je) setTocno((n) => n + 1);
    setTimeout(() => { setOdabrano(null); setI((n) => n + 1); }, 320);
  }

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <button onClick={natrag} className="text-sm text-tiho">← Prekini</button>
          <span className={`text-lg font-semibold tabular-nums ${
            sekunde <= 10 ? "text-alarm" : ""}`}>{sekunde}s</span>
          <span className="text-sm text-tiho">{tocno} točnih</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ploha">
          <div className="h-full rounded-full bg-akzent transition-all"
               style={{ width: `${(sekunde / 60) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl">
        <p className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {p.karta.hr}
        </p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-2 md:max-w-2xl">
        {p.opcije.map((o) => {
          const je = o === p.karta.de;
          const boja = !odabrano ? "ploca"
            : je ? "border border-akzent bg-akzent/15"
            : o === odabrano ? "border border-alarm/40 bg-alarm/10" : "ploca opacity-40";
          return (
            <button key={o} onClick={() => odgovori(o)}
              className={`w-full rounded-2xl p-4 text-left font-medium ${boja}`}>
              {o}
            </button>
          );
        })}
        <Podnozje />
      </div>
    </div>
  );
}

/* ============================================================
   2) Parovi — Deutsch zu Kroatisch
   ============================================================ */
function Parovi({ uid, karte, natrag }) {
  const [plocice] = useState(() => {
    const par = izmijesaj(karte).slice(0, 6);
    return izmijesaj(par.flatMap((k) => ([
      { kljuc: `de-${k.id}`, par: k.id, tekst: k.de, jezik: "de" },
      { kljuc: `hr-${k.id}`, par: k.id, tekst: k.hr, jezik: "hr" }
    ])));
  });

  const [okrenuto, setOkrenuto] = useState([]);
  const [nadeno, setNadeno] = useState([]);
  const [pokusaji, setPokusaji] = useState(0);
  const pocetak = useRef(Date.now());
  const spremljeno = useRef(false);

  const gotovo = nadeno.length === 6;

  useEffect(() => {
    if (gotovo && !spremljeno.current) {
      spremljeno.current = true;
      punkteDazu(uid, 40);
      aktivitaetDazu(uid, 6, Math.round((Date.now() - pocetak.current) / 1000),
        6 * TEZINA.igra);
    }
  }, [gotovo, uid]);

  function klik(p) {
    if (nadeno.includes(p.par) || okrenuto.find((x) => x.kljuc === p.kljuc)) return;
    if (okrenuto.length === 2) return;

    const novo = [...okrenuto, p];
    setOkrenuto(novo);

    if (novo.length === 2) {
      setPokusaji((n) => n + 1);
      if (novo[0].par === novo[1].par) {
        const njem = novo.find((x) => x.jezik === "de");
        vorlesen(njem.tekst);
        setTimeout(() => { setNadeno((n) => [...n, novo[0].par]); setOkrenuto([]); }, 500);
      } else {
        setTimeout(() => setOkrenuto([]), 800);
      }
    }
  }

  if (gotovo) {
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-5xl font-semibold tracking-tight">Svih 6!</p>
        <p className="mt-2 text-tiho">{pokusaji} pokušaja · +40 bodova</p>
        <button onClick={natrag} className="knopf-voll mt-8">Natrag na igre</button>
        <Podnozje />
      </div>
    );
  }

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <button onClick={natrag} className="text-sm text-tiho">← Prekini</button>
          <span className="text-sm text-tiho">{nadeno.length} / 6</span>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-md min-h-0 flex-1 grid-cols-3 content-center
                      gap-2 overflow-y-auto py-6 md:max-w-2xl md:gap-3">
        {plocice.map((p) => {
          const vidljivo = nadeno.includes(p.par) || okrenuto.find((x) => x.kljuc === p.kljuc);
          const rijeseno = nadeno.includes(p.par);
          return (
            <button key={p.kljuc} onClick={() => klik(p)}
              className={`flex min-h-[5.5rem] items-center justify-center rounded-2xl p-2
                          text-center text-sm font-medium transition ${
                rijeseno ? "border border-akzent bg-akzent/15 text-akzent"
                : vidljivo ? "ploca"
                : "bg-akzent/10 text-transparent"}`}>
              {vidljivo ? p.tekst : "?"}
            </button>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-md md:max-w-2xl">
        <p className="text-center text-sm text-tiho">
          Spoji njemačku riječ s hrvatskom.
        </p>
        <Podnozje />
      </div>
    </div>
  );
}

/* ============================================================
   3) Dvoboj — beide dieselben Fragen
   ============================================================ */
function Dvoboj({ uid, karte, natrag }) {
  const [dvoboj, setDvoboj] = useState(null);
  const [ucitano, setUcitano] = useState(false);
  const [pitanja, setPitanja] = useState([]);
  const [i, setI] = useState(0);
  const [tocno, setTocno] = useState(0);
  const [odabrano, setOdabrano] = useState(null);
  const [poslano, setPoslano] = useState(false);
  const pocetak = useRef(null);
  const spremljeno = useRef(false);

  const jaSam1 = dvoboj?.igrac1 === uid;

  const pripremi = useCallback((d) => {
    setDvoboj(d);
    if (d?.karten_ids?.length) {
      const mapa = {};
      karte.forEach((k) => (mapa[k.id] = k));
      const pool = d.karten_ids.map((id) => mapa[id]).filter(Boolean);
      setPitanja(pool.map((k) => {
        const krivi = izmijesaj(karte.filter((x) => x.id !== k.id)).slice(0, 2).map((x) => x.de);
        return { karta: k, opcije: izmijesaj([k.de, ...krivi]) };
      }));
    }
  }, [karte]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("dvoboji").select("*")
        .neq("status", "gotovo").order("stvoreno", { ascending: false }).limit(1);
      if (data?.[0]) pripremi(data[0]);
      setUcitano(true);
    })();
  }, [pripremi]);

  useEffect(() => {
    const kanal = supabase.channel("dvoboji-uzivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "dvoboji" },
        (p) => { if (!dvoboj || p.new?.id === dvoboj.id) pripremi(p.new); })
      .subscribe();
    return () => { supabase.removeChannel(kanal); };
  }, [dvoboj, pripremi]);

  async function stvori() {
    const ids = izmijesaj(karte).slice(0, 10).map((k) => k.id);
    const { data } = await supabase.from("dvoboji")
      .insert({ igrac1: uid, karten_ids: ids, status: "ceka" }).select().single();
    if (data) pripremi(data);
  }

  async function pridruzi() {
    const { data } = await supabase.from("dvoboji")
      .update({ igrac2: uid, status: "igra" }).eq("id", dvoboj.id).select().single();
    if (data) pripremi(data);
  }

  async function posalji(konacno) {
    if (spremljeno.current) return;
    spremljeno.current = true;
    const sek = Math.round((Date.now() - pocetak.current) / 1000);

    const izmjena = jaSam1
      ? { rez1: konacno, vrijeme1: sek }
      : { rez2: konacno, vrijeme2: sek };

    const drugiGotov = jaSam1 ? dvoboj.rez2 !== null : dvoboj.rez1 !== null;
    if (drugiGotov) izmjena.status = "gotovo";

    const { data } = await supabase.from("dvoboji")
      .update(izmjena).eq("id", dvoboj.id).select().single();
    if (data) setDvoboj(data);

    punkteDazu(uid, konacno * 5);
    aktivitaetDazu(uid, pitanja.length, sek, pitanja.length * TEZINA.igra);
    setPoslano(true);
  }

  if (!ucitano) return null;

  /* --- Kein Duell offen --- */
  if (!dvoboj) {
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-3xl font-semibold tracking-tight">Dvoboj</p>
        <p className="mt-2 max-w-xs text-tiho">
          Deset istih pitanja za oboje. Pobjeđuje tko ima više točnih —
          kod izjednačenja odlučuje vrijeme.
        </p>
        <button onClick={stvori} className="knopf-voll mt-8">Pozovi na dvoboj</button>
        <button onClick={natrag} className="mt-4 text-sm text-tiho">Natrag</button>
        <Podnozje />
      </div>
    );
  }

  /* --- Wartet auf den Gegner --- */
  if (dvoboj.status === "ceka") {
    if (dvoboj.igrac1 === uid) {
      return (
        <div className="ekran items-center justify-center px-6 text-center">
          <p className="text-3xl font-semibold tracking-tight">Čeka se protivnik</p>
          <p className="mt-2 text-tiho">Poziv je poslan. Stranica se sama pokrene.</p>
          <button onClick={natrag} className="mt-8 text-sm text-tiho">Natrag</button>
          <Podnozje />
        </div>
      );
    }
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-3xl font-semibold tracking-tight">Pozvana si na dvoboj</p>
        <p className="mt-2 text-tiho">Deset pitanja, ista za oboje.</p>
        <button onClick={pridruzi} className="knopf-voll mt-8">Prihvati</button>
        <button onClick={natrag} className="mt-4 text-sm text-tiho">Kasnije</button>
        <Podnozje />
      </div>
    );
  }

  /* --- Ergebnis --- */
  const mojRez = jaSam1 ? dvoboj.rez1 : dvoboj.rez2;
  const njegovRez = jaSam1 ? dvoboj.rez2 : dvoboj.rez1;

  if (poslano || mojRez !== null) {
    if (njegovRez === null) {
      return (
        <div className="ekran items-center justify-center px-6 text-center">
          <p className="text-5xl font-semibold tracking-tight">{mojRez} / {pitanja.length}</p>
          <p className="mt-3 text-tiho">Sada se čeka drugi igrač.</p>
          <button onClick={natrag} className="knopf-voll mt-8">Natrag na igre</button>
          <Podnozje />
        </div>
      );
    }

    const mojeVrijeme = jaSam1 ? dvoboj.vrijeme1 : dvoboj.vrijeme2;
    const njegovoVrijeme = jaSam1 ? dvoboj.vrijeme2 : dvoboj.vrijeme1;
    const pobjeda = mojRez > njegovRez ||
      (mojRez === njegovRez && mojeVrijeme < njegovoVrijeme);
    const neodluceno = mojRez === njegovRez && mojeVrijeme === njegovoVrijeme;

    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-5xl font-semibold tracking-tight">
          {neodluceno ? "Neriješeno" : pobjeda ? "Pobjeda!" : "Ovaj put ne"}
        </p>
        <div className="ploca mt-8 w-full max-w-xs p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-tiho">Ti</span>
            <span className="font-semibold">{mojRez} · {mojeVrijeme}s</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-rub pt-3">
            <span className="text-sm text-tiho">Protivnik</span>
            <span className="font-semibold">{njegovRez} · {njegovoVrijeme}s</span>
          </div>
        </div>
        <button onClick={natrag} className="knopf-voll mt-8">Natrag na igre</button>
        <Podnozje />
      </div>
    );
  }

  /* --- Laufendes Duell --- */
  if (!pitanja.length) return null;
  if (pocetak.current === null) pocetak.current = Date.now();
  const p = pitanja[i];

  function odgovori(o) {
    if (odabrano) return;
    const je = o === p.karta.de;
    setOdabrano(o);
    const novi = tocno + (je ? 1 : 0);
    if (je) setTocno(novi);
    setTimeout(() => {
      if (i + 1 >= pitanja.length) posalji(novi);
      else { setOdabrano(null); setI(i + 1); }
    }, 400);
  }

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Dvoboj</span>
          <span className="text-sm text-tiho">{i + 1} / {pitanja.length}</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ploha">
          <div className="h-full rounded-full bg-akzent transition-all"
               style={{ width: `${((i + 1) / pitanja.length) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl">
        <p className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {p.karta.hr}
        </p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-2 md:max-w-2xl">
        {p.opcije.map((o) => {
          const je = o === p.karta.de;
          const boja = !odabrano ? "ploca"
            : je ? "border border-akzent bg-akzent/15"
            : o === odabrano ? "border border-alarm/40 bg-alarm/10" : "ploca opacity-40";
          return (
            <button key={o} onClick={() => odgovori(o)}
              className={`w-full rounded-2xl p-4 text-left font-medium ${boja}`}>
              {o}
            </button>
          );
        })}
        <Podnozje />
      </div>
    </div>
  );
}
