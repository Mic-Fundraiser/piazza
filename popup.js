import { t, tf, traduciDocumento, impostaLinguaLocale } from "./libreria/lingua.js";
const $ = id => document.getElementById(id);
let tabId = null, buona = false, timer = null;

// Il messaggio di stato usa la notifica di Vanilla: cambia solo il colore.
function avvisa(testo, genere = "info") {
  const classi = { info: "p-notification--information", attenzione: "p-notification--caution", errore: "p-notification--negative" };
  $("avviso-testo").textContent = t(testo) || "";
  $("avviso").className = classi[genere] || classi.info;
  $("avviso").hidden = !testo;
}

// Facebook e Instagram: sono i due siti che gli estrattori sanno leggere.
function sitoSupportato(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const h = u.hostname.replace(/^www\./, "");
    if (h === "facebook.com" || h.endsWith(".facebook.com")) return "Facebook";
    if (h === "instagram.com" || h.endsWith(".instagram.com")) return "Instagram";
    return null;
  } catch { return null; }
}

function attiva(lavora) {
  $("lavoro").hidden = !lavora;
  $("raccogli").disabled = lavora || !buona;
  $("raccogli-label").textContent = t(lavora ? "Raccolta in corso…" : "Raccogli questa pagina");
  document.querySelectorAll('[name="modo"]').forEach(n => n.disabled = lavora);
}

async function apri(percorso) { await chrome.tabs.create({ url: chrome.runtime.getURL(percorso) }); window.close(); }

function mostraEsito(esito) {
  attiva(false);
  if (!esito.ok) { avvisa(esito.errore, "errore"); return; }
  const box = $("esito"); box.replaceChildren(); box.hidden = false;
  const testa = document.createElement("p"); testa.className = "p-muted-heading u-no-margin--bottom"; testa.textContent = t("Ultima raccolta salvata");
  const numeri = document.createElement("div"); numeri.className = "esito-numeri u-sv1";
  for (const [n, label] of [[esito.nPost, "post"], [esito.nCommenti, "commenti"]]) {
    const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = n; s.textContent = t(label); d.append(b, s); numeri.append(d);
  }
  const link = document.createElement("a"); link.textContent = t("Esplora la raccolta ›"); link.className = "p-text--small";
  link.href = `archivio.html#/raccolta/${esito.id}`; link.onclick = e => { e.preventDefault(); apri(link.getAttribute("href")); };
  box.append(testa, numeri, link);
  avvisa(esito.avvisoInoltro ? tf("Salvata nel browser. Inoltro non riuscito: {errore}", { errore: esito.avvisoInoltro }) : "", esito.avvisoInoltro ? "attenzione" : "info");
}

async function aggiornaStato() {
  if (!buona || !tabId) return;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => { const s = globalThis.__piazzaSessione; return s ? { attiva: s.attiva, testo: s.testo, elementi: s.elementi, esito: s.esito } : null; } });
    if (r?.result?.attiva) { attiva(true); $("esito").hidden = true; avvisa(tf("{stato} · {elementi} elementi letti. Puoi cambiare scheda o chiudere questo pannello.", { stato: r.result.testo || t("Raccolta avviata"), elementi: r.result.elementi || 0 })); }
    else { attiva(false); if (r?.result?.esito) mostraEsito(r.result.esito); }
  } catch { /* La pagina puo essere stata chiusa o aver cambiato origine. */ }
}

async function raccogli() {
  attiva(true); $("esito").hidden = true;
  const modo = document.querySelector('[name="modo"]:checked').value;
  avvisa(t("Puoi chiudere questo pannello. Segui la raccolta direttamente nella pagina."));
  try {
    await chrome.storage.local.set({ modoRaccolta: modo });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["estrattore.js", "raccogli.js"] });
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, args: [{ scadenzaMs: modo === "rapida" ? 60000 : 180000, soloVisibile: modo === "visibile" }], func: opzioni => {
      if (globalThis.__piazzaSessione?.attiva) return { avviata: false };
      void globalThis.__piazzaRaccogli(opzioni); return { avviata: true };
    } });
    if (!r?.result?.avviata) avvisa(t("Una raccolta è già in corso in questa scheda."));
    await aggiornaStato();
  } catch (e) { attiva(false); avvisa(tf("Non riesco ad avviare la raccolta. Ricarica la pagina e riprova. {errore}", { errore: e.message || e }), "errore"); }
}

async function avvia() {
  try {
    const dati = await chrome.storage.local.get(["ultimoEsito", "modoRaccolta", "impostazioni"]);
    const cfg = dati.impostazioni || {};
    impostaLinguaLocale(cfg.lingua); traduciDocumento();
    $("privacy-hint").textContent = tf("{modo} · Commenti senza nomi", { modo: t(cfg.inoltraAPiazza ? "Archivio locale + inoltro al server" : "Salvataggio locale") });
    if (["visibile", "rapida", "completa"].includes(dati.modoRaccolta)) document.querySelector(`[name="modo"][value="${dati.modoRaccolta}"]`).checked = true;

    const [scheda] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = scheda?.id;
    const sito = sitoSupportato(scheda?.url || "");
    buona = !!sito;
    $("sito-icona").className = sito === "Instagram" ? "p-icon--instagram" : "p-icon--facebook";
    $("pagina-titolo").textContent = buona
      ? (scheda.title || tf("Pagina {sito}", { sito })).replace(/\s*[|·-]\s*(Facebook|Instagram)\s*$/i, "")
      : t("Apri una pagina Facebook o Instagram");
    $("dove").textContent = buona ? tf("{sito} · {percorso}", { sito, percorso: new URL(scheda.url).pathname }) : t("Nessun sito compatibile in questa scheda");

    if (dati.ultimoEsito) mostraEsito(dati.ultimoEsito);
    attiva(false);
    if (buona) { await aggiornaStato(); timer = setInterval(aggiornaStato, 1200); }
    else if (!dati.ultimoEsito?.avvisoInoltro && dati.ultimoEsito?.ok !== false) avvisa("");
  } catch (e) { avvisa(tf("Impossibile aprire Piazza: {errore}", { errore: e.message || e }), "errore"); }
}

for (const [id, path] of [["archivio", "archivio.html"], ["diagnostica", "archivio.html#/diagnostica"], ["impostazioni", "archivio.html#/impostazioni"]]) {
  $(id).onclick = e => { e.preventDefault(); apri(path); };
}
$("raccogli").onclick = raccogli;
window.addEventListener("pagehide", () => clearInterval(timer));
avvia();
