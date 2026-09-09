"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  supabase, vorlesen, punkteDazu, aktivitaetDazu, akzentSetzen
} from "../../lib/supabase";
import { Podnozje } from "../../lib/verzija";

function Ucenje() {
  const router = useRouter();
  const tema = useSearchParams().get("tema");
  const pocetak = useRef(Date.now());
  const spremljeno = useRef(false);

  const [uid, setUid] = useState(null);
  const [kartice, setKartice] = useState(null);
  const [i, setI] = useState(0);
  const [otkriveno, setOtkriveno] = useState(false);
  const [tocno, setTocno] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const id = s.session.user.id;
      setUid(id);

      const { data: p } = await supabase.from("profile")
        .select("akzent").eq("user_id", id).maybeSingle();
      akzentSetzen(p?.akzent);

      const [{ data: sve }, { data: nap }] = await Promise.all([
        supabase.from("karten").select("*").eq("thema_id", tema),
        supabase.from("fortschritt").select("karte_id, naechste_frage").eq("user_id", id)
      ]);

      const kad = {};
      (nap || []).forEach((n) => (kad[n.karte_id] = new Date(n.naechste_frage).getTime()));
      const sada = Date.now();

      const red = (sve || [])
        .filter((k) => !kad[k.id] || kad[k.id] <= sada + 864e5)
        .sort((a, b) => (kad[a.id] || 0) - (kad[b.id] || 0));

      setKartice(red.slice(0, 15));
    })();
  }, [tema, router]);

  async function odgovori(znam) {
    const k = kartice[i];
    const { data: post } = await supabase.from("fortschritt")
      .select("*").eq("user_id", uid).eq("karte_id", k.id).maybeSingle();

    const razmak = znam ? Math.min((post?.abstand_tage || 1) * 2, 60) : 1;

    await supabase.from("fortschritt").upsert({
      user_id: uid,
      karte_id: k.id,
      richtig: (post?.richtig || 0) + (znam ? 1 : 0),
      falsch: (post?.falsch || 0) + (znam ? 0 : 1),
      abstand_tage: razmak,
      naechste_frage: new Date(Date.now() + razmak * 864e5).toISOString()
    }, { onConflict: "user_id,karte_id" });

    if (znam) setTocno((n) => n + 1);
    setOtkriveno(false);
    setI((n) => n + 1);
  }

  if (kartice === null) return null;

  if (kartice.length === 0) {
    return (
      <div className="ekran items-center justify-center px-6 text-center">
        <p className="text-3xl font-semibold tracking-tight">Za danas si gotova</p>
        <p className="mt-2 text-tiho">Sve kartice iz ove teme su ponovljene.</p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">Natrag</button>
        <Podnozje />
      </div>
    );
  }

  if (i >= kartice.length) {
    if (uid && !spremljeno.current) {
      spremljeno.current = true;
      const sek = Math.round((Date.now() - pocetak.current) / 1000);
      punkteDazu(uid, tocno * 5);
      aktivitaetDazu(uid, kartice.length, sek);
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

  return (
    <div className="ekran px-5 md:px-8">
      <div className="mx-auto w-full max-w-md pt-4 md:max-w-2xl">
        <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ploha">
        <div className="h-full rounded-full bg-akzent transition-all"
             style={{ width: `${((i + 1) / kartice.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-tiho">{i + 1} / {kartice.length}</p>
      </div>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center
                      overflow-y-auto py-6 md:max-w-2xl md:py-10">
        <p className="text-sm text-tiho">Kako se kaže?</p>
        <p className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{k.hr}</p>

        {otkriveno && (
          <div className="ploca mt-6 p-5">
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
        {otkriveno ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => odgovori(false)}
              className="knopf w-full border border-alarm/30 bg-alarm/10 text-alarm">
              Nisam znala
            </button>
            <button onClick={() => odgovori(true)} className="knopf-voll w-full">Znala sam</button>
          </div>
        ) : (
          <button onClick={() => { setOtkriveno(true); vorlesen(k.de); }}
            className="knopf-leer w-full">
            Pokaži rješenje
          </button>
        )}
        <Podnozje />
      </div>
    </div>
  );
}

export default function Stranica() {
  return <Suspense fallback={null}><Ucenje /></Suspense>;
}
