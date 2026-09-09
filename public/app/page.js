"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { Podnozje } from "../lib/verzija";

export default function Prijava() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState("");
  const [radi, setRadi] = useState(false);
  const [provjera, setProvjera] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/start");
      else setProvjera(false);
    });
  }, [router]);

  async function prijavi() {
    setRadi(true); setGreska("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password: lozinka
    });
    if (error) {
      setGreska("Email ili lozinka nisu točni. Pokušaj ponovno.");
      setRadi(false);
      return;
    }
    router.replace("/start");
  }

  if (provjera) return null;

  return (
    <main className="ekran mx-auto max-w-md justify-center px-6">
      <h1 className="text-[2.75rem] font-semibold leading-[1.05] tracking-tight">
        Hallo-Bok!
      </h1>
      <p className="mt-4 text-lg text-tiho">Uči sama, a i skupa s Ivom.</p>

      <div className="mt-10 space-y-3">
        <input type="email" inputMode="email" autoComplete="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} className="polje" />
        <input type="password" autoComplete="current-password" placeholder="Lozinka"
          value={lozinka} onChange={(e) => setLozinka(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && prijavi()} className="polje" />

        {greska && <p className="text-sm text-alarm">{greska}</p>}

        <button onClick={prijavi} disabled={radi}
          className="knopf-voll w-full disabled:opacity-50">
          {radi ? "Trenutak..." : "Prijavi se"}
        </button>
      </div>

      <p className="mt-8 text-xs text-tiho">
        Prijava je potrebna samo jednom.
      </p>
      <p className="mt-3 text-xs text-tiho/70">
        Za malu Mariju.
      </p>
      <Podnozje />
    </main>
  );
}
