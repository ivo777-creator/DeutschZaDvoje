"use client";

export const VERZIJA = "2.1.2";

// Steht unten auf jeder Seite.
export function Podnozje() {
  return (
    <p className="mt-8 pb-2 text-center text-[11px] text-tiho/70">
      DeutschZaDvoje — v{VERZIJA}
    </p>
  );
}
