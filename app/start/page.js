"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Start() {
  const router = useRouter();
  const [ja, setJa] = useState(null);       // mein Profil
  const [bodovi, setBodovi] = useState(null);
  const [teme, setTeme] = useState([]);
  const [zivaSesija, setZivaSesija] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;

      const [{ data: p }, { data: b }, { data: t }, { data: ses }] = await Promise.all([
        supabase.from("profile").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("punkte").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("themen").select("*").order("reihenfolge"),
        supabase.from("sessions").select("id").eq("status", "offen").limit(1)
      ]);

      setJa(p || { user_id: uid, name: "", rolle: "schueler" });
      setBodovi(b || { xp: 0, level: 1, serie_tage: 0, diese_woche: 0, wochenziel: 5 });
      setTeme(t || []);
      setZivaSesija(ses?.[0]?.id ?? null);
    })();
  }, [router]);

  if (!ja) return null;

  const napredak = Math.min(100, ((bodovi.xp % 200) / 200) * 100);

  return (
    <main className="mx-auto max-w-md px-6 pb-16 pt-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl text-tinta">
          Bok{ja.name ? `, ${ja.name}` : ""}
        </h1>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}
          className="text-sm text-tinta/50 underline"
        >
          Odjava
        </button>
      </div>

      {/* Punktestand */}
      <section className="mt-6 rounded-2xl bg-white p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-tinta/60">Razina</p>
            <p className="font-display text-4xl leading-none">{bodovi.level}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-tinta/60">Niz dana</p>
            <p className="font-display text-4xl leading-none text-pijesak">
              {bodovi.serie_tage}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-magla">
          <div className="h-full bg-pijesak transition-all" style={{ width: `${napredak}%` }} />
        </div>
        <p className="mt-2 text-xs text-tinta/50">
          {bodovi.xp} bodova · ovaj tjedan {bodovi.diese_woche}/{bodovi.wochenziel} dana
        </p>
      </section>

      {/* Gemeinsame Stunde */}
      {zivaSesija ? (
        <button
          onClick={() => router.push("/session")}
          className="mt-4 w-full rounded-2xl bg-more p-5 text-left text-white"
        >
          <p className="font-display text-2xl">Sat je počeo</p>
          <p className="mt-1 text-sm text-white/80">Uđi u zajedničku vježbu</p>
        </button>
      ) : (
        <button
          onClick={() => router.push("/session")}
          className="mt-4 w-full rounded-2xl border border-tinta/15 bg-white p-5 text-left"
        >
          <p className="font-display text-2xl">Zajednički sat</p>
          <p className="mt-1 text-sm text-tinta/60">
            {ja.rolle === "trainer" ? "Pokreni vježbu s Nikolinom" : "Čekaj da Ivo pokrene sat"}
          </p>
        </button>
      )}

      {/* Themen zum Alleine-Üben */}
      <h2 className="mt-10 font-display text-xl">Vježbaj sama</h2>
      <div className="mt-3 space-y-2">
        {teme.map((t, i) => (
          <button
            key={t.id}
            onClick={() => router.push(`/lernen?tema=${t.id}`)}
            className="flex w-full items-center gap-4 rounded-xl bg-white p-4 text-left
                       hover:bg-white/60"
          >
            <span className="font-display text-2xl text-more/40">{i + 1}</span>
            <span>
              <span className="block font-medium">{t.titel_hr}</span>
              <span className="block text-sm text-tinta/50">{t.titel_de}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
