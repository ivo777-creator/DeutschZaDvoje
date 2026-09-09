"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  supabase, akzentSetzen, themaSetzen, themaLesen,
  prognoza, minute
} from "../../lib/supabase";

export default function Start() {
  const router = useRouter();
  const slika = useRef(null);

  const [ja, setJa] = useState(null);
  const [drugi, setDrugi] = useState(null);
  const [bodovi, setBodovi] = useState(null);
  const [teme, setTeme] = useState([]);
  const [dug, setDug] = useState({});        // Thema -> offene Wiederholungen
  const [linija, setLinija] = useState([]);  // A1 ... C2
  const [danas, setDanas] = useState({ ja: null, drugi: null });
  const [tema, setTema] = useState("auto");
  const [sesija, setSesija] = useState(null);

  useEffect(() => { setTema(themaLesen()); }, []);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;
      const danasnji = new Date().toISOString().slice(0, 10);
      const prije28 = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);

      const [profili, sviBodovi, sveTeme, sveKarte, mojNapredak, akt, otvorena] =
        await Promise.all([
          supabase.from("profile").select("*"),
          supabase.from("punkte").select("*"),
          supabase.from("themen").select("*").order("reihenfolge"),
          supabase.from("karten").select("id, thema_id"),
          supabase.from("fortschritt").select("karte_id, richtig, naechste_frage")
            .eq("user_id", uid),
          supabase.from("aktivitaet").select("*").gte("datum", prije28),
          supabase.from("sessions").select("id").eq("status", "offen").limit(1)
        ]);

      const mojProfil = (profili.data || []).find((p) => p.user_id === uid)
        || { user_id: uid, name: "", rolle: "schueler", akzent: "blau" };
      const drugiProfil = (profili.data || []).find((p) => p.user_id !== uid) || null;

      setJa(mojProfil);
      setDrugi(drugiProfil);
      akzentSetzen(mojProfil.akzent);

      setBodovi((sviBodovi.data || []).find((b) => b.user_id === uid)
        || { xp: 0, level: 1, serie_tage: 0, diese_woche: 0, wochenziel: 5 });
      setTeme(sveTeme.data || []);

      // Offene Wiederholungen je Thema
      const temaOd = {};
      (sveKarte.data || []).forEach((k) => (temaOd[k.id] = k.thema_id));
      const sada = Date.now();
      const brojac = {};
      (mojNapredak.data || []).forEach((n) => {
        if (new Date(n.naechste_frage).getTime() <= sada) {
          const t = temaOd[n.karte_id];
          brojac[t] = (brojac[t] || 0) + 1;
        }
      });
      setDug(brojac);

      // Heutige Übungszeit, für beide offen sichtbar
      const mojeDanas = (akt.data || [])
        .find((a) => a.user_id === uid && a.datum === danasnji) || null;
      const drugiDanas = drugiProfil
        ? (akt.data || []).find((a) => a.user_id === drugiProfil.user_id && a.datum === danasnji) || null
        : null;
      setDanas({ ja: mojeDanas, drugi: drugiDanas });

      // Prognose: gelernte Wörter und Tempo der letzten vier Wochen
      const znane = (mojNapredak.data || []).filter((n) => n.richtig >= 2).length;
      const ukupno = (akt.data || [])
        .filter((a) => a.user_id === uid)
        .reduce((z, a) => z + a.karten, 0);
      setLinija(prognoza(znane, ukupno / 28));

      setSesija(otvorena.data?.[0]?.id ?? null);
    })();
  }, [router]);

  async function noviTema() {
    const red = { auto: "light", light: "dark", dark: "auto" };
    const n = red[tema];
    setTema(n); themaSetzen(n);
  }

  async function posaljiSliku(e) {
    const f = e.target.files?.[0];
    if (!f || !ja) return;
    const put = `${ja.user_id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("avatare").upload(put, f, { upsert: true });
    if (error) return;
    const { data } = supabase.storage.from("avatare").getPublicUrl(put);
    await supabase.from("profile").update({ bild_url: data.publicUrl }).eq("user_id", ja.user_id);
    setJa({ ...ja, bild_url: data.publicUrl });
  }

  if (!ja || !bodovi) return null;

  const napredak = ((bodovi.xp % 200) / 200) * 100;
  const ukupnoDuga = Object.values(dug).reduce((a, b) => a + b, 0);
  const oznakaTeme = { auto: "Automatski", light: "Svijetlo", dark: "Tamno" }[tema];

  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-8">

      {/* Kopf */}
      <header className="flex items-center gap-3">
        <button onClick={() => slika.current?.click()}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-akzent/15">
          {ja.bild_url
            ? <img src={ja.bild_url} alt="" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-akzent">
                {(ja.name || "?").slice(0, 1)}
              </span>}
        </button>
        <input ref={slika} type="file" accept="image/*" onChange={posaljiSliku} className="hidden" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold tracking-tight">
            Bok{ja.name ? `, ${ja.name}` : ""}
          </p>
          <p className="text-sm text-tiho">
            {danas.ja ? `Danas ${minute(danas.ja.sekunden)} · ${danas.ja.karten} kartica`
                      : "Danas još nisi vježbala"}
          </p>
        </div>

        <button onClick={noviTema} title={oznakaTeme}
          className="rounded-xl border border-rub px-3 py-2 text-xs text-tiho">
          {tema === "dark" ? "Tamno" : tema === "light" ? "Svijetlo" : "Auto"}
        </button>
      </header>

      {/* Offene Wiederholungen */}
      {ukupnoDuga > 0 && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-alarm/30 bg-alarm/10 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-alarm" />
          <p className="text-sm">
            <strong>{ukupnoDuga}</strong> kartica čeka na ponavljanje.
          </p>
        </div>
      )}

      {/* Punkte */}
      <section className="ploca mt-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-tiho">Razina</p>
            <p className="text-4xl font-semibold leading-none tracking-tight">{bodovi.level}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-tiho">Niz dana</p>
            <p className="text-4xl font-semibold leading-none tracking-tight text-akzent">
              {bodovi.serie_tage}
            </p>
          </div>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-pod">
          <div className="h-full rounded-full bg-akzent transition-all"
               style={{ width: `${napredak}%` }} />
        </div>
        <p className="mt-2 text-xs text-tiho">
          {bodovi.xp} bodova · ovaj tjedan {bodovi.diese_woche}/{bodovi.wochenziel} dana
        </p>
      </section>

      {/* Wie weit noch bis zu welchem Niveau */}
      <section className="ploca mt-4 p-5">
        <p className="font-semibold tracking-tight">Do kojeg nivoa i kada</p>
        <p className="mt-1 text-xs text-tiho">
          Procjena prema tvom tempu zadnjih tjedana. Vježbaš više — datum se približava.
        </p>
        <ul className="mt-4 space-y-3">
          {linija.map((n) => (
            <li key={n.oznaka} className="flex items-center gap-3">
              <span className={`w-9 shrink-0 text-sm font-semibold ${n.gotovo ? "text-akzent" : "text-tiho"}`}>
                {n.oznaka}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-pod">
                <span className="block h-full rounded-full bg-akzent"
                      style={{ width: n.gotovo ? "100%" : `${Math.max(3, 100 - Math.min(n.dana / 12, 97))}%` }} />
              </span>
              <span className="w-24 shrink-0 text-right text-sm text-tiho">{n.kada}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Der andere */}
      {drugi && (
        <section className="ploca mt-4 flex items-center gap-3 p-4">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-pod">
            {drugi.bild_url
              ? <img src={drugi.bild_url} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center text-tiho">
                  {(drugi.name || "?").slice(0, 1)}
                </span>}
          </span>
          <p className="text-sm">
            <span className="font-medium">{drugi.name}</span>{" "}
            <span className="text-tiho">
              {danas.drugi
                ? `danas ${minute(danas.drugi.sekunden)}, ${danas.drugi.karten} kartica`
                : "danas još ništa"}
            </span>
          </p>
        </section>
      )}

      {/* Gemeinsame Stunde */}
      <button onClick={() => router.push("/session")}
        className={`mt-4 w-full rounded-2xl p-5 text-left ${
          sesija ? "bg-akzent text-white" : "ploca"}`}>
        <p className="text-xl font-semibold tracking-tight">
          {sesija ? "Sat je počeo" : "Zajednički sat"}
        </p>
        <p className={`mt-1 text-sm ${sesija ? "text-white/80" : "text-tiho"}`}>
          {sesija ? "Uđi u zajedničku vježbu"
                  : ja.rolle === "trainer" ? "Pokreni vježbu" : "Čekaj da Ivo pokrene sat"}
        </p>
      </button>

      {/* Themen */}
      <h2 className="mt-8 text-lg font-semibold tracking-tight">Vježbaj sama</h2>
      <div className="mt-3 space-y-2">
        {teme.map((t) => (
          <button key={t.id} onClick={() => router.push(`/lernen?tema=${t.id}`)}
            className="ploca flex w-full items-center gap-3 p-4 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.titel_hr}</span>
              <span className="block truncate text-sm text-tiho">{t.titel_de}</span>
            </span>
            {dug[t.id] > 0 && (
              <span className="shrink-0 rounded-full bg-alarm px-2 py-0.5 text-xs font-medium text-white">
                {dug[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}
        className="mt-10 w-full text-sm text-tiho underline">
        Odjava
      </button>
    </main>
  );
}
