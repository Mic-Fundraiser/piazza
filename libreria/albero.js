/*
 * Normalizzazione e ordine gerarchico delle voci.
 * Trasposizione di piazza/collector.py (flatten) e piazza/tree.py.
 */

/** Da nodi del DOM a righe da salvare: niente duplicati, niente gusci vuoti. */
export function normalizza(grezze) {
  const perDom = new Map();
  const viste = new Map();
  const voci = [];

  for (const g of grezze || []) {
    const testo = (g.text || "").trim();
    // Un articolo senza testo proprio e un contenitore: il testo sta nei figli.
    if (testo.length < 2) continue;

    const padre = perDom.get(g.parent_index) ?? null;
    const chiave = g.permalink ? `${g.kind}|${g.permalink}` : JSON.stringify([g.kind, padre, g.author_url || g.author_name, testo]);
    if (viste.has(chiave)) { perDom.set(g.dom_index, viste.get(chiave)); continue; }
    viste.set(chiave, voci.length);

    const posizione = voci.length;
    perDom.set(g.dom_index, posizione);

    voci.push({
      kind: g.kind || "post",
      position: posizione,
      parent_position:
        g.parent_index !== null && g.parent_index !== undefined && perDom.has(g.parent_index)
          ? perDom.get(g.parent_index)
          : null,
      text: testo,
      permalink: g.permalink || null,
      posted_at_label: g.posted_at_label || null,
      author_name: g.author_name || null,
      author_url: g.author_url || null,
      reactions: g.reactions === undefined ? null : g.reactions,
    });
  }
  return voci;
}

/** Post, poi i suoi commenti, poi le risposte a ciascun commento. */
export function ordinaAdAlbero(voci) {
  const perPosizione = new Map(voci.map((v) => [v.position, v]));
  const figli = new Map();
  const radici = [];

  for (const v of [...voci].sort((a, b) => a.position - b.position)) {
    const p = v.parent_position;
    if (p !== null && p !== undefined && perPosizione.has(p) && p !== v.position) {
      if (!figli.has(p)) figli.set(p, []);
      figli.get(p).push(v);
    } else {
      radici.push(v);
    }
  }

  const ordinate = [];
  const viste = new Set();
  const cammina = (nodo) => {
    if (viste.has(nodo.position)) return; // difesa contro cicli in dati corrotti
    viste.add(nodo.position);
    ordinate.push(nodo);
    for (const f of figli.get(nodo.position) || []) cammina(f);
  };
  radici.forEach(cammina);

  // Se un ciclo avesse tagliato fuori qualcosa, meglio in coda che perduto.
  for (const v of [...voci].sort((a, b) => a.position - b.position)) {
    if (!viste.has(v.position)) ordinate.push(v);
  }
  return ordinate;
}
