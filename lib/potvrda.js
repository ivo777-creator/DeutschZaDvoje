"use client";

/* Urkunde als PDF oder Bild.
   Die zwei Bibliotheken werden erst beim Klick geladen —
   so wird die App dadurch nicht langsamer. */

function ucitajSkriptu(src) {
  return new Promise((ok, ne) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => ok();
    s.onerror = ne;
    document.head.appendChild(s);
  });
}

async function uCanvas(el) {
  await ucitajSkriptu("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  return window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
}

/* --- PDF, quer, A4 --- */
export async function spremiPdf(el, ime, niveau) {
  const canvas = await uCanvas(el);
  await ucitajSkriptu("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const sirinaStr = 297, visinaStr = 210;
  const omjer = canvas.height / canvas.width;
  const rub = 15;
  let s = sirinaStr - rub * 2;
  let v = s * omjer;
  if (v > visinaStr - rub * 2) { v = visinaStr - rub * 2; s = v / omjer; }

  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG",
    (sirinaStr - s) / 2, (visinaStr - v) / 2, s, v);
  pdf.save(`Hallo-Bok-${niveau}-${(ime || "potvrda").replace(/\s+/g, "-")}.pdf`);
}

/* --- Bild: auf dem iPhone direkt ins Teilen-Menü --- */
export async function spremiSliku(el, ime, niveau) {
  const canvas = await uCanvas(el);
  const naziv = `Hallo-Bok-${niveau}-${(ime || "potvrda").replace(/\s+/g, "-")}.png`;

  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) return;

  const file = new File([blob], naziv, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch { /* abgebrochen */ }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = naziv;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* --- Die Vorlage. Steht ausserhalb des Bildschirms und
       hat feste helle Farben, damit das PDF im Dunkelmodus
       nicht schwarz wird. --- */
export function PredlozakPotvrde({ innerRef, ime, niveau, tocno, ukupno, datum }) {
  const postotak = Math.round((tocno / ukupno) * 100);
  return (
    <div style={{ position: "absolute", left: "-10000px", top: 0 }} aria-hidden="true">
      <div ref={innerRef} style={{
        width: "1000px", height: "700px", background: "#FFFFFF",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
        color: "#1B2230", padding: "60px", boxSizing: "border-box",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        border: "10px solid #4A6FA5"
      }}>
        <p style={{ margin: 0, fontSize: "18px", letterSpacing: "8px",
                    textTransform: "uppercase", color: "#6E798C" }}>Potvrda</p>

        <p style={{ margin: "34px 0 0", fontSize: "150px", fontWeight: 600,
                    lineHeight: 1, letterSpacing: "-4px", color: "#4A6FA5" }}>{niveau}</p>

        <p style={{ margin: "34px 0 0", fontSize: "26px", color: "#6E798C" }}>
          Njemački jezik — položeno
        </p>

        <p style={{ margin: "26px 0 0", fontSize: "56px", fontWeight: 600,
                    letterSpacing: "-1px" }}>{ime}</p>

        <p style={{ margin: "22px 0 0", fontSize: "24px", color: "#6E798C" }}>
          {tocno} od {ukupno} točnih odgovora · {postotak}%
        </p>

        <div style={{ marginTop: "50px", paddingTop: "26px",
                      borderTop: "2px solid #E0E5EE", width: "460px" }}>
          <p style={{ margin: 0, fontSize: "20px", color: "#6E798C" }}>
            {datum} · Hallo-Bok
          </p>
        </div>
      </div>
    </div>
  );
}
