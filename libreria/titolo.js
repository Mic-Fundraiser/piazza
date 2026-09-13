/*
 * Il titolo di una raccolta.
 */
/**
 * Un titolo che distingua una raccolta dall'altra.
 *
 * `document.title` non serve: su Facebook una pagina di post resta spesso
 * «Facebook» o «(3) Facebook», perche l'applicazione non lo aggiorna navigando,
 * e cosi ogni raccolta finiva chiamata allo stesso modo. Si prende invece
 * l'inizio del testo del post - che e la cosa che distingue davvero - e si
 * ricade sul titolo della pagina solo quando dice qualcosa.
 */
const TITOLO_VUOTO = /^\(?\d*\)?\s*(facebook|instagram)\s*$/i;

export function titoloDa(carico, voci) {
  const grezzo = (carico && carico.title ? String(carico.title) : "").trim();
  const pulito = grezzo.replace(/\s*[|\u2013\u2014\u00b7-]\s*(Facebook|Instagram)\s*$/i, "").trim();

  const primo = (voci || []).find((v) => v.kind === "post") || (voci || [])[0];
  const testo = primo && primo.text ? primo.text.split(/\s+/).join(" ").trim() : "";
  if (testo) {
    const corto = testo.length > 90 ? testo.slice(0, 90).replace(/\s+\S*$/, "") + "…" : testo;
    // Il titolo della pagina si usa solo se aggiunge qualcosa al testo del post.
    return pulito && !TITOLO_VUOTO.test(grezzo) && !TITOLO_VUOTO.test(pulito)
      ? `${pulito} — ${corto}`.slice(0, 160)
      : corto;
  }
  if (pulito && !TITOLO_VUOTO.test(grezzo)) return pulito;
  return null;
}
