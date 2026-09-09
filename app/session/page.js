"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  supabase, vorlesen, punkteDazu, aktivitaetDazu, akzentSetzen
} from "../../lib/supabase";

export default function Sesija() {
  const router = useRouter();
  const pocetak = useRef(Date.now());
  const spremljeno = useRef(false);

  const [ja, setJa] = useState(null);
  const [teme, setTeme] = useState([]);
  const [sesija, setSesija] = useState(null);
  const [karte, setKarte] = useState({});
  const [tocno, setTocno] = useState(0);

  const trainer = ja?.rolle === "trainer";

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;

      const { data: p } = await supabase.from("profile")
        .select("*").eq("user_id", uid).maybeSingle();
      setJa(p || { user_id: uid, name: "", rolle: null, akzent: "blau" });
      akzentSetzen(p?.akzent);

      const { data: t } = await supabase.from("themen").select("*").order("reihenfolge");
      setTeme(t || []);

      const { data: offen } = await supabase.from("sessions").select("*")
        .eq("status", "offen").order("gestartet", { ascending: false }).limit(1);
      if (offen?.[0]) ucitaj(offen[0]);
    })();
  }, [router]);

  async function ucitaj(row) {
    setSesija(row);
    if (row.karten_ids?.length) {
      const { data } = await supabase.from("karten").select("*").in("id", row.karten_ids);
      const map = {};
      (data || []).forEach((k) => (map[k.id] = k));
      setKarte(map);
    }
  }

  useEffect(() => {
    if (!sesija?.id) return;
    const kanal = supabase.channel(`sesija-${sesija.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sesija.id}` },
        (p) => setSesija(p.new))
      .subscribe();
    return () => { supabase.removeChannel(kanal); };
  }, [sesija?.id]);

  useEffect(() => {
    if (sesija || !ja || trainer) return;
    const kanal = supabase.channel("nova-sesija")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "sessions" },
        (p) => ucitaj(p.new))
      .subscribe();
    return () => { supabase.removeChannel(kanal); };
  }, [sesija, ja, trainer]);

  useEffect(() => {
    if (sesija?.status === "fertig" && ja && !spremljeno.current) {
      spremljeno.current = true;
      const sek = Math.round((Date.now() - pocetak.current) / 1000);
      punkteDazu(ja.user_id, Math.max(10, tocno * 5));
      aktivitaetDazu(ja.user_id, sesija.karten_ids.length, sek);
    }
  }, [sesija?.status, ja, tocno]);

  const pokreni = useCallback(async (temaId) => {
    const { data: k } = await supabase.from("karten").select("id").eq("thema_id", temaId);
    const ids = (k || []).map((x) => x.id).sort(() => Math.random() - 0.5).slice(0, 20);

    const { data: uc } = await supabase.from("profile")
      .select("user_id").eq("rolle", "schueler").maybeSingle();

    const { data, error } = await supabase.from("sessions").insert({
      trainer_id: ja.user_id,
      schueler_id: uc?.user_id ?? ja.user_id,
      thema_id: temaId, karten_ids: ids, position: 0
    }).select().single();

    if (!error) ucitaj(data);
  }, [ja]);

  async function pokaziRjesenje() {
    await supabase.from("sessions").update({ loesung_sichtbar: true }).eq("id", sesija.id);
    setSesija({ ...sesija, loesung_sichtbar: true });
  }

  async function ocijeni(bilo) {
    const id = sesija.karten_ids[sesija.position];
    await supabase.from("session_antworten")
      .insert({ session_id: sesija.id, karte_id: id, richtig: bilo });
    if (bilo) setTocno((n) => n + 1);

    const sljedeca = sesija.position + 1;
    const gotovo = sljedeca >= sesija.karten_ids.length;
    const izmjena = gotovo
      ? { status: "fertig", beendet: new Date().toISOString(), loesung_sichtbar: false }
      : { position: sljedeca, loesung_sichtbar: false };

    await supabase.from("sessions").update(izmjena).eq("id", sesija.id);
    setSesija({ ...sesija, ...izmjena });
  }

  if (!ja) return null;

  /* -------- Noch keine Stunde -------- */
  if (!sesija) {
    return (
      <main className="mx-auto max-w-md px-5 pt-8">
        <button onClick={() => router.push("/start")} className="text-sm text-tiho">← Natrag</button>

        {ja.rolle === null && (
          <div className="mt-6 rounded-2xl border border-alarm/30 bg-alarm/10 p-4 text-sm">
            Tvoj račun još nema ulogu u tablici <strong>profile</strong>.
            Bez toga se sat ne može pokrenuti.
          </div>
        )}

        {trainer ? (
          <>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">Odaberi temu</h1>
            <p className="mt-1 text-sm text-tiho">20 kartica, nasumično poredanih.</p>
            <div className="mt-6 space-y-2">
              {teme.map((t) => (
                <button key={t.id} onClick={() => pokreni(t.id)}
                  className="ploca w-full p-4 text-left">
                  <span className="block font-medium">{t.titel_hr}</span>
                  <span className="block text-sm text-tiho">{t.titel_de}</span>
                </button>
              ))}
            </div>
          </>
        ) : ja.rolle === "schueler" ? (
          <div className="mt-24 text-center">
            <p className="text-3xl font-semibold tracking-tight">Još nije počelo</p>
            <p className="mt-2 text-tiho">Stranica se sama otvori čim Ivo pokrene sat.</p>
          </div>
        ) : null}
      </main>
    );
  }

  /* -------- Auswertung -------- */
  if (sesija.status === "fertig") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="text-5xl font-semibold tracking-tight">Gotovo!</p>
        <p className="mt-3 text-tiho">
          {sesija.karten_ids.length} kartica riješeno. Bodovi su zapisani.
        </p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          Natrag na početnu
        </button>
      </main>
    );
  }

  /* -------- Laufende Stunde -------- */
  const k = karte[sesija.karten_ids[sesija.position]];
  if (!k) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ploha">
        <div className="h-full rounded-full bg-akzent transition-all"
             style={{ width: `${((sesija.position + 1) / sesija.karten_ids.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-tiho">
        {sesija.position + 1} / {sesija.karten_ids.length}
      </p>

      <div className="mt-8 flex flex-1 flex-col justify-center">
        <p className="text-sm text-tiho">Kako se kaže?</p>
        <p className="mt-2 text-4xl font-semibold leading-tight tracking-tight">{k.hr}</p>

        {(trainer || sesija.loesung_sichtbar) && (
          <div className="ploca mt-8 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight text-akzent">{k.de}</p>
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

      {trainer ? (
        <div className="mt-8 space-y-3">
          {!sesija.loesung_sichtbar && (
            <button onClick={pokaziRjesenje} className="knopf-leer w-full">
              Lösung für Niki zeigen
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => ocijeni(false)}
              className="knopf w-full border border-alarm/30 bg-alarm/10 text-alarm">
              Nochmal üben
            </button>
            <button onClick={() => ocijeni(true)} className="knopf-voll w-full">Sass</button>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-tiho">
          {sesija.loesung_sichtbar ? "Ponovi naglas." : "Reci naglas, pa Ivo otkriva rješenje."}
        </p>
      )}
    </main>
  );
}
