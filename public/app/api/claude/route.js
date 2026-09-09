/* Läuft auf dem Server. Der Schlüssel bleibt hier und
   ist im Browser nicht sichtbar. */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5-20251001";

const SITUACIJE = {
  ured:      "u uredu, kolega/kolegica na poslu",
  radionica: "u auto-radionici, ti si automehaničar",
  policija:  "policijska kontrola u prometu, ti si policajac",
  cvijece:   "u cvjećarnici, ti si prodavač/ica",
  recepcija: "na recepciji hotela, ti si gost",
  lijecnik:  "kod liječnika, ti si liječnik/ica",
  trgovina:  "u supermarketu, ti si prodavač/ica",
  restoran:  "u restoranu, ti si konobar/ica"
};

async function pitajClaude(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ greska: "Nedostaje ključ na serveru." }, { status: 500 });
  }

  try {
    const { nacin, zadatak, tekst, situacija, povijest } = await req.json();

    /* ---------- Freies Schreiben mit Korrektur ---------- */
    if (nacin === "ispravak") {
      const upute = `Ti si strpljiv učitelj njemačkog za početnicu (nivo A1) kojoj je materinji jezik hrvatski.

Zadatak koji je dobila: "${zadatak}"
Ono što je napisala: "${tekst}"

Odgovori ISKLJUČIVO JSON objektom, bez ikakvog uvoda i bez markdown oznaka:
{
  "ocjena": "dobro" | "skoro" | "pokusaj_ponovno",
  "ispravak": "njezina rečenica ispravljena na njemačkom",
  "objasnjenje": "na HRVATSKOM, najviše 2 kratke rečenice, objasni glavnu grešku jednostavno, bez gramatičkih stručnih izraza",
  "pohvala": "na HRVATSKOM, jedna kratka rečenica o tome što je dobro napravila"
}

Pravila:
- Budi blag. Ako je poruka razumljiva, "ocjena" je "dobro" ili "skoro".
- Ne ispravljaj sve sitnice odjednom, nego samo najvažnije.
- Ispravak drži na nivou A1, jednostavno.`;

      const odgovor = await pitajClaude({
        model: MODEL, max_tokens: 500,
        messages: [{ role: "user", content: upute }]
      });

      const cisto = odgovor.replace(/```json|```/g, "").trim();
      return Response.json(JSON.parse(cisto));
    }

    /* ---------- Rollenspiel ---------- */
    if (nacin === "razgovor") {
      const scena = SITUACIJE[situacija] || SITUACIJE.trgovina;

      const sustav = `Igraš ulogu u kratkom razgovoru na njemačkom. Situacija: ${scena}.

Sugovornica je početnica na nivou A1 kojoj je materinji jezik hrvatski.

Pravila:
- Piši SAMO na njemačkom, vrlo jednostavno, najviše 2 kratke rečenice po odgovoru.
- Koristi rječnik nivoa A1. Nikad duge ili složene rečenice.
- Ostani u ulozi. Ne objašnjavaj gramatiku i ne prevodi.
- Uvijek završi pitanjem, da razgovor teče dalje.
- Ako ona napravi grešku, svejedno odgovori prirodno u ulozi.
- Ako ona napiše nešto na hrvatskom, kratko je na njemačkom pitaj isto to jednostavnije.`;

      const poruke = (povijest || []).map((p) => ({
        role: p.od === "ja" ? "user" : "assistant",
        content: p.tekst
      }));

      const odgovor = await pitajClaude({
        model: MODEL, max_tokens: 300,
        system: sustav,
        messages: poruke.length ? poruke
          : [{ role: "user", content: "Počni razgovor." }]
      });

      return Response.json({ tekst: odgovor.trim() });
    }

    /* ---------- Übersetzungshilfe im Chat ---------- */
    if (nacin === "prijevod") {
      const odgovor = await pitajClaude({
        model: MODEL, max_tokens: 200,
        messages: [{
          role: "user",
          content: `Prevedi ovu njemačku rečenicu na hrvatski, samo prijevod bez ičega drugog: "${tekst}"`
        }]
      });
      return Response.json({ tekst: odgovor.trim() });
    }

    return Response.json({ greska: "Nepoznat način." }, { status: 400 });

  } catch (e) {
    return Response.json({ greska: "Nešto nije uspjelo. Pokušaj ponovno." }, { status: 500 });
  }
}
