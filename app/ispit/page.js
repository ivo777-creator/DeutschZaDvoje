"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, akzentSetzen, punkteDazu, aktivitaetDazu, vorlesen } from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";
import { poredak, trenutnoNiveau, ISPIT_PITANJA, ISPIT_PRAG } from "../../lib/nivoi";

export default function Ispit() {
  const router = useRouter();
  const pocetak = useRef(Date.now());
  const spremljeno = useRef(false);

  const [ja, setJa] = useState(null);
  const [niveau, setNiveau] = useState("A1");
  const [pitanja, setPitanja] = useState(null);
  const [i, setI] = useState(0);
  const [odabrano, setOdabrano] = useState(null);
  const [tocno, setTocno] = useState(0);
  const [gotovo, setGotovo] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;

      const [{ data: p }, { data: teme }, { data: karte }, { data: isp }] = await Promise.all([
        supabase.from("profile").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("themen").select("*").order("reihenfolge"),
        supabase.from("karten").select("*"),
        supabase.from("pruefungen").select("*").eq("user_id", uid)
      ]);

      setJa(p || { user_id: uid, name: "" });
      akzentSetzen(p?.akzent);
      const n = trenutnoNiveau(isp);
      setNiveau(n);

      const pool = poredak(
        (karte || []).filter((k) => {
          const t = (teme || []).find((x) => x.id === k.thema_id);
          return (t?.stufe || "A1") === n;
        }), teme || []);

      const izbor = [...pool].sort(() => Math.random() - 0.5).slice(0, ISPIT_PITANJA);

      setPitanja(izbor.map((k) => {
        const krivi = pool.filter((x) => x.id !== k.id)
          .sort(() => Math.random() - 0.5).slice(0, 3).map((x) => x.de);
        return {
          karta: k,
          opcije: [k.de, ...krivi].sort(() => Math.random() - 0.5)
        };
      }));
    })();
  }, [router]);

  function odgovori(opcija) {
    if (odabrano) return;
    setOdabrano(opcija);
    const je = opcija === pitanja[i].karta.de;
    if (je) setTocno((n) => n + 1);
    vorlesen(pitanja[i].karta.de);

    setTimeout(() => {
      if (i + 1 >= pitanja.length) zavrsi(tocno + (je ? 1 : 0));
      else { setI(i + 1); setOdabrano(null); }
    }, 1100);
  }

  async function zavrsi(konacno) {
    if (spremljeno.current) return;
    spremljeno.current = true;
    const proslo = konacno / pitanja.length >= ISPIT_PRAG;

    await supabase.from("pruefungen").insert({
      user_id: ja.user_id, niveau,
      richtig: konacno, gesamt: pitanja.length, bestanden: proslo
    });
    await punkteDazu(ja.user_id, proslo ? 300 : 50);
    await aktivitaetDazu(ja.user_id, pitanja.length,
      Math.round((Date.now() - pocetak.current) / 1000));

    setTocno(konacno);
    setGotovo(true);
  }

  if (!pitanja) return null;

  /* ---------- Ergebnis ---------- */
  if (gotovo) {
    const proslo = tocno / pitanja.length >= ISPIT_PRAG;
    const postotak = Math.round((tocno / pitanja.length) * 100);

    if (!proslo) {
      return (
        <div className="ekran items-center justify-center px-6 text-center">
          <p className="text-6xl font-semibold tracking-tight">{postotak}%</p>
          <p className="mt-3 text-tiho">
            {tocno} od {pitanja.length}. Za prolaz treba 80%.
          </p>
          <p className="mt-6 max-w-xs text-sm text-tiho">
            Nije prošlo, ali blizu je. Ponovi kartice koje te čekaju i probaj opet —
            ispit se može ponavljati koliko god puta želiš.
          </p>
          <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
            Natrag na početnu
          </button>
          <Podnozje />
        </div>
      );
    }

    return (
      <div className="ekran items-center justify-center overflow-hidden px-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 40 }).map((_, n) => (
            <span key={n} className="konfeti"
              style={{
                left: `${(n * 37) % 100}%`,
                animationDelay: `${(n % 10) * 0.18}s`,
                background: ["#E8A33D", "#C9718E", "#4A6FA5", "#528A76"][n % 4]
              }} />
          ))}
        </div>

        <p className="slavlje text-5xl font-semibold tracking-tight">Bravo!</p>
        <p className="mt-2 text-tiho">Položila si {niveau}.</p>

        <div className="ploca mt-8 w-full max-w-sm p-6">
          <p className="text-xs uppercase tracking-widest text-tiho">Potvrda</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-akzent">{niveau}</p>
          <p className="mt-3 text-lg font-medium">{ja?.name}</p>
          <p className="mt-1 text-sm text-tiho">
            {tocno} od {pitanja.length} točno · {postotak}%
          </p>
          <p className="mt-4 border-t border-rub pt-3 text-xs text-tiho">
            {new Date().toLocaleDateString("hr-HR")} · Deutsch za dvoje
          </p>
        </div>

        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          Dalje na sljedeći nivo
        </button>
        <Podnozje />
      </div>
    );
  }

  /* ---------- Laufende Prüfung ---------- */
  const p = pitanja[i];

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Ispit {niveau}</p>
          <p className="text-sm text-tiho">{i + 1} / {pitanja.length}</p>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ploha">
          <div className="h-full rounded-full bg-akzent transition-all"
               style={{ width: `${((i + 1) / pitanja.length) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl">
        <p className="text-sm text-tiho">Kako se kaže?</p>
        <p className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {p.karta.hr}
        </p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-2 md:max-w-2xl">
        {p.opcije.map((o) => {
          const je = o === p.karta.de;
          const boja = !odabrano ? "ploca"
            : je ? "border border-akzent bg-akzent/10"
            : o === odabrano ? "border border-alarm/40 bg-alarm/10" : "ploca opacity-50";
          return (
            <button key={o} onClick={() => odgovori(o)} disabled={!!odabrano}
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
