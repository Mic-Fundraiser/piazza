/*
 * Service worker: archivia quello che la scheda ha letto.
 *
 * Il lavoro sta qui e non nel popup perche il popup muore appena lo chiudi: se
 * la raccolta dura un minuto e tu guardi altrove, andrebbe perso. L'archivio e
 * dentro il browser, quindi l'estensione basta a se stessa; l'inoltro a Piazza
 * e facoltativo e spento di partenza, per chi vuole anche l'archivio su disco.
 */
import { impostazioni, salvaRaccolta, cancellaScadute } from "./libreria/deposito.js";
import { normalizza } from "./libreria/albero.js";
import { titoloDa } from "./libreria/titolo.js";
import { applicaPrivacy } from "./libreria/privacy.js";

const MAX_TRACCE = 150;

/**
 * Conserva la traccia dei passi.
 *
 * Se una raccolta si pianta su una pagina vera non arriva nessun carico, e
 * senza questo non resterebbe niente da guardare: solo un utente che dice «non
 * ha salvato» e nessun modo di sapere dove si e fermata.
 */
async function traccia(voce) {
  try {
    const attuale = (await chrome.storage.local.get("registro")).registro || [];
    attuale.push({ t: Date.now(), ...voce });
    await chrome.storage.local.set({ registro: attuale.slice(-MAX_TRACCE) });
  } catch (e) {
    /* se non si puo scrivere la traccia, non deve saltare la raccolta */
  }
}

const badge = (testo, colore) => {
  chrome.action.setBadgeText({ text: testo });
  if (colore) chrome.action.setBadgeBackgroundColor({ color: colore });
};

async function inoltra(cfg, carico) {
  const base = (cfg.indirizzo || "http://127.0.0.1:5070").replace(/\/+$/, "");
  const destinazione = new URL(base);
  if (destinazione.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(destinazione.hostname) || destinazione.username || destinazione.password)
    throw new Error("L’inoltro richiede un indirizzo HTTP locale.");
  const risposta = await fetch(`${base}/api/raccolta`, {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", "X-Piazza-Token": cfg.token || "" },
    body: JSON.stringify(carico),
  });
  if (!risposta.ok) {
    const corpo = await risposta.json().catch(() => ({}));
    throw new Error(corpo.errore || `Piazza ha risposto ${risposta.status}.`);
  }
}

async function archivia(carico) {
  const cfg = await impostazioni();

  const voci = await applicaPrivacy(normalizza(carico.items), cfg.salvaNomi);
  if (!voci.length) throw new Error("La pagina non conteneva nulla di leggibile.");

  const esito = await salvaRaccolta({
    url: carico.url,
    titolo: titoloDa(carico, voci),
    voci,
    diagnostica: carico.diagnostica || null,
  });

  // La conservazione si applica da sola, come nella versione con il server.
  if (cfg.giorniConservazione > 0) {
    await cancellaScadute(cfg.giorniConservazione).catch(() => {});
  }

  let avvisoInoltro = null;
  if (cfg.inoltraAPiazza) {
    try {
      await inoltra(cfg, carico);
    } catch (e) {
      // L'archivio locale e gia salvo: l'inoltro fallito e una nota, non un errore.
      avvisoInoltro = String((e && e.message) || e);
    }
  }

  return { ...esito, avvisoInoltro };
}

let coda = Promise.resolve();

chrome.runtime.onMessage.addListener((messaggio, _mittente, rispondi) => {
  if (messaggio.tipo === "stato") {
    traccia({ passo: messaggio.testo, articoli: messaggio.articoli });
    return;
  }

  if (messaggio.tipo === "invia") {
    badge("…", "#8a4b12");
    const carico = messaggio.payload || {};
    traccia({
      passo: "carico ricevuto",
      voci: (carico.items || []).length,
      url: carico.url,
      diagnostica: carico.diagnostica,
    });
    // Si risponde a lavoro finito, non subito: chi ha mandato il carico e lo
    // script nella pagina, e vuole sapere se e stato archiviato per scriverlo
    // sul riquadro. `return true` tiene aperto il canale fino ad allora.
    const lavoro = coda.then(() => archivia(messaggio.payload));
    coda = lavoro.catch(() => {});
    lavoro
      .then(async (esito) => {
        badge("✓", "#1d5c4f");
        setTimeout(() => badge(""), 6000);
        const finale = { ok: true, ...esito, quando: Date.now() };
        await traccia({ passo: "archiviata", id: esito.id, nPost: esito.nPost, nCommenti: esito.nCommenti });
        await chrome.storage.local.set({ ultimoEsito: finale });
        chrome.runtime.sendMessage({ tipo: "esito", ...finale }).catch(() => {});
        rispondi(finale);
      })
      .catch(async (e) => {
        badge("!", "#8c2d24");
        const finale = { ok: false, errore: String((e && e.message) || e), quando: Date.now() };
        await traccia({ passo: "NON archiviata", errore: finale.errore });
        await chrome.storage.local.set({ ultimoEsito: finale });
        chrome.runtime.sendMessage({ tipo: "esito", ...finale }).catch(() => {});
        rispondi(finale);
      });
    return true;
  }

  if (messaggio.tipo === "errore") {
    badge("!", "#8c2d24");
    traccia({ passo: "errore nella pagina", errore: messaggio.errore });
    chrome.storage.local.set({
      ultimoEsito: { ok: false, errore: messaggio.errore, quando: Date.now() },
    });
  }

  if (messaggio.tipo === "apriArchivio") {
    chrome.tabs.create({ url: chrome.runtime.getURL(Number.isSafeInteger(messaggio.id) ? `archivio.html#/raccolta/${messaggio.id}` : "archivio.html") });
  }
});
