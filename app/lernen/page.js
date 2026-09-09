"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  supabase, vorlesen, punkteDazu, aktivitaetDazu, akzentSetzen
} from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";
import { putanja, trenutnoNiveau, vrstaZadatka, usporedi } from "../../lib/nivoi";

function Ucenje() {
  const router = useRouter();
  const trazilica = useSearchParams();
  const tema = trazilica.get("tema");
  const razina = trazilica.get("razina");

  const pocetak = useRef(Date.now());
  const spremljeno = useRef(false);
  const polje = useRef(null);

  const [uid, setUid] = useState(null);
  const [kartice, setKartice] = useState(null);
  const [stanje, setStanje] = useState({});   // karte_id -> fortschritt
  const [i, setI] = useState(0);
  const [otkriveno, setOtkriveno] = useState(false);
  const [upis, setUpis] = useState("");
  const [ocjena, setOcjena] = useState(null); // tocno | skoro | netocno
  const [tocno, setTocno] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const id = s.session.user.id;
      setUid(id);

      const [{ data: p }, { data: teme }, { data: sve }, { data: nap }, { data: isp }] =
        await Promise.all([
          supabase.from("profile").select("akzent").eq("user_id", id).maybeSingle(),
          supabase.from("themen").select("*").order("reihenfolge"),
          supabase.from("karten").select("*"),
          supabase.from("fortschritt").select("*").eq("user_id", id),
          supabase.from("pruefungen").select("*").eq("user_id", id)
        ]);
      akzentSetzen(p?.akzent);

      const mapa = {};
      (nap || []).forEach((n) => (mapa[n.karte_id] = n));
      setStanje(mapa);

      let izbor;
      if (razina) {
        const st = putanja(sve || [], teme || [], nap || [], trenutnoNiveau(isp));
        izbor = st.razine[Number(razina) - 1]?.karte || [];
      } else {
        const sada = Date.now();
        izbor = (sve || [])
          .filter((k) => String(k.thema_id) === String(tema))
          .filter((k) => !mapa[k.id] ||
            new Date(mapa[k.id].naechste_frage).getTime() <= sada + 864e5)
          .sort((a, b) => {
            const va = mapa[a.id] ? new Date(mapa[a.id].naechste_frage).getTime() : 0;
            const vb = mapa[b.id] ? new Date(mapa[b.id].naechste_frage).getTime() : 0;
            return va - vb;
          })
          .slice(0, 15);
      }
      setKartice(izbor);
    })();
  }, [tema, razina, router]);

  async function zapisi(k, znam) {
    const post = stanje[k.id];
    const razmak = znam ? Math.min((post?.abstand_tage || 1) * 2, 60) : 1;
    await supabase.from("fortschritt").upsert({
      user_id: uid, karte_id: k.id,
      richtig: (post?.richtig || 0) + (znam ? 1 : 0),
      falsch:  (post?.falsch  || 0) + (znam ? 0 : 1),
      abstand_tage: razmak,
      naechste_frage: new Date(Date.now() + razmak * 864e5).toISOString()
    }, { onConflict: "user_id,karte_id" });
    if (znam) setTocno((n) => n + 1);
  }

  async function dalje(znam) {
    await zapisi(kartice[i], znam);
    setOtkriveno(false); setUpis(""); setOcjena(null);
    setI((n) => n + 1);
  }

  async function provjeriUpis() {
    const k = kartice[i];
    const rez = usporedi(upis, k.de);
    setOcjena(rez);
    setOtkriveno(true);
    if (rez !== "netocno") await zapisi(k, true);
    else await zapisi(k, false);
  }

  function sljedeca() {
    setOtkriveno(false); setUpis(""); setOcjena(null);
    setI((n) => n + 1);
  }

  if (kartice === null) return null;

  if (kartice.length === 0) {
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-3xl font-semibold tracking-tight">Za danas si gotova</p>
        <p className="mt-2 text-tiho">Sve kartice su ponovljene.</p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">Natrag</button>
        <Podnozje />
      </div>
    );
  }

  if (i >= kartice.length) {
    if (uid && !spremljeno.current) {
      spremljeno.current = true;
      punkteDazu(uid, tocno * 5);
      aktivitaetDazu(uid, kartice.length, Math.round((Date.now() - pocetak.current) / 1000));
    }
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-5xl font-semibold tracking-tight">{tocno} / {kartice.length}</p>
        <p className="mt-3 text-tiho">+{tocno * 5} bodova</p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          Natrag na početnu
        </button>
        <Podnozje />
      </div>
    );
  }

  const k = kartice[i];
  const vrsta = vrstaZadatka(k, stanje[k.id]);
  const clan = (k.de.match(/^(der|die|das)\s/i) || [])[1];
  const bezClana = k.de.replace(/^(der|die|das)\s+/i, "");

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>
          <span className="text-xs text-tiho">
            {vrsta === "tipkanje" ? "Napiši sama"
              : vrsta === "clan" ? "Koji član?" : "Prisjeti se"}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ploha">
          <div className="h-full rounded-full bg-akzent transition-all"
               style={{ width: `${((i + 1) / kartice.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-tiho">{i + 1} / {kartice.length}</p>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl md:py-10">

        {vrsta === "clan" ? (
          <>
            <p className="text-sm text-tiho">Koji član ide uz ovu riječ?</p>
            <p className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              {bezClana}
            </p>
            <p className="mt-2 text-tiho">{k.hr}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-tiho">Kako se kaže?</p>
            <p className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              {k.hr}
            </p>
          </>
        )}

        {vrsta === "tipkanje" && !otkriveno && (
          <input ref={polje} autoFocus value={upis} onChange={(e) => setUpis(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && upis.trim() && provjeriUpis()}
            placeholder="Napiši na njemačkom" autoCapitalize="off" autoCorrect="off"
            className="polje mt-6 text-lg" />
        )}

        {otkriveno && (
          <div className={`mt-6 rounded-2xl p-5 ${
            ocjena === "netocno" ? "border border-alarm/30 bg-alarm/10" : "ploca"}`}>
            {ocjena === "skoro" && (
              <p className="mb-2 text-sm font-medium text-akzent">Skoro — pazi na pisanje.</p>
            )}
            {ocjena === "netocno" && (
              <p className="mb-2 text-sm font-medium text-alarm">Nije točno.</p>
            )}
            <div className="flex items-start justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight text-akzent md:text-4xl">{k.de}</p>
              <button onClick={() => vorlesen(k.de)}
                className="shrink-0 rounded-lg border border-rub px-3 py-2 text-sm text-tiho">
                Slušaj
              </button>
            </div>
            {k.hinweis_hr && <p className="mt-3 text-sm text-tiho">{k.hinweis_hr}</p>}
            {k.beispiel && <p className="mt-2 text-sm italic text-tiho">{k.beispiel}</p>}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md md:max-w-2xl">
        {/* Artikel raten */}
        {vrsta === "clan" && !otkriveno && (
          <div className="grid grid-cols-3 gap-2">
            {["der", "die", "das"].map((c) => (
              <button key={c} onClick={async () => {
                const je = c.toLowerCase() === (clan || "").toLowerCase();
                setOcjena(je ? "tocno" : "netocno");
                setOtkriveno(true);
                await zapisi(k, je);
              }} className="knopf-leer w-full">{c}</button>
            ))}
          </div>
        )}

        {/* Selbst schreiben */}
        {vrsta === "tipkanje" && !otkriveno && (
          <button onClick={provjeriUpis} disabled={!upis.trim()}
            className="knopf-voll w-full disabled:opacity-40">
            Provjeri
          </button>
        )}

        {/* Aufdecken */}
        {vrsta === "otkrivanje" && !otkriveno && (
          <button onClick={() => { setOtkriveno(true); vorlesen(k.de); }}
            className="knopf-leer w-full">
            Pokaži rješenje
          </button>
        )}

        {/* Nach dem Aufdecken */}
        {otkriveno && vrsta === "otkrivanje" && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => dalje(false)}
              className="knopf w-full border border-alarm/30 bg-alarm/10 text-alarm">
              Nisam znala
            </button>
            <button onClick={() => dalje(true)} className="knopf-voll w-full">Znala sam</button>
          </div>
        )}
        {otkriveno && vrsta !== "otkrivanje" && (
          <button onClick={sljedeca} className="knopf-voll w-full">Dalje</button>
        )}

        <Podnozje />
      </div>
    </div>
  );
}

export default function Stranica() {
  return <Suspense fallback={null}><Ucenje /></Suspense>;
}
