"use client";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

// Deutsch vorlesen (funktioniert direkt im Browser, ohne Zusatzprogramm)
export function vorlesen(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const s = new SpeechSynthesisUtterance(text);
  s.lang = "de-DE";
  s.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(s);
}

// Punkte gutschreiben und Serie mitzaehlen
export async function punkteDazu(userId, xp) {
  const heute = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("punkte").select("*").eq("user_id", userId).maybeSingle();

  if (!data) {
    await supabase.from("punkte").insert({
      user_id: userId, xp, level: 1, serie_tage: 1,
      letzter_tag: heute, diese_woche: 1
    });
    return;
  }

  const gestern = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  let serie = data.serie_tage;
  let woche = data.diese_woche;
  if (data.letzter_tag !== heute) {
    serie = data.letzter_tag === gestern ? serie + 1 : 1;
    woche = woche + 1;
  }
  const neuXp = data.xp + xp;

  await supabase.from("punkte").update({
    xp: neuXp,
    level: Math.floor(neuXp / 200) + 1,
    serie_tage: serie,
    letzter_tag: heute,
    diese_woche: woche
  }).eq("user_id", userId);
}
