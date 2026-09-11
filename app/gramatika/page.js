"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, akzentSetzen, punkteDazu, vorlesen } from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";

export default function Gramatika() {
  const router = useRouter();
  const [uid, setUid] = useState(null);
  const [lekcije, setLekcije] = useState(null);
  const [procitano, setProcitano] = useState({});
  const [otvorena, setOtvorena] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const id = s.session.user.id;
      setUid(id);

      const [{ data: p }, { data: g }, { data: n }] = await Promise.all([
        supabase.from("profile").select("akzent").eq("user_id", id).maybeSingle(),
        supabase.from("gramatika").select("*").order("reihenfolge"),
        supabase.from("gramatika_napredak").select("*").eq("user_id", id)
      ]);
      akzentSetzen(p?.akzent);
      setLekcije(g || []);

      const mapa = {};
      (n || []).forEach((x) => (mapa[x.gramatika_id] = true));
      setProcitano(mapa);
    })();
  }, [router]);

  async function oznaci(l) {
    if (procitano[l.id]) return;
    await supabase.from("gramatika_napredak")
      .upsert({ user_id: uid, gramatika_id: l.id }, { onConflict: "user_id,gramatika_id" });
    setProcitano({ ...procitano, [l.id]: true });
    punkteDazu(uid, 15);
  }

  if (!lekcije) return null;

  /* ---------- Eine Lektion ---------- */
  if (otvorena) {
    const l = otvorena;
    return (
      <div className="stranica mx-auto max-w-md px-5 pt-6 md:max-w-3xl md:px-8">
        <button onClick={() => setOtvorena(null)} className="text-sm text-tiho">
          ← Sve lekcije
        </button>

        <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
          {l.naslov_hr}
        </h1>
        <p className="mt-3 leading-relaxed text-tekst/90">{l.uvod_hr}</p>

        <div className="mt-6 space-y-4">
          {(l.sadrzaj || []).map((b, i) => {
            if (b.vrsta === "pravilo") {
              return (
                <div key={i} className="ploca p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-akzent">Pravilo</p>
                  <p className="mt-1.5 leading-relaxed">{b.tekst}</p>
                </div>
              );
            }

            if (b.vrsta === "iznimka") {
              return (
                <div key={i} className="rounded-2xl border border-alarm/30 bg-alarm/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-alarm">Pazi</p>
                  <p className="mt-1.5 leading-relaxed">{b.tekst}</p>
                </div>
              );
            }

            if (b.vrsta === "tablica") {
              return (
                <div key={i} className="ploca overflow-hidden p-0">
                  {b.zaglavlje && (
                    <div className="grid grid-cols-2 gap-3 border-b border-rub px-4 py-2">
                      {b.zaglavlje.map((z, n) => (
                        <p key={n} className="text-xs font-medium uppercase tracking-wider text-tiho">
                          {z}
                        </p>
                      ))}
                    </div>
                  )}
                  {b.redovi.map((r, n) => (
                    <div key={n}
                      className={`grid grid-cols-2 gap-3 px-4 py-2.5 ${
                        n % 2 ? "bg-pod/60" : ""}`}>
                      <button onClick={() => vorlesen(r[0].split("—")[0])}
                        className="text-left font-medium leading-snug">
                        {r[0]}
                      </button>
                      <p className="leading-snug text-tiho">{r[1]}</p>
                    </div>
                  ))}
                </div>
              );
            }

            if (b.vrsta === "primjer") {
              return (
                <div key={i} className="ploca flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-akzent">{b.de}</p>
                    <p className="mt-1 text-sm text-tiho">{b.hr}</p>
                  </div>
                  <button onClick={() => vorlesen(b.de)}
                    className="shrink-0 rounded-lg border border-rub px-3 py-1.5 text-xs text-tiho">
                    Slušaj
                  </button>
                </div>
              );
            }
            return null;
          })}
        </div>

        <button
          onClick={() => { oznaci(l); setOtvorena(null); }}
          className={`mt-8 w-full ${procitano[l.id] ? "knopf-leer" : "knopf-voll"}`}>
          {procitano[l.id] ? "Natrag na lekcije" : "Razumijem — dalje"}
        </button>

        <Podnozje />
      </div>
    );
  }

  /* ---------- Liste ---------- */
  const gotovih = Object.keys(procitano).length;

  return (
    <div className="stranica mx-auto max-w-md px-5 pt-8 md:max-w-3xl md:px-8">
      <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>

      <div className="mt-5 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Gramatika</h1>
        <span className="text-xs text-tiho">{gotovih} / {lekcije.length}</span>
      </div>
      <p className="mt-1 text-sm text-tiho">
        Kratka pravila, bez stručnih izraza. Pročitaj ih prije nego što kreneš s karticama —
        puno toga onda odmah ima smisla.
      </p>

      <div className="mt-6 space-y-2">
        {lekcije.map((l, i) => (
          <button key={l.id} onClick={() => setOtvorena(l)}
            className="ploca flex w-full items-center gap-3 p-4 text-left">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
              procitano[l.id] ? "bg-akzent text-white" : "border-2 border-rub text-tiho"}`}>
              {procitano[l.id] ? "✓" : i + 1}
            </span>
            <span className="min-w-0 flex-1 font-medium leading-snug">{l.naslov_hr}</span>
          </button>
        ))}
      </div>

      <Podnozje />
    </div>
  );
}
