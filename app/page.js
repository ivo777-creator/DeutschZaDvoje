"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Prijava() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState("");
  const [radi, setRadi] = useState(false);
  const [provjera, setProvjera] = useState(true);

  // Schon eingeloggt? Dann direkt weiter.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/start");
      else setProvjera(false);
    });
  }, [router]);

  async function prijavi() {
    setRadi(true);
    setGreska("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: lozinka
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="mb-2 text-sm text-tinta/60">Njemački od nule</p>
      <h1 className="font-display text-5xl leading-none text-tinta">
        Deutsch<br />za dvoje
      </h1>
      <p className="mt-4 max-w-xs text-tinta/70">
        Uči svaki dan sama, a jednom tjedno vježbate zajedno.
      </p>

      <div className="mt-10 space-y-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-tinta/15 bg-white px-4 py-3
                     outline-none focus:border-more"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Lozinka"
          value={lozinka}
          onChange={(e) => setLozinka(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && prijavi()}
          className="w-full rounded-xl border border-tinta/15 bg-white px-4 py-3
                     outline-none focus:border-more"
        />

        {greska && <p className="text-sm text-koral">{greska}</p>}

        <button onClick={prijavi} disabled={radi} className="knopf-voll w-full disabled:opacity-50">
          {radi ? "Trenutak..." : "Prijavi se"}
        </button>
      </div>

      <p className="mt-8 text-xs text-tinta/50">
        Prijava je potrebna samo jednom. Nakon toga ostaješ prijavljena.
      </p>
    </main>
  );
}
