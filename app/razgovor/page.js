"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, akzentSetzen, punkteDazu, aktivitaetDazu, vorlesen } from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";

const SCENE = [
  { id: "trgovina",  ime: "U supermarketu",   opis: "Kupuješ namirnice" },
  { id: "restoran",  ime: "U restoranu",      opis: "Naručuješ jelo i piće" },
  { id: "recepcija", ime: "Recepcija hotela", opis: "Prijavljuješ se u sobu" },
  { id: "ured",      ime: "U uredu",          opis: "Razgovor s kolegom" },
  { id: "radionica", ime: "Auto-radionica",   opis: "Auto ti ne radi" },
  { id: "policija",  ime: "Policijska kontrola", opis: "Zaustavili su te u prometu" },
  { id: "cvijece",   ime: "Cvjećarnica",      opis: "Kupuješ buket" },
  { id: "lijecnik",  ime: "Kod liječnika",    opis: "Objašnjavaš što te muči" }
];

export default function Razgovor() {
  const router = useRouter();
  const kraj = useRef(null);
  const pocetak = useRef(Date.now());

  const [uid, setUid] = useState(null);
  const [scena, setScena] = useState(null);
  const [poruke, setPoruke] = useState([]);
  const [upis, setUpis] = useState("");
  const [radi, setRadi] = useState(false);
  const [prijevod, setPrijevod] = useState({});

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      setUid(s.session.user.id);
      const { data: p } = await supabase.from("profile")
        .select("akzent").eq("user_id", s.session.user.id).maybeSingle();
      akzentSetzen(p?.akzent);
    })();
  }, [router]);

  useEffect(() => { kraj.current?.scrollIntoView({ behavior: "smooth" }); }, [poruke, radi]);

  async function zovi(povijest) {
    setRadi(true);
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nacin: "razgovor", situacija: scena.id, povijest })
      });
      const d = await r.json();
      if (d.tekst) {
        setPoruke([...povijest, { od: "on", tekst: d.tekst }]);
        vorlesen(d.tekst);
      }
    } catch {}
    setRadi(false);
  }

  async function pokreni(s) {
    setScena(s);
    setPoruke([]);
    setTimeout(() => zoviPrvi(s), 50);
  }

  async function zoviPrvi(s) {
    setRadi(true);
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nacin: "razgovor", situacija: s.id, povijest: [] })
      });
      const d = await r.json();
      if (d.tekst) { setPoruke([{ od: "on", tekst: d.tekst }]); vorlesen(d.tekst); }
    } catch {}
    setRadi(false);
  }

  async function posalji() {
    if (!upis.trim() || radi) return;
    const nova = [...poruke, { od: "ja", tekst: upis.trim() }];
    setPoruke(nova);
    setUpis("");
    await zovi(nova);
  }

  async function prevedi(idx, tekst) {
    if (prijevod[idx]) return setPrijevod({ ...prijevod, [idx]: null });
    const r = await fetch("/api/claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nacin: "prijevod", tekst })
    });
    const d = await r.json();
    setPrijevod({ ...prijevod, [idx]: d.tekst || "—" });
  }

  function zavrsi() {
    if (uid && poruke.length > 1) {
      punkteDazu(uid, Math.min(poruke.length * 5, 100));
      aktivitaetDazu(uid, poruke.filter((p) => p.od === "ja").length,
        Math.round((Date.now() - pocetak.current) / 1000));
    }
    router.push("/start");
  }

  /* ---------- Auswahl ---------- */
  if (!scena) {
    return (
      <div className="stranica mx-auto max-w-md px-5 pt-8 md:max-w-3xl md:px-8">
        <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Razgovor</h1>
        <p className="mt-1 text-sm text-tiho">
          Odaberi situaciju. Piše se na njemačkom, jednostavno.
        </p>
        <div className="mt-6 space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {SCENE.map((s) => (
            <button key={s.id} onClick={() => pokreni(s)} className="ploca w-full p-4 text-left">
              <span className="block font-medium">{s.ime}</span>
              <span className="block text-sm text-tiho">{s.opis}</span>
            </button>
          ))}
        </div>
        <Podnozje />
      </div>
    );
  }

  /* ---------- Chat ---------- */
  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <button onClick={() => setScena(null)} className="text-sm text-tiho">← Situacije</button>
          <span className="text-sm font-medium">{scena.ime}</span>
          <button onClick={zavrsi} className="text-sm text-akzent">Gotovo</button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md min-h-0 flex-1 space-y-3 overflow-y-auto py-6 md:max-w-2xl">
        {poruke.map((p, idx) => (
          <div key={idx} className={p.od === "ja" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              p.od === "ja" ? "bg-akzent text-white" : "ploca"}`}>
              <p>{p.tekst}</p>
              {p.od === "on" && (
                <div className="mt-2 flex gap-3">
                  <button onClick={() => vorlesen(p.tekst)} className="text-xs text-tiho">Slušaj</button>
                  <button onClick={() => prevedi(idx, p.tekst)} className="text-xs text-tiho">
                    {prijevod[idx] ? "Sakrij" : "Prevedi"}
                  </button>
                </div>
              )}
              {prijevod[idx] && <p className="mt-2 text-sm italic text-tiho">{prijevod[idx]}</p>}
            </div>
          </div>
        ))}
        {radi && <p className="text-sm text-tiho">piše...</p>}
        <div ref={kraj} />
      </div>

      <div className="mx-auto w-full max-w-md md:max-w-2xl">
        <div className="flex gap-2">
          <input value={upis} onChange={(e) => setUpis(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && posalji()}
            placeholder="Odgovori na njemačkom" autoCapitalize="sentences"
            className="polje flex-1" />
          <button onClick={posalji} disabled={radi || !upis.trim()}
            className="knopf-voll shrink-0 disabled:opacity-40">Pošalji</button>
        </div>
        <Podnozje />
      </div>
    </div>
  );
}
