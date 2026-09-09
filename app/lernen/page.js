"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, vorlesen, punkteDazu } from "../../lib/supabase";

function Ucenje() {
  const router = useRouter();
  const tema = useSearchParams().get("tema");

  const [uid, setUid] = useState(null);
  const [kartice, setKartice] = useState([]);
  const [i, setI] = useState(0);
  const [otkriveno, setOtkriveno] = useState(false);
  const [tocno, setTocno] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      setUid(s.session.user.id);

      // Zuerst das, was heute fällig ist, dann neue Karten.
      const { data: sve } = await supabase
        .from("karten").select("*").eq("thema_id", tema);
      const { data: nap } = await supabase
        .from("fortschritt").select("karte_id, naechste_frage")
        .eq("user_id", s.session.user.id);

      const kad = {};
      (nap || []).forEach((n) => (kad[n.karte_id] = n.naechste_frage));
      const sada = Date.now();

      const red = (sve || []).sort((a, b) => {
        const va = kad[a.id] ? new Date(kad[a.id]).getTime() : 0;
        const vb = kad[b.id] ? new Date(kad[b.id]).getTime() : 0;
        return va - vb;
      }).filter((k) => !kad[k.id] || new Date(kad[k.id]).getTime() <= sada + 864e5);

      setKartice(red.slice(0, 15));
    })();
  }, [tema, router]);

  async function odgovori(znam) {
    const k = kartice[i];

    const { data: post } = await supabase.from("fortschritt")
      .select("*").eq("user_id", uid).eq("karte_id", k.id).maybeSingle();

    const razmak = znam ? Math.min((post?.abstand_tage || 1) * 2, 60) : 1;
    const sljedeci = new Date(Date.now() + razmak * 864e5).toISOString();

    await supabase.from("fortschritt").upsert({
      user_id: uid,
      karte_id: k.id,
      richtig: (post?.richtig || 0) + (znam ? 1 : 0),
      falsch: (post?.falsch || 0) + (znam ? 0 : 1),
      abstand_tage: razmak,
      naechste_frage: sljedeci
    }, { onConflict: "user_id,karte_id" });

    if (znam) setTocno((n) => n + 1);
    setOtkriveno(false);
    setI((n) => n + 1);
  }

  if (!kartice.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="font-display text-3xl">Za danas si gotova</p>
        <p className="mt-2 text-tinta/60">Sve kartice iz ove teme su ponovljene.</p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          Natrag
        </button>
      </main>
    );
  }

  if (i >= kartice.length) {
    if (uid) punkteDazu(uid, tocno * 5);
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="font-display text-5xl">{tocno} / {kartice.length}</p>
        <p className="mt-3 text-tinta/70">+{tocno * 5} bodova</p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          Natrag na početnu
        </button>
      </main>
    );
  }

  const k = kartice[i];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-8">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full bg-more transition-all"
             style={{ width: `${((i + 1) / kartice.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-tinta/50">{i + 1} / {kartice.length}</p>

      <div className="flex flex-1 flex-col justify-center">
        <p className="text-sm text-tinta/50">Kako se kaže?</p>
        <p className="mt-2 font-display text-4xl leading-tight">{k.hr}</p>

        {otkriveno && (
          <div className="mt-8 rounded-2xl bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-3xl text-more">{k.de}</p>
              <button onClick={() => vorlesen(k.de)}
                className="shrink-0 rounded-lg border border-tinta/15 px-3 py-2 text-sm">
                Slušaj
              </button>
            </div>
            {k.hinweis_hr && <p className="mt-3 text-sm text-tinta/60">{k.hinweis_hr}</p>}
            {k.beispiel && <p className="mt-2 text-sm italic text-tinta/50">{k.beispiel}</p>}
          </div>
        )}
      </div>

      {otkriveno ? (
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button onClick={() => odgovori(false)} className="knopf w-full bg-koral/10 text-koral">
            Nisam znala
          </button>
          <button onClick={() => odgovori(true)} className="knopf-voll w-full">
            Znala sam
          </button>
        </div>
      ) : (
        <button onClick={() => { setOtkriveno(true); vorlesen(k.de); }}
                className="knopf-leer mt-8 w-full">
          Pokaži rješenje
        </button>
      )}
    </main>
  );
}

export default function Stranica() {
  return <Suspense fallback={null}><Ucenje /></Suspense>;
}
