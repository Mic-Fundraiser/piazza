/*
 * Pseudonimizzazione degli autori.
 *
 * Il termine giusto e questo: non anonimizzazione. Il sale resta in questo
 * browser, quindi chi ha accesso al sale e a un elenco di nomi puo ricalcolare
 * la corrispondenza. Serve a evitare che un archivio di commenti diventi per
 * inerzia una rubrica di nomi e cognomi.
 */
import { leggi, scrivi } from "./deposito.js";

let promessaSale = null;

async function sale() {
  // Una sola inizializzazione anche se Promise.all elabora molti autori.
  if (!promessaSale) promessaSale = (async () => {
    let s = await leggi("sale", null);
    if (!s) {
      const b = crypto.getRandomValues(new Uint8Array(16));
      s = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
      await scrivi("sale", s);
    }
    return s;
  })().catch(e => { promessaSale = null; throw e; });
  return promessaSale;
}

export function normalizzaNome(nome) {
  return (nome || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Pseudonimo stabile. L'URL del profilo ha la precedenza: distingue gli omonimi. */
export async function pseudonimo(nome, urlProfilo) {
  const seme = (urlProfilo || "").trim() || normalizzaNome(nome);
  if (!seme) return null;
  const dati = new TextEncoder().encode((await sale()) + "\n" + seme);
  const digest = await crypto.subtle.digest("SHA-256", dati);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "p_" + hex.slice(0, 8);
}

/** Applica le impostazioni: di default il nome vero non viene salvato. */
export async function applicaPrivacy(voci, salvaNomi) {
  return Promise.all(
    voci.map(async (v) => {
      if (v.kind === "comment" || v.kind === "reply") return { ...v, author_name: null, author_url: null, author_pseudonym: null };
      const pseudo = await pseudonimo(v.author_name, v.author_url);
      return salvaNomi
        ? { ...v, author_pseudonym: pseudo }
        : { ...v, author_name: null, author_url: null, author_pseudonym: pseudo };
    })
  );
}

export function autoreDa(voce) {
  return voce.author_name || voce.author_pseudonym || "autore ignoto";
}
