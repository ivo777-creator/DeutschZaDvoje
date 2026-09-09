"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  supabase, akzentSetzen, themaSetzen, themaLesen, minute
} from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";
import { Vodic } from "../../lib/vodic";
import { staza, trenutnoNiveau, karteNivoa, MIN_RIJECI, PRAG } from "../../lib/nivoi";

const NIVOI = ["A1", "A2", "B1", "B2", "C1", "C2"];

function uVrijeme(dana) {
  if (dana <= 0) return "gotovo";
  if (dana < 14)  return `${dana} dana`;
  if (dana < 60)  return `${Math.round(dana / 7)} tjedana`;
  if (dana < 730) return `${Math.round(dana / 30)} mjeseci`;
  return `${(dana / 365).toFixed(1).replace(".0", "")} godina`;
}

export default function Start() {
  const router = useRouter();
  const slika = useRef(null);

  const [ja, setJa] = useState(null);
  const [drugi, setDrugi] = useState(null);
  const [bodovi, setBodovi] = useState(null);
  const [teme, setTeme] = useState([]);
  const [dug, setDug] = useState({});
  const [danas, setDanas] = useState({ ja: null, drugi: null });
  const [tema, setTema] = useState("auto");
  const [sesija, setSesija] = useState(null);
  const [niveau, setNiveau] = useState("A1");
  const [put, setPut] = useState(null);
  const [otvoren, setOtvoren] = useState(null);
  const [vodic, setVodic] = useState(false);
  const [traka, setTraka] = useState([]);

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

      const [profili, sviBodovi, sveTeme, sveKarte, napredak, akt, isp] = await Promise.all([
        supabase.from("profile").select("*"),
        supabase.from("punkte").select("*"),
        supabase.from("themen").select("*").order("reihenfolge"),
        supabase.from("karten").select("id, thema_id"),
        supabase.from("fortschritt").select("*").eq("user_id", uid),
        supabase.from("aktivitaet").select("*").gte("datum", prije28),
        supabase.from("pruefungen").select("*").eq("user_id", uid)
      ]);

      const mojProfil = (profili.data || []).find((p) => p.user_id === uid)
        || { user_id: uid, name: "", rolle: "schueler", akzent: "blau" };
      setJa(mojProfil);
      setDrugi((profili.data || []).find((p) => p.user_id !== uid) || null);
      akzentSetzen(mojProfil.akzent);
      if (!mojProfil.vodic_gotov) setVodic(true);

      setBodovi((sviBodovi.data || []).find((b) => b.user_id === uid)
        || { xp: 0, level: 1, serie_tage: 0, diese_woche: 0, wochenziel: 5 });
      setTeme(sveTeme.data || []);

      const n = trenutnoNiveau(isp.data);
      setNiveau(n);
      const st = staza(sveKarte.data || [], sveTeme.data || [], napredak.data || [], n, isp.data || []);
      setPut(st);
      setOtvoren(st.sekcije.find((x) => !x.ispitPolozen)?.kljuc ?? null);

      /* Offene Wiederholungen je Thema */
      const temaOd = {};
      (sveKarte.data || []).forEach((k) => (temaOd[k.id] = k.thema_id));
      const sada = Date.now();
      const brojac = {};
      (napredak.data || []).forEach((x) => {
        if (new Date(x.naechste_frage).getTime() <= sada) {
          brojac[temaOd[x.karte_id]] = (brojac[temaOd[x.karte_id]] || 0) + 1;
        }
      });
      setDug(brojac);

      /* Tagesbericht */
      const drugiProfil = (profili.data || []).find((p) => p.user_id !== uid) || null;
      setDanas({
        ja: (akt.data || []).find((a) => a.user_id === uid && a.datum === danasnji) || null,
        drugi: drugiProfil
          ? (akt.data || []).find((a) => a.user_id === drugiProfil.user_id && a.datum === danasnji) || null
          : null
      });

      /* ---- Die Zeitleiste, ehrlich gerechnet ---- */
      const tempo = Math.max(
        (akt.data || []).filter((a) => a.user_id === uid)
          .reduce((z, a) => z + Number(a.tezina || 0), 0) / 28,
        0
      );

      const polozeni = {};
      (isp.data || []).filter((p) => p.bestanden && !p.sekcija)
        .forEach((p) => (polozeni[p.niveau] = p.datum));

      const znanoPoNivou = {};
      NIVOI.forEach((lvl) => {
        const karteL = karteNivoa(sveKarte.data || [], sveTeme.data || [], lvl);
        const ids = new Set(karteL.map((k) => k.id));
        znanoPoNivou[lvl] = {
          ukupnoGradiva: karteL.length,
          znano: (napredak.data || []).filter((x) => ids.has(x.karte_id) && x.richtig >= PRAG).length
        };
      });

      setTraka(NIVOI.map((lvl) => {
        const treba = MIN_RIJECI[lvl] || 600;
        const { znano, ukupnoGradiva } = znanoPoNivou[lvl];

        if (polozeni[lvl]) {
          return { lvl, stanje: "polozen", kada: new Date(polozeni[lvl]).toLocaleDateString("hr-HR") };
        }
        if (lvl === n) {
          const ostalo = Math.max(treba - znano, 0);
          return {
            lvl, stanje: "sada", znano, treba,
            postotak: Math.min(100, Math.round((znano / treba) * 100)),
            kada: tempo > 0.2 ? uVrijeme(Math.ceil(ostalo / tempo)) : null,
            gradivo: ukupnoGradiva
          };
        }
        return { lvl, stanje: ukupnoGradiva > 0 ? "kasnije" : "nema", treba };
      }));

      provjeriSat();
    })();
  }, [router, provjeriSat]);

  useEffect(() => {
    const kanal = supabase.channel("stanje-sata")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" },
        (p) => {
          if (p.eventType === "INSERT" && p.new.status === "offen") setSesija(p.new.id);
          else provjeriSat();
        }).subscribe();
    const naVidljivost = () => { if (!document.hidden) provjeriSat(); };
    document.addEventListener("visibilitychange", naVidljivost);
    window.addEventListener("focus", naVidljivost);
    return () => {
      supabase.removeChannel(kanal);
      document.removeEventListener("visibilitychange", naVidljivost);
      window.removeEventListener("focus", naVidljivost);
    };
  }, [provjeriSat]);

  async function zatvoriVodic() {
    setVodic(false);
    if (ja) await supabase.from("profile").update({ vodic_gotov: true }).eq("user_id", ja.user_id);
  }

  function noviTema() {
    const red = { auto: "light", light: "dark", dark: "auto" };
    const n = red[tema];
    setTema(n); themaSetzen(n);
  }

  async function posaljiSliku(e) {
    const f = e.target.files?.[0];
    if (!f || !ja) return;
    const put2 = `${ja.user_id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("avatare").upload(put2, f, { upsert: true });
    if (error) return;
    const { data } = supabase.storage.from("avatare").getPublicUrl(put2);
    await supabase.from("profile").update({ bild_url: data.publicUrl }).eq("user_id", ja.user_id);
    setJa({ ...ja, bild_url: data.publicUrl });
  }

  if (!ja || !bodovi || !put) return null;

  const napredakXp = ((bodovi.xp % 200) / 200) * 100;
  const ukupnoDuga = Object.values(dug).reduce((a, b) => a + b, 0);
  const oznakaTeme = tema === "dark" ? "Tamno" : tema === "light" ? "Svijetlo" : "Auto";

  /* ---------------- Bausteine ---------------- */

  const Bodovi = (
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
             style={{ width: `${napredakXp}%` }} />
      </div>
      <p className="mt-2 text-xs text-tiho">
        {bodovi.xp} bodova · ovaj tjedan {bodovi.diese_woche}/{bodovi.wochenziel} dana
      </p>
    </section>
  );

  const Drugi = drugi && (
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
  );

  const Traka = (
    <section className="ploca p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Gdje si na putu</h2>
        <span className="text-xs text-tiho">A1 → C2</span>
      </div>

      <div className="traka mt-4">
        {traka.map((n) => (
          <div key={n.lvl} className={`kartica-nivoa ${
            n.stanje === "polozen" ? "border-akzent/50 bg-akzent/10"
            : n.stanje === "sada" ? "border-akzent" : "border-rub opacity-60"}`}>
            <p className={`text-3xl font-semibold tracking-tight ${
              n.stanje === "nema" ? "text-tiho" : "text-akzent"}`}>{n.lvl}</p>

            {n.stanje === "polozen" && (
              <>
                <p className="mt-2 text-sm font-medium">Položeno</p>
                <p className="mt-0.5 text-xs text-tiho">{n.kada}</p>
              </>
            )}

            {n.stanje === "sada" && (
              <>
                <p className="mt-2 text-sm font-medium">Sada ovdje</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-pod">
                  <div className="h-full rounded-full bg-akzent"
                       style={{ width: `${n.postotak}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-tiho">{n.znano} / {n.treba} riječi</p>
                <p className="mt-0.5 text-xs text-tiho">
                  {n.kada ? `još ~${n.kada}` : "vježbaj koji dan za procjenu"}
                </p>
              </>
            )}

            {n.stanje === "kasnije" && (
              <p className="mt-2 text-sm text-tiho">Kasnije</p>
            )}

            {n.stanje === "nema" && (
              <>
                <p className="mt-2 text-sm text-tiho">Nema gradiva</p>
                <p className="mt-0.5 text-xs text-tiho">dolazi kasnije</p>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-tiho">
        Procjena vrijedi samo za nivo na kojem si. Za više nivoe još nema gradiva,
        pa nema ni poštene procjene.
      </p>
    </section>
  );

  const Put = (
    <section className="ploca p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Put do {niveau}</h2>
        <span className="text-xs text-tiho">
          {put.sekcije.filter((x) => x.ispitPolozen).length} / {put.sekcije.length}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {put.sekcije.map((sek) => (
          <div key={sek.kljuc}
            className={`rounded-xl border p-3 ${
              sek.ispitPolozen ? "border-akzent/40 bg-akzent/5"
              : sek.otvorena ? "border-rub" : "border-rub opacity-50"}`}>

            <button
              onClick={() => sek.otvorena && setOtvoren(otvoren === sek.kljuc ? null : sek.kljuc)}
              className="flex w-full items-center gap-3 text-left">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                sek.ispitPolozen ? "bg-akzent text-white" : "border-2 border-rub text-tiho"}`}>
                {sek.ispitPolozen ? "✓" : sek.gotovih}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{sek.ime}</span>
                <span className="block truncate text-xs text-tiho">
                  {sek.otvorena ? `${sek.gotovih} / ${sek.razine.length} razina` : "Zaključano"}
                </span>
              </span>
            </button>

            {otvoren === sek.kljuc && sek.otvorena && (
              <>
                <div className="putanja mt-3">
                  {sek.razine.map((r, idx) => {
                    const prije = sek.razine.slice(0, idx).every((x) => x.gotovo);
                    const sada = !r.gotovo && prije;
                    const dio = Math.round((r.gotovih / r.ukupno) * 100);
                    return (
                      <div key={r.broj} className="flex items-center">
                        {idx > 0 && <span className={`crta ${r.gotovo ? "crta-ok" : ""}`} />}
                        <button
                          onClick={() => router.push(`/lernen?sekcija=${sek.kljuc}&razina=${r.broj}`)}
                          title={`${r.gotovih} / ${r.ukupno} sjede`}
                          style={!r.gotovo && r.gotovih > 0 ? {
                            background: `conic-gradient(rgb(var(--akzent)) ${dio}%, rgb(var(--ploha)) 0)`
                          } : undefined}
                          className={`cvor ${r.gotovo ? "cvor-ok" : sada ? "cvor-sada" : ""}`}>
                          {r.broj}
                        </button>
                      </div>
                    );
                  })}

                  {sek.popravak.length > 0 && (
                    <>
                      <span className={`crta ${sek.popravakGotov ? "crta-ok" : ""}`} />
                      <button
                        onClick={() => sek.popravakOtvoren && router.push(`/lernen?popravak=${sek.kljuc}`)}
                        disabled={!sek.popravakOtvoren}
                        title="Kartice koje su ti zadavale muke"
                        className={`cvor ${
                          sek.popravakGotov ? "cvor-ok"
                          : sek.popravakOtvoren ? "cvor-sada animate-pulse" : "opacity-50"}`}>
                        X
                      </button>
                    </>
                  )}

                  <span className={`crta ${sek.ispitPolozen ? "crta-ok" : ""}`} />
                  <button
                    onClick={() => sek.ispitOtvoren && router.push(`/ispit?sekcija=${sek.kljuc}`)}
                    disabled={!sek.ispitOtvoren}
                    className={`cvor cvor-ispit ${
                      sek.ispitPolozen ? "cvor-ok"
                      : sek.ispitOtvoren ? "cvor-sada animate-pulse" : "opacity-50"}`}>
                    Ispit
                  </button>
                </div>

                <p className="mt-2 text-xs text-tiho">{sek.opis}</p>
                <p className="mt-1 text-xs text-tiho">
                  Kartica se boji tek kad sjedne dvaput, s pauzom između.
                  {sek.popravak.length > 0 &&
                    ` Razina X skuplja ono što ti je zadavalo muke (${sek.popravak.length}).`}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => put.velikiIspitOtvoren && router.push("/ispit")}
        disabled={!put.velikiIspitOtvoren}
        className={`mt-4 w-full rounded-xl p-4 text-left ${
          put.velikiIspitOtvoren ? "bg-akzent text-white" : "border border-rub opacity-60"}`}>
        <p className="font-semibold tracking-tight">Veliki ispit {niveau}</p>
        <p className={`mt-1 text-xs ${put.velikiIspitOtvoren ? "text-white/80" : "text-tiho"}`}>
          {put.velikiIspitOtvoren ? "40 pitanja, sve vrste zadataka"
            : !put.dovoljnoGradiva ? `Gradivo: ${put.ukupnoRijeci} / ${put.trebaRijeci} riječi`
            : "Prvo sva tri dijela"}
        </p>
      </button>
    </section>
  );

  const Radnje = (
    <>
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

      <button onClick={() => router.push("/igre")} className="ploca w-full p-4 text-left">
        <p className="font-medium">Igre</p>
        <p className="mt-1 text-xs text-tiho">Brzina, parovi i dvoboj protiv Ive</p>
      </button>
    </>
  );

  const Teme = (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Vježbaj po temama</h2>
      <div className="mt-3 space-y-2">
        {teme.filter((t) => (t.stufe || "A1") === niveau).map((t) => (
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
  );

  /* ---------------- Seite ---------------- */

  return (
    <div className="stranica">
      {vodic && <Vodic onKraj={zatvoriVodic} />}

      {/* Leiste am Notebook */}
      <div className="hidden border-b border-rub bg-ploha md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <p className="font-semibold tracking-tight">Hallo-Bok</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setVodic(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-rub text-sm text-tiho">
              ?
            </button>
            <button onClick={noviTema}
              className="rounded-xl border border-rub px-3 py-1.5 text-xs text-tiho">
              {oznakaTeme}
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}
              className="text-sm text-tiho">Odjava</button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md px-5 pb-8 pt-8 md:max-w-6xl md:px-8 md:pt-8">

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
              Hallo-Bok{ja.name ? `, ${ja.name}` : ""}
            </p>
            <p className="text-sm text-tiho">
              {danas.ja ? `Danas ${minute(danas.ja.sekunden)} · ${danas.ja.karten} kartica`
                        : "Danas još nisi vježbala"}
            </p>
          </div>

          <button onClick={() => setVodic(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rub text-sm text-tiho md:hidden">
            ?
          </button>
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

        {/* Die Zeitleiste läuft über die ganze Breite */}
        <div className="mt-5">{Traka}</div>

        {/* Telefon: alles untereinander. Notebook: zwei Spalten. */}
        <div className="mt-5 grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-start">
          <div className="space-y-5">
            {Put}
            <div className="hidden md:block">{Teme}</div>
          </div>
          <div className="space-y-5">
            {Bodovi}
            {Drugi}
            {Radnje}
            <div className="md:hidden">{Teme}</div>
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
