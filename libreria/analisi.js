/*
 * Lettura aggregata di una raccolta. Trasposizione di piazza/analyze.py.
 *
 * Sul sentiment: qui non c'e, come nella versione Python. Un lessico di parole
 * positive e negative su testi politici italiani produce numeri dall'aria
 * precisa e dal contenuto sbagliato - sarcasmo, negazioni e citazioni lo
 * ribaltano di continuo. Per quel tipo di lettura c'e l'export in Markdown, da
 * dare a un modello linguistico.
 */
import { STOPWORDS } from "./stopwords.js";

const TOKEN = /[A-Za-zÀ-ÖØ-öø-ÿ']{2,}/g;
const ELISIONE = /^(l|d|n|un|c|s|t|m|v|gl|all|dell|nell|sull|dall|quell|quest)['’]/i;
const URL_RE = /https?:\/\/[^\s)\]]+/g;
const HASHTAG = /#(\w{2,40})/g;
const DOMANDA = /[^.!?\n]{8,400}\?/g;

export function tokenizza(testo) {
  const fuori = [];
  for (const grezzo of (testo || "").toLowerCase().match(TOKEN) || []) {
    const parola = grezzo.replace(ELISIONE, "").replace(/^['’]|['’]$/g, "");
    if (parola.length < 3 || STOPWORDS.has(parola)) continue;
    fuori.push(parola);
  }
  return fuori;
}

const piuComuni = (mappa, quanti, minimo = 1) =>
  [...mappa.entries()]
    .filter(([, n]) => n >= minimo)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, quanti);

const conta = (mappa, chiave) => mappa.set(chiave, (mappa.get(chiave) || 0) + 1);

export function analizza(voci, quanti = 25) {
  const post = voci.filter((v) => v.kind === "post");
  const commenti = voci.filter((v) => v.kind === "comment" || v.kind === "reply");

  const termini = new Map();
  const bigrammi = new Map();
  const hashtag = new Map();
  const collegamenti = new Map();
  const voci_di = new Map();
  const domande = [];
  let paroleTotali = 0;

  for (const c of commenti) {
    const t = tokenizza(c.text);
    t.forEach((p) => conta(termini, p));
    for (let i = 0; i + 1 < t.length; i++) conta(bigrammi, `${t[i]} ${t[i + 1]}`);
    paroleTotali += t.length;

    for (const h of c.text.matchAll(HASHTAG)) conta(hashtag, h[1].toLowerCase());
    for (const u of c.text.match(URL_RE) || []) conta(collegamenti, u.replace(/[.,;:!?]+$/, ""));
    if (c.author_pseudonym) conta(voci_di, c.author_name || c.author_pseudonym);

    for (const d of c.text.match(DOMANDA) || []) {
      const pulita = d.split(/\s+/).join(" ").trim();
      if (pulita.length >= 12) domande.push(pulita);
    }
  }

  // Su raccolte ampie i termini con una sola occorrenza sono rumore; su quelle
  // piccole sono quasi tutto quello che c'e, e toglierli lascerebbe il vuoto.
  const minimo = commenti.length >= 15 ? 2 : 1;

  const rispostePerPost = new Map();
  for (const c of commenti) {
    if (c.parent_position !== null && c.parent_position !== undefined) {
      conta(rispostePerPost, c.parent_position);
    }
  }

  const piuDiscussi = [...post]
    .sort((a, b) => (rispostePerPost.get(b.position) || 0) - (rispostePerPost.get(a.position) || 0))
    .slice(0, 8)
    .map((p) => {
      const estratto = p.text.split(/\s+/).join(" ");
      return {
        position: p.position,
        estratto: estratto.slice(0, 220) + (estratto.length > 220 ? "…" : ""),
        commenti: rispostePerPost.get(p.position) || 0,
        reactions: p.reactions,
        permalink: p.permalink,
      };
    });

  return {
    nPost: post.length,
    nCommenti: commenti.length,
    nAutori: new Set(commenti.map((c) => c.author_pseudonym).filter(Boolean)).size,
    paroleTotali,
    mediaParole: commenti.length ? Math.round((paroleTotali / commenti.length) * 10) / 10 : 0,
    termini: piuComuni(termini, quanti, minimo),
    bigrammi: piuComuni(bigrammi, quanti, 2),
    hashtag: piuComuni(hashtag, 15),
    collegamenti: piuComuni(collegamenti, 15),
    domande: domande.slice(0, 40),
    piuDiscussi,
    vociPrincipali: piuComuni(voci_di, 12),
  };
}
