"use client";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

/* ---------- Deutsch vorlesen ---------- */
export function vorlesen(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const s = new SpeechSynthesisUtterance(text);
  s.lang = "de-DE";
  s.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(s);
}

/* ---------- Hell / Dunkel ---------- */
export function themaSetzen(nacin) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (nacin === "auto") {
    const tamno = window.matchMedia("(prefers-color-scheme: dark)").matches;
    el.classList.toggle("dark", tamno);
  } else {
    el.classList.toggle("dark", nacin === "dark");
  }
  try { localStorage.setItem("tema", nacin); } catch (e) {}
}

export function themaLesen() {
  try { return localStorage.getItem("tema") || "auto"; } catch (e) { return "auto"; }
}

/* ---------- Akzentfarbe pro Person ---------- */
const AKZENTI = { blau: "74 111 165", rosa: "201 113 142", zelena: "82 138 118" };
export function akzentSetzen(ime) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--akzent", AKZENTI[ime] || AKZENTI.blau);
}

/* ---------- Punkte ---------- */
export async function punkteDazu(userId, xp) {
  const heute = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("punkte").select("*").eq("user_id", userId).maybeSingle();

  if (!data) {
    await supabase.from("punkte").insert({
      user_id: userId, xp, level: 1, serie_tage: 1, letzter_tag: heute, diese_woche: 1
    });
    return;
  }
  const gestern = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  let serie = data.serie_tage, woche = data.diese_woche;
  if (data.letzter_tag !== heute) {
    serie = data.letzter_tag === gestern ? serie + 1 : 1;
    woche = woche + 1;
  }
  const neuXp = data.xp + xp;
  await supabase.from("punkte").update({
    xp: neuXp, level: Math.floor(neuXp / 200) + 1,
    serie_tage: serie, letzter_tag: heute, diese_woche: woche
  }).eq("user_id", userId);
}

/* ---------- Gewichtung für die Prognose ----------
   Eine gelernte Karte ist der Massstab. Freies Schreiben und
   Chatten helfen, bringen aber weniger neuen Wortschatz —
   sonst würde eine lange Chatrunde die Prognose schönrechnen. */
export const TEZINA = {
  kartica:  1,      // Karte gelernt
  igra:     0.5,    // Antwort in einem Spiel
  recenica: 1 / 3,  // korrigierter Satz
  poruka:   1 / 5   // eigene Nachricht im Rollenspiel
};

/* ---------- Tagesbericht mitschreiben ----------
   karten = rohe Anzahl für die Anzeige
   tezina = gewichtet, damit wird die Prognose gerechnet */
export async function aktivitaetDazu(userId, karten, sekunden, tezina) {
  const heute = new Date().toISOString().slice(0, 10);
  const t = typeof tezina === "number" ? tezina : karten * TEZINA.kartica;

  const { data } = await supabase.from("aktivitaet")
    .select("*").eq("user_id", userId).eq("datum", heute).maybeSingle();

  if (!data) {
    await supabase.from("aktivitaet")
      .insert({ user_id: userId, datum: heute, karten, sekunden, tezina: t });
  } else {
    await supabase.from("aktivitaet").update({
      karten:   data.karten   + karten,
      sekunden: data.sekunden + sekunden,
      tezina:   Number(data.tezina || 0) + t
    }).eq("user_id", userId).eq("datum", heute);
  }
}

/* ---------- Niveau-Prognose A1 bis C2 ----------
   Grundlage: wie viele Karten sitzen schon, und wie schnell
   kommen neue dazu (Schnitt der letzten 28 Tage).            */
export const NIVOI = [
  { oznaka: "A1", rijeci: 600 },
  { oznaka: "A2", rijeci: 1300 },
  { oznaka: "B1", rijeci: 2500 },
  { oznaka: "B2", rijeci: 4000 },
  { oznaka: "C1", rijeci: 6000 },
  { oznaka: "C2", rijeci: 8000 }
];

function uVrijeme(dana) {
  if (dana <= 0) return "gotovo";
  if (dana < 14) return dana + " dana";
  if (dana < 60) return Math.round(dana / 7) + " tjedana";
  if (dana < 730) return Math.round(dana / 30) + " mjeseci";
  const god = (dana / 365).toFixed(1).replace(".0", "");
  return god + " godina";
}

export function prognoza(znaneRijeci, tempoDnevno) {
  const tempo = Math.max(tempoDnevno, 0.4);
  return NIVOI.map(function (n) {
    const ostalo = Math.max(n.rijeci - znaneRijeci, 0);
    const dana = Math.ceil(ostalo / tempo);
    return { oznaka: n.oznaka, rijeci: n.rijeci, gotovo: ostalo === 0, dana: dana, kada: uVrijeme(dana) };
  });
}

export function minute(sekunden) {
  const m = Math.round(sekunden / 60);
  return m < 1 ? "manje od minute" : m + " min";
}
