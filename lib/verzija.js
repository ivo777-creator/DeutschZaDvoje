"use client";

export const VERZIJA = "2.7.0";
export const IME_APP = "Hallo-Bok";

// Steht unten auf jeder Seite.
export function Podnozje() {
  return (
    <p className="mt-8 pb-2 text-center text-[11px] text-tiho/70">
      {IME_APP} — v{VERZIJA}
    </p>
  );
}
