/*
 * Archivio locale, dentro il browser.
 *
 * L'indice sta in una chiave sola e resta piccolo, cosi elencare le raccolte
 * non costringe a caricare in memoria tutti i commenti mai raccolti; ogni
 * raccolta ha la sua chiave a parte.
 */
const INDICE = "raccolte";

export async function leggi(chiave, difetto = null) {
  const r = await chrome.storage.local.get(chiave);
  return r[chiave] === undefined ? difetto : r[chiave];
}

export async function scrivi(chiave, valore) {
  await chrome.storage.local.set({ [chiave]: valore });
}

export async function impostazioni() {
  return Object.assign(
    { salvaNomi: false, giorniConservazione: 90, inoltraAPiazza: false, indirizzo: "", token: "", lingua: "auto" },
    await leggi("impostazioni", {})
  );
}

export async function salvaImpostazioni(nuove) {
  await scrivi("impostazioni", { ...(await impostazioni()), ...nuove });
}

export async function elenco() {
  return await leggi(INDICE, []);
}

export async function voci(id) {
  return await leggi(`raccolta:${id}`, []);
}

export async function salvaRaccolta({ url, titolo, voci: righe, diagnostica }) {
  const indice = await elenco();
  const id = (indice.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1;

  const nPost = righe.filter((v) => v.kind === "post").length;
  const nCommenti = righe.filter((v) => v.kind === "comment" || v.kind === "reply").length;

  await scrivi(`raccolta:${id}`, righe);
  indice.unshift({ id, url, titolo: titolo || null, quando: Date.now(), nPost, nCommenti, diagnostica });
  await scrivi(INDICE, indice);
  return { id, nPost, nCommenti };
}

export async function cancella(id) {
  await chrome.storage.local.remove(`raccolta:${id}`);
  await scrivi(INDICE, (await elenco()).filter((r) => r.id !== id));
}

export async function cancellaScadute(giorni) {
  const limite = Date.now() - giorni * 86400000;
  const vecchie = (await elenco()).filter((r) => r.quando < limite);
  for (const r of vecchie) await cancella(r.id);
  return vecchie.length;
}

export async function spazioUsato() {
  try {
    return await chrome.storage.local.getBytesInUse(null);
  } catch (e) {
    return null;
  }
}

export async function registro() {
  return await leggi("registro", []);
}

export async function svuotaRegistro() {
  await chrome.storage.local.remove("registro");
}

export async function ultimoEsito() {
  return await leggi("ultimoEsito", null);
}

// Correzione esplicita anche per raccolte precedenti: mantiene testi e legami.
export async function correggiTipo(id, posizione, tipo) {
  if (!["post", "comment", "reply"].includes(tipo)) throw new Error("Tipo non valido.");
  const indice = await elenco(), raccolta = indice.find(r=>r.id === id), righe = await voci(id);
  const voce = righe.find(v=>v.position === posizione);
  if (!raccolta || !voce) throw new Error("Contenuto non trovato.");
  voce.kind = tipo;
  if (tipo === "post") voce.parent_position = null;
  if (tipo !== "post") { voce.author_name = null; voce.author_url = null; voce.author_pseudonym = null; }
  if (tipo === "comment") for (const figlia of righe) {
    if (figlia.parent_position === posizione && figlia.kind === "comment") figlia.kind = "reply";
  }
  raccolta.nPost = righe.filter(v=>v.kind === "post").length;
  raccolta.nCommenti = righe.filter(v=>["comment", "reply"].includes(v.kind)).length;
  await chrome.storage.local.set({raccolte: indice, [`raccolta:${id}`]: righe});
}

// Solo il titolo: testi e legami restano come sono.
export async function rinomina(id, titolo) {
  const indice = await elenco();
  const raccolta = indice.find(r => r.id === id);
  if (!raccolta) return;
  raccolta.titolo = titolo;
  await scrivi("raccolte", indice);
}

// --- 1.4: etichette, ricerca globale, backup ---------------------------------

/** Un'etichetta libera per organizzare le raccolte («fine vita», «5x1000»…). */
export async function etichetta(id, testo) {
  const indice = await elenco();
  const raccolta = indice.find((r) => r.id === id);
  if (!raccolta) return;
  raccolta.etichetta = (testo || "").trim().slice(0, 60) || null;
  await scrivi(INDICE, indice);
}

/** Tutte le raccolte con i loro contenuti, in una lettura sola. */
export async function tutteLeVoci() {
  const indice = await elenco();
  const chiavi = indice.map((r) => `raccolta:${r.id}`);
  const dati = chiavi.length ? await chrome.storage.local.get(chiavi) : {};
  return indice.map((raccolta) => ({ raccolta, voci: dati[`raccolta:${raccolta.id}`] || [] }));
}

/**
 * L'archivio intero in un oggetto da salvare su file.
 *
 * Disinstallare l'estensione cancella tutto: questo e l'unico modo di portare
 * le raccolte fuori dal browser e di rimetterle dentro. Indirizzo e parola
 * d'ordine del server restano fuori: un backup gira, un segreto no.
 */
export async function esportaArchivio() {
  const tutte = await tutteLeVoci();
  const cfg = await impostazioni();
  return {
    formato: "piazza-archivio",
    versione: 1,
    esportato: new Date().toISOString(),
    impostazioni: { salvaNomi: cfg.salvaNomi, giorniConservazione: cfg.giorniConservazione },
    raccolte: tutte.map(({ raccolta, voci }) => ({ ...raccolta, voci })),
  };
}

/** Rimette in archivio un backup. Le raccolte gia presenti (stesso URL e stessa data) si saltano. */
export async function importaArchivio(dati) {
  if (!dati || dati.formato !== "piazza-archivio" || !Array.isArray(dati.raccolte)) {
    throw new Error("Il file non è un archivio di Piazza.");
  }
  const indice = await elenco();
  let prossimo = (indice.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1;
  const presenti = new Set(indice.map((r) => `${r.url}|${r.quando}`));
  const scritture = {};
  let importate = 0, saltate = 0;

  for (const r of dati.raccolte) {
    if (!r || typeof r.url !== "string" || !Array.isArray(r.voci)) { saltate++; continue; }
    const chiave = `${r.url}|${r.quando}`;
    if (presenti.has(chiave)) { saltate++; continue; }
    const { voci, id: _vecchio, ...meta } = r;
    const righe = voci.filter((v) => v && typeof v.text === "string").map((v) => ({ ...v }));
    const id = prossimo++;
    indice.push({
      ...meta, id,
      quando: Number(meta.quando) || Date.now(),
      titolo: typeof meta.titolo === "string" ? meta.titolo : null,
      nPost: righe.filter((v) => v.kind === "post").length,
      nCommenti: righe.filter((v) => v.kind === "comment" || v.kind === "reply").length,
    });
    scritture[`raccolta:${id}`] = righe;
    presenti.add(chiave);
    importate++;
  }
  indice.sort((a, b) => b.quando - a.quando);
  await chrome.storage.local.set({ ...scritture, [INDICE]: indice });
  return { importate, saltate };
}

/** Svuota l'archivio. Impostazioni e sale della pseudonimizzazione restano. */
export async function cancellaTutto() {
  const tutto = await chrome.storage.local.get(null);
  const chiavi = Object.keys(tutto).filter((k) => k.startsWith("raccolta:"));
  await chrome.storage.local.remove([...chiavi, INDICE, "ultimoEsito", "registro"]);
  return chiavi.length;
}
