"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  supabase, akzentSetzen, themaSetzen, themaLesen, prognoza, minute
} from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";
import { putanja, trenutnoNiveau } from "../../lib/nivoi";

export default function Start() {
  const router = useRouter();
  const slika = useRef(null);

  const [ja, setJa] = useState(null);
  const [drugi, setDrugi] = useState(null);
  const [bodovi, setBodovi] = useState(null);
  const [teme, setTeme] = useState([]);
  const [dug, setDug] = useState({});
  const [linija, setLinija] = useState([]);
  const [danas, setDanas] = useState({ ja: null, drugi: null });
  const [tema, setTema] = useState("auto");
  const [sesija, setSesija] = useState(null);
  const [niveau, setNiveau] = useState("A1");
  const [staza, setStaza] = useState({ razine: [], sveGotovo: false });

  useEffect(() => { setTema(themaLesen()); }, []);

  const provjeriSat = useCallback(async () => {
    const { data } = await supabase.from("sessions")
      .select("id").eq("status", "offen").limit(1);
    setSesija(data?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;
      const danasnji = new Date().toISOString().slice(0, 10);
      const prije28 = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);

      const [profili, sviBodovi, sveTeme, sveKarte, mojNapredak, akt, isp] = await Promise.all([
        supabase.from("profile").select("*"),
        supabase.from("punkte").select("*"),
        supabase.from("themen").select("*").order("reihenfolge"),
        supabase.from("karten").select("id, thema_id, de"),
        supabase.from("fortschritt").select("karte_id, richtig, naechste_frage").eq("user_id", uid),
        supabase.from("aktivitaet").select("*").gte("datum", prije28),
        supabase.from("pruefungen").select("*").eq("user_id", uid)
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

      const n = trenutnoNiveau(isp.data);
      setNiveau(n);
      setStaza(putanja(sveKarte.data || [], sveTeme.data || [], mojNapredak.data || [], n));

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

      const mojeDanas = (akt.data || [])
        .find((a) => a.user_id === uid && a.datum === danasnji) || null;
      const drugiDanas = drugiProfil
        ? (akt.data || []).find((a) => a.user_id === drugiProfil.user_id && a.datum === danasnji) || null
        : null;
      setDanas({ ja: mojeDanas, drugi: drugiDanas });

      const znane = (mojNapredak.data || []).filter((n) => n.richtig >= 2).length;
      const ukupno = (akt.data || []).filter((a) => a.user_id === uid)
        .reduce((z, a) => z + Number(a.tezina || 0), 0);
      setLinija(prognoza(znane, ukupno / 28));

      provjeriSat();
    })();
  }, [router, provjeriSat]);

  /* Der Knopf reagiert sofort — sowohl auf Start als auch auf Abbruch. */
  useEffect(() => {
    const kanal = supabase.channel("stanje-sata")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        (p) => {
          if (p.eventType === "INSERT" && p.new.status === "offen") setSesija(p.new.id);
          else provjeriSat();
        })
      .subscribe();

    // Sicherheitsnetz: beim Zurückkehren auf die Seite nochmal nachsehen.
    const naVidljivost = () => { if (!document.hidden) provjeriSat(); };
    document.addEventListener("visibilitychange", naVidljivost);
    window.addEventListener("focus", naVidljivost);

    return () => {
      supabase.removeChannel(kanal);
      document.removeEventListener("visibilitychange", naVidljivost);
      window.removeEventListener("focus", naVidljivost);
    };
  }, [provjeriSat]);

  function noviTema() {
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
  const oznakaTeme = tema === "dark" ? "Tamno" : tema === "light" ? "Svijetlo" : "Auto";

  return (
    <div className="stranica">
      {/* Leiste, nur am grossen Bildschirm */}
      <div className="hidden border-b border-rub bg-ploha md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          <p className="font-semibold tracking-tight">Deutsch za dvoje</p>
          <div className="flex items-center gap-4">
            <button onClick={noviTema}
              className="rounded-xl border border-rub px-3 py-1.5 text-xs text-tiho">
              {oznakaTeme}
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}
              className="text-sm text-tiho">Odjava</button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md px-5 pb-8 pt-8 md:max-w-5xl md:px-8 md:pt-10">

        {/* Kopf */}
        <header className="flex items-center gap-3">
          <button onClick={() => slika.current?.click()}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-akzent/15 md:h-16 md:w-16">
            {ja.bild_url
              ? <img src={ja.bild_url} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-akzent">
                  {(ja.name || "?").slice(0, 1)}
                </span>}
          </button>
          <input ref={slika} type="file" accept="image/*" onChange={posaljiSliku} className="hidden" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold tracking-tight md:text-2xl">
              Bok{ja.name ? `, ${ja.name}` : ""}
            </p>
            <p className="text-sm text-tiho">
              {danas.ja ? `Danas ${minute(danas.ja.sekunden)} · ${danas.ja.karten} kartica`
                        : "Danas još nisi vježbala"}
            </p>
          </div>

          <button onClick={noviTema}
            className="rounded-xl border border-rub px-3 py-2 text-xs text-tiho md:hidden">
            {oznakaTeme}
          </button>
        </header>

        {ukupnoDuga > 0 && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-alarm/30 bg-alarm/10 px-4 py-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-alarm" />
            <p className="text-sm"><strong>{ukupnoDuga}</strong> kartica čeka na ponavljanje.</p>
          </div>
        )}

        {/* Zwei Spalten am Notebook, eine am Telefon */}
        <div className="mt-4 gap-5 md:grid md:grid-cols-[1fr_1.1fr] md:items-start">

          <div className="space-y-4">
            <section className="ploca p-5">
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

            <section className="ploca p-5">
              <p className="font-semibold tracking-tight">Do kojeg nivoa i kada</p>
              <p className="mt-1 text-xs text-tiho">
                Procjena prema tvom tempu zadnjih tjedana.
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

            {drugi && (
              <section className="ploca flex items-center gap-3 p-4">
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
          </div>

          <div className="mt-4 space-y-4 md:mt-0">
            <button onClick={() => router.push("/session")}
              className={`w-full rounded-2xl p-5 text-left ${sesija ? "bg-akzent text-white" : "ploca"}`}>
              <p className="text-xl font-semibold tracking-tight">
                {sesija ? "Sat je počeo" : "Zajednički sat"}
              </p>
              <p className={`mt-1 text-sm ${sesija ? "text-white/80" : "text-tiho"}`}>
                {sesija ? "Uđi u zajedničku vježbu"
                        : ja.rolle === "trainer" ? "Pokreni vježbu" : "Čekaj da Ivo pokrene sat"}
              </p>
            </button>

            <section className="ploca p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Put do {niveau}</h2>
                <span className="text-xs text-tiho">
                  {staza.razine.filter((r) => r.gotovo).length} / {staza.razine.length}
                </span>
              </div>

              <div className="putanja mt-4">
                {staza.razine.map((r, idx) => {
                  const prijasnjeGotove = staza.razine.slice(0, idx).every((x) => x.gotovo);
                  const sada = !r.gotovo && prijasnjeGotove;
                  return (
                    <div key={r.broj} className="flex items-center">
                      {idx > 0 && <span className={`crta ${r.gotovo ? "crta-ok" : ""}`} />}
                      <button
                        onClick={() => router.push(`/lernen?razina=${r.broj}`)}
                        title={`${r.gotovih} / ${r.ukupno}`}
                        className={`cvor ${r.gotovo ? "cvor-ok" : sada ? "cvor-sada" : ""}`}>
                        {r.broj}
                      </button>
                    </div>
                  );
                })}

                <span className={`crta ${staza.sveGotovo ? "crta-ok" : ""}`} />
                <button
                  onClick={() => staza.sveGotovo && router.push("/ispit")}
                  disabled={!staza.sveGotovo}
                  className={`cvor cvor-ispit ${staza.sveGotovo ? "cvor-sada animate-pulse" : "opacity-50"}`}>
                  Ispit
                </button>
              </div>

              <p className="mt-3 text-xs text-tiho">
                {staza.sveGotovo
                  ? `Sve razine su gotove. Ispit: 30 pitanja, 80% za prolaz.`
                  : "Svaka razina ima 10 kartica. Kad sve sjednu, otvara se ispit."}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push("/pisanje")} className="ploca p-4 text-left">
                <p className="font-medium">Pisanje</p>
                <p className="mt-1 text-xs text-tiho">Napiši rečenicu, dobiješ ispravak</p>
              </button>
              <button onClick={() => router.push("/razgovor")} className="ploca p-4 text-left">
                <p className="font-medium">Razgovor</p>
                <p className="mt-1 text-xs text-tiho">Osam situacija iz stvarnog života</p>
              </button>
            </div>

            <button onClick={() => router.push("/igre")}
              className="ploca w-full p-4 text-left">
              <p className="font-medium">Igre</p>
              <p className="mt-1 text-xs text-tiho">
                Brzina, parovi i dvoboj protiv Ive
              </p>
            </button>

            <section>
              <h2 className="text-lg font-semibold tracking-tight">Vježbaj po temama</h2>
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
            </section>
          </div>
        </div>

        <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}
          className="mt-10 w-full text-sm text-tiho underline md:hidden">
          Odjava
        </button>

        <Podnozje />
      </main>
    </div>
  );
}
