"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  supabase, akzentSetzen, punkteDazu, aktivitaetDazu, vorlesen, TEZINA
} from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";
import {
  staza, trenutnoNiveau, karteNivoa, vrstaPitanja, usporedi,
  SEKCIJE, ISPIT_SEKCIJA, ISPIT_VELIKI, ISPIT_PRAG
} from "../../lib/nivoi";

function izmijesaj(n) { return [...n].sort(() => Math.random() - 0.5); }

function Ispit() {
  const router = useRouter();
  const sekcija = useSearchParams().get("sekcija");   // null = grosse Prüfung
  const veliki = !sekcija;

  const pocetak = useRef(Date.now());
  const spremljeno = useRef(false);

  const [ja, setJa] = useState(null);
  const [niveau, setNiveau] = useState("A1");
  const [pitanja, setPitanja] = useState(null);
  const [zabrana, setZabrana] = useState(null);
  const [i, setI] = useState(0);
  const [odabrano, setOdabrano] = useState(null);
  const [upis, setUpis] = useState("");
  const [tocno, setTocno] = useState(0);
  const [gotovo, setGotovo] = useState(false);

  const imeSekcije = SEKCIJE.find((s) => s.kljuc === sekcija)?.ime || "";

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;

      const [{ data: p }, { data: teme }, { data: karte }, { data: nap }, { data: isp }] =
        await Promise.all([
          supabase.from("profile").select("*").eq("user_id", uid).maybeSingle(),
          supabase.from("themen").select("*").order("reihenfolge"),
          supabase.from("karten").select("*"),
          supabase.from("fortschritt").select("*").eq("user_id", uid),
          supabase.from("pruefungen").select("*").eq("user_id", uid)
        ]);

      setJa(p || { user_id: uid, name: "" });
      akzentSetzen(p?.akzent);
      const n = trenutnoNiveau(isp);
      setNiveau(n);

      const st = staza(karte || [], teme || [], nap || [], n, isp || []);

      /* Darf sie hier überhaupt sein? */
      if (veliki && !st.velikiIspitOtvoren) {
        setZabrana(!st.dovoljnoGradiva
          ? `Za pravi ispit ${n} treba najmanje ${st.trebaRijeci} riječi. Trenutno ih ima ${st.ukupnoRijeci}. Ispit se otvara kad gradivo bude potpuno.`
          : "Prvo treba položiti sva tri dijela.");
        return;
      }
      if (sekcija) {
        const s2 = st.sekcije.find((x) => x.kljuc === sekcija);
        if (!s2?.sveRazine) {
          setZabrana("Prvo treba završiti sve razine u ovom dijelu.");
          return;
        }
      }

      const pool = sekcija
        ? st.sekcije.find((x) => x.kljuc === sekcija).karte
        : karteNivoa(karte || [], teme || [], n);

      const koliko = veliki ? ISPIT_VELIKI : ISPIT_SEKCIJA;
      const izbor = izmijesaj(pool).slice(0, koliko);

      setPitanja(izbor.map((k, idx) => {
        const vrsta = vrstaPitanja(k, idx, veliki);
        const krivi = izmijesaj(pool.filter((x) => x.id !== k.id))
          .slice(0, 3).map((x) => x.de);
        return { karta: k, vrsta, opcije: izmijesaj([k.de, ...krivi]) };
      }));
    })();
  }, [router, sekcija, veliki]);

  function naprijed(je) {
    if (je) setTocno((n) => n + 1);
    const novi = tocno + (je ? 1 : 0);
    setTimeout(() => {
      if (i + 1 >= pitanja.length) zavrsi(novi);
      else { setI(i + 1); setOdabrano(null); setUpis(""); }
    }, 1000);
  }

  function odgovoriIzbor(o) {
    if (odabrano) return;
    setOdabrano(o);
    vorlesen(pitanja[i].karta.de);
    naprijed(o === pitanja[i].karta.de);
  }

  function odgovoriUpis() {
    if (odabrano) return;
    const rez = usporedi(upis, pitanja[i].karta.de);
    setOdabrano(rez);
    vorlesen(pitanja[i].karta.de);
    naprijed(rez !== "netocno");
  }

  function odgovoriClan(c) {
    if (odabrano) return;
    const tocan = (pitanja[i].karta.de.match(/^(der|die|das)\s/i) || [])[1];
    setOdabrano(c);
    vorlesen(pitanja[i].karta.de);
    naprijed(c.toLowerCase() === (tocan || "").toLowerCase());
  }

  async function zavrsi(konacno) {
    if (spremljeno.current) return;
    spremljeno.current = true;
    const proslo = konacno / pitanja.length >= ISPIT_PRAG;

    await supabase.from("pruefungen").insert({
      user_id: ja.user_id, niveau, sekcija: sekcija || null,
      richtig: konacno, gesamt: pitanja.length, bestanden: proslo
    });
    await punkteDazu(ja.user_id, proslo ? (veliki ? 500 : 200) : 50);
    await aktivitaetDazu(ja.user_id, pitanja.length,
      Math.round((Date.now() - pocetak.current) / 1000), pitanja.length * TEZINA.kartica);

    setTocno(konacno);
    setGotovo(true);
  }

  /* ---------- Gesperrt ---------- */
  if (zabrana) {
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-3xl font-semibold tracking-tight">Još nije otvoreno</p>
        <p className="mt-3 max-w-xs text-tiho">{zabrana}</p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">Natrag</button>
        <Podnozje />
      </div>
    );
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
          <p className="mt-3 text-tiho">{tocno} od {pitanja.length}. Za prolaz treba 80%.</p>
          <p className="mt-6 max-w-xs text-sm text-tiho">
            Ponovi kartice koje te čekaju i probaj opet. Ispit se može ponavljati.
          </p>
          <button onClick={() => router.push("/start")} className="knopf-voll mt-8">Natrag</button>
          <Podnozje />
        </div>
      );
    }

    return (
      <div className="ekran items-center justify-center overflow-hidden px-6 text-center">
        {veliki && (
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
        )}

        <p className="slavlje text-5xl font-semibold tracking-tight">
          {veliki ? "Bravo!" : "Prošla si!"}
        </p>
        <p className="mt-2 text-tiho">
          {veliki ? `Položila si cijeli ${niveau}.` : `Dio "${imeSekcije}" je gotov.`}
        </p>

        {veliki && (
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
        )}

        {!veliki && (
          <p className="mt-4 text-sm text-tiho">{tocno} od {pitanja.length} · {postotak}%</p>
        )}

        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          {veliki ? "Dalje na sljedeći nivo" : "Natrag na put"}
        </button>
        <Podnozje />
      </div>
    );
  }

  /* ---------- Laufende Prüfung ---------- */
  const p = pitanja[i];
  const bezClana = p.karta.de.replace(/^(der|die|das)\s+/i, "");

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {veliki ? `Veliki ispit ${niveau}` : `Ispit — ${imeSekcije}`}
          </p>
          <p className="text-sm text-tiho">{i + 1} / {pitanja.length}</p>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ploha">
          <div className="h-full rounded-full bg-akzent transition-all"
               style={{ width: `${((i + 1) / pitanja.length) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl">
        <p className="text-sm text-tiho">
          {p.vrsta === "clan" ? "Koji član?"
            : p.vrsta === "tipkanje" ? "Napiši na njemačkom" : "Kako se kaže?"}
        </p>
        <p className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {p.vrsta === "clan" ? bezClana : p.karta.hr}
        </p>
        {p.vrsta === "clan" && <p className="mt-2 text-tiho">{p.karta.hr}</p>}

        {p.vrsta === "tipkanje" && !odabrano && (
          <input autoFocus value={upis} onChange={(e) => setUpis(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && upis.trim() && odgovoriUpis()}
            placeholder="Napiši ovdje" autoCapitalize="off" autoCorrect="off"
            className="polje mt-6 text-lg" />
        )}

        {odabrano && p.vrsta !== "izbor" && (
          <div className={`mt-6 rounded-2xl p-5 ${
            odabrano === "netocno" ||
            (p.vrsta === "clan" && odabrano.toLowerCase() !==
              (p.karta.de.match(/^(der|die|das)\s/i) || [])[1]?.toLowerCase())
              ? "border border-alarm/30 bg-alarm/10" : "ploca"}`}>
            <p className="text-2xl font-semibold tracking-tight text-akzent">{p.karta.de}</p>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md space-y-2 md:max-w-2xl">
        {p.vrsta === "izbor" && p.opcije.map((o) => {
          const je = o === p.karta.de;
          const boja = !odabrano ? "ploca"
            : je ? "border border-akzent bg-akzent/15"
            : o === odabrano ? "border border-alarm/40 bg-alarm/10" : "ploca opacity-40";
          return (
            <button key={o} onClick={() => odgovoriIzbor(o)} disabled={!!odabrano}
              className={`w-full rounded-2xl p-4 text-left font-medium ${boja}`}>{o}</button>
          );
        })}

        {p.vrsta === "clan" && !odabrano && (
          <div className="grid grid-cols-3 gap-2">
            {["der", "die", "das"].map((c) => (
              <button key={c} onClick={() => odgovoriClan(c)} className="knopf-leer w-full">{c}</button>
            ))}
          </div>
        )}

        {p.vrsta === "tipkanje" && !odabrano && (
          <button onClick={odgovoriUpis} disabled={!upis.trim()}
            className="knopf-voll w-full disabled:opacity-40">Provjeri</button>
        )}

        <Podnozje />
      </div>
    </div>
  );
}

export default function Stranica() {
  return <Suspense fallback={null}><Ispit /></Suspense>;
}
