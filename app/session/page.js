"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, vorlesen, punkteDazu } from "../../lib/supabase";

export default function Sesija() {
  const router = useRouter();
  const [ja, setJa] = useState(null);
  const [teme, setTeme] = useState([]);
  const [sesija, setSesija] = useState(null);
  const [karte, setKarte] = useState({});     // id -> Karte
  const [tocno, setTocno] = useState(0);
  const bodoviDani = useRef(false);

  const trainer = ja?.rolle === "trainer";

  // ---- Start: wer bin ich, gibt es schon eine offene Stunde? ----
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/");
      const uid = s.session.user.id;

      const { data: p } = await supabase
        .from("profile").select("*").eq("user_id", uid).maybeSingle();
      setJa(p || { user_id: uid, name: "", rolle: "schueler" });

      const { data: t } = await supabase.from("themen").select("*").order("reihenfolge");
      setTeme(t || []);

      const { data: offen } = await supabase
        .from("sessions").select("*").eq("status", "offen")
        .order("gestartet", { ascending: false }).limit(1);
      if (offen?.[0]) ucitaj(offen[0]);
    })();
  }, [router]);

  // ---- Karten einer Stunde nachladen ----
  async function ucitaj(row) {
    setSesija(row);
    if (row.karten_ids?.length) {
      const { data } = await supabase.from("karten").select("*").in("id", row.karten_ids);
      const map = {};
      (data || []).forEach((k) => (map[k.id] = k));
      setKarte(map);
    }
  }

  // ---- Live mitverfolgen: was der Trainer tut, sieht Niki sofort ----
  useEffect(() => {
    if (!sesija?.id) return;
    const kanal = supabase
      .channel(`sesija-${sesija.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sesija.id}` },
        (p) => setSesija(p.new)
      )
      .subscribe();
    return () => { supabase.removeChannel(kanal); };
  }, [sesija?.id]);

  // ---- Wartet Niki? Dann auf eine neue Stunde horchen ----
  useEffect(() => {
    if (sesija || !ja || trainer) return;
    const kanal = supabase
      .channel("nova-sesija")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sessions" },
        (p) => ucitaj(p.new)
      )
      .subscribe();
    return () => { supabase.removeChannel(kanal); };
  }, [sesija, ja, trainer]);

  // ---- Punkte am Ende, für jeden selbst ----
  useEffect(() => {
    if (sesija?.status === "fertig" && ja && !bodoviDani.current) {
      bodoviDani.current = true;
      punkteDazu(ja.user_id, Math.max(10, tocno * 5));
    }
  }, [sesija?.status, ja, tocno]);

  // ---- Trainer: Stunde starten ----
  const pokreni = useCallback(async (temaId) => {
    const { data: k } = await supabase.from("karten").select("id").eq("thema_id", temaId);
    const ids = (k || []).map((x) => x.id).sort(() => Math.random() - 0.5).slice(0, 20);

    const { data: uc } = await supabase
      .from("profile").select("user_id").eq("rolle", "schueler").maybeSingle();

    const { data, error } = await supabase.from("sessions").insert({
      trainer_id: ja.user_id,
      schueler_id: uc?.user_id ?? ja.user_id,
      thema_id: temaId,
      karten_ids: ids,
      position: 0
    }).select().single();

    if (!error) ucitaj(data);
  }, [ja]);

  // ---- Trainer: Steuerung ----
  async function pokaziRjesenje() {
    await supabase.from("sessions").update({ loesung_sichtbar: true }).eq("id", sesija.id);
    setSesija({ ...sesija, loesung_sichtbar: true });
  }

  async function ocijeni(bilo) {
    const id = sesija.karten_ids[sesija.position];
    await supabase.from("session_antworten").insert({
      session_id: sesija.id, karte_id: id, richtig: bilo
    });
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

  // ================= Themenauswahl (nur Trainer) =================
  if (!sesija) {
    return (
      <main className="mx-auto max-w-md px-6 pt-10">
        <button onClick={() => router.push("/start")} className="text-sm text-tinta/50">
          ← Natrag
        </button>

        {trainer ? (
          <>
            <h1 className="mt-4 font-display text-3xl">Odaberi temu</h1>
            <p className="mt-1 text-sm text-tinta/60">20 kartica, nasumično poredanih.</p>
            <div className="mt-6 space-y-2">
              {teme.map((t) => (
                <button key={t.id} onClick={() => pokreni(t.id)}
                  className="w-full rounded-xl bg-white p-4 text-left hover:bg-white/60">
                  <span className="block font-medium">{t.titel_hr}</span>
                  <span className="block text-sm text-tinta/50">{t.titel_de}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-24 text-center">
            <p className="font-display text-3xl">Još nije počelo</p>
            <p className="mt-2 text-tinta/60">
              Ova stranica se sama otvori čim Ivo pokrene sat.
            </p>
          </div>
        )}
      </main>
    );
  }

  // ================= Auswertung =================
  if (sesija.status === "fertig") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="font-display text-5xl">Gotovo!</p>
        <p className="mt-3 text-tinta/70">
          {sesija.karten_ids.length} kartica riješeno. Bodovi su zapisani.
        </p>
        <button onClick={() => router.push("/start")} className="knopf-voll mt-8">
          Natrag na početnu
        </button>
      </main>
    );
  }

  // ================= Laufende Stunde =================
  const k = karte[sesija.karten_ids[sesija.position]];
  if (!k) return null;
  const napredak = ((sesija.position + 1) / sesija.karten_ids.length) * 100;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-8">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full bg-more transition-all" style={{ width: `${napredak}%` }} />
      </div>
      <p className="mt-2 text-xs text-tinta/50">
        {sesija.position + 1} / {sesija.karten_ids.length}
      </p>

      {/* Karte */}
      <div className="mt-10 flex flex-1 flex-col justify-center">
        <p className="text-sm text-tinta/50">Kako se kaže?</p>
        <p className="mt-2 font-display text-4xl leading-tight">{k.hr}</p>

        {(trainer || sesija.loesung_sichtbar) && (
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

      {/* Steuerung nur beim Trainer */}
      {trainer ? (
        <div className="mt-8 space-y-3">
          {!sesija.loesung_sichtbar && (
            <button onClick={pokaziRjesenje} className="knopf-leer w-full">
              Lösung für Niki zeigen
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => ocijeni(false)}
              className="knopf w-full bg-koral/10 text-koral">
              Nochmal üben
            </button>
            <button onClick={() => ocijeni(true)} className="knopf-voll w-full">
              Sass
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-center text-sm text-tinta/50">
          {sesija.loesung_sichtbar ? "Ponovi naglas." : "Reci naglas, pa Ivo otkriva rješenje."}
        </p>
      )}
    </main>
  );
}
