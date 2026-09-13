import { safeURL, toast } from "./libreria/ui.js";
import { t, tf, traduciDocumento, impostaLinguaLocale, lingua } from "./libreria/lingua.js";
/*
 * L'archivio: elenco delle raccolte, testi, lettura aggregata, ricerca, export.
 *
 * Tutto il testo che arriva da Facebook o Instagram viene inserito come nodo di
 * testo, mai come HTML: una pagina di estensione ha privilegi che una pagina
 * qualsiasi non ha, e un commento con dentro del markup non deve poterli
 * sfruttare.
 *
 * La grafica e quella del Vanilla Framework (vendor/): qui si compone il
 * markup con le sue classi, e stile.css aggiunge solo cio che Vanilla non ha.
 */
import { elenco, voci, cancella, cancellaScadute, impostazioni, salvaImpostazioni, spazioUsato,
         registro, svuotaRegistro, ultimoEsito, correggiTipo, rinomina,
         etichetta as salvaEtichetta, tutteLeVoci, esportaArchivio, importaArchivio, cancellaTutto }
  from "./libreria/deposito.js";
import { analizza } from "./libreria/analisi.js";
import { titoloDa } from "./libreria/titolo.js";
import { ordinaAdAlbero } from "./libreria/albero.js";
import { inCSV, inJSON, inMarkdown, scarica } from "./libreria/esporta.js";

const el = (tag, attrs = {}, ...figli) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === "class") n.className = v;
    // Un punto solo per la traduzione: tutto il markup passa da qui.
    else if (k === "text") n.textContent = t(v);
    else if (["placeholder", "aria-label", "title"].includes(k)) n.setAttribute(k, t(v));
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "href" && !String(v).startsWith("#")) { const url = safeURL(v); if (url) n.setAttribute(k, url); }
    else n.setAttribute(k, v);
  }
  for (const f of figli.flat()) if (f !== null && f !== undefined) n.append(f);
  return n;
};

const contenuto = document.getElementById("contenuto");
const mostra = (...nodi) => contenuto.replaceChildren(...nodi.flat().filter(Boolean));
const card = (...figli) => el("div", { class: "p-card" }, figli);
const bottone = (testo, opz = {}) => el("button", { type: "button", class: opz.class || "p-button", text: testo, ...opz });
const titolo = (testo) => el("h2", { class: "p-heading--4", text: testo });
const avviso = (tipo, testo, ...extra) =>
  el("div", { class: `p-notification--${tipo}` }, el("div", { class: "p-notification__content" },
    el("p", { class: "p-notification__message" }, testo, ...extra)));

// Date e numeri seguono la lingua scelta: una data italiana in un'interfaccia
// inglese e una svista che si nota subito.
const locale = () => (lingua() === "en" ? "en-GB" : "it-IT");
const quando = (ms) => new Date(ms).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });
const numero = (n) => Number(n || 0).toLocaleString(locale());

// Da quale sito viene una raccolta: serve solo per parlarne con il nome giusto.
const sitoDi = (r) => {
  try { return new URL(r.url).hostname.includes("instagram") ? "Instagram" : "Facebook"; }
  catch { return "Il sito"; }
};
const iconaSito = (r) => el("i", { class: sitoDi(r) === "Instagram" ? "p-icon--instagram" : "p-icon--facebook", "aria-label": sitoDi(r) });

const ETICHETTA = { post: "Post", comment: "Commento", reply: "Risposta" };
const parziale = (r) => r.diagnostica && (r.diagnostica.tempoScaduto || r.diagnostica.interrotto || r.diagnostica.limiteClic || r.diagnostica.soloVisibile);
const statoRaccolta = (r) => r.diagnostica?.soloVisibile ? "Solo visibile" : parziale(r) ? "Parziale" : r.diagnostica ? "Archiviata" : "Salvata";
const badgeRaccolta = (r) => el("span", { class: parziale(r) ? "p-status-label--caution" : "p-status-label--positive", text: statoRaccolta(r) });

/** Un campo di ricerca nella forma di Vanilla, con l'id che i test conoscono. */
const cercaInput = (placeholder, id) => {
  const input = el("input", { type: "search", class: "p-search-box__input", placeholder, id, "aria-label": placeholder, autocomplete: "off" });
  const box = el("form", { class: "p-search-box", onsubmit: (e) => e.preventDefault() },
    input,
    el("button", { type: "reset", class: "p-search-box__reset", "aria-label": "Svuota", onclick: () => { input.value = ""; input.dispatchEvent(new Event("input")); } }, el("i", { class: "p-icon--close" })),
    el("span", { class: "p-search-box__button", "aria-hidden": "true" }, el("i", { class: "p-icon--search" })));
  return { input, box };
};

/** Le frequenze si leggono meglio come barre che come numeri in fila. */
function barre(coppie) {
  const massimo = coppie.reduce((m, [, n]) => Math.max(m, n), 1);
  return el("div", { class: "barre" }, coppie.map(([parola, n]) =>
    el("div", { class: "barra" },
      el("span", { class: "parola", text: parola, title: parola }),
      el("span", { class: "traccia" }, el("span", { class: "riempimento", style: `width:${Math.max(4, (n / massimo) * 100)}%` })),
      el("span", { class: "conteggio", text: String(n) }))));
}
const chips = (coppie, classe = "p-chip") =>
  el("div", { class: "terms" }, coppie.map(([parola, n]) =>
    el("span", { class: classe }, el("span", { class: "p-chip__value", text: `${parola} · ${n}` }))));

function statistiche(coppie) {
  return el("div", { class: "row statistiche" }, coppie.map(([valore, nome]) =>
    el("div", { class: "col-3 col-medium-3 col-small-2" }, el("div", { class: "p-card stat u-no-margin--bottom" },
      el("b", { text: numero(valore) }), el("span", { text: nome })))));
}

// Le voci di piu raccolte messe insieme: le posizioni si spostano perche
// analizza() usa position/parent_position per legare commenti e post.
function unisci(gruppi) {
  const tutte = [];
  let scarto = 0;
  for (const { voci: righe } of gruppi) {
    for (const v of righe) {
      tutte.push({ ...v, position: v.position + scarto,
        parent_position: v.parent_position === null || v.parent_position === undefined ? null : v.parent_position + scarto });
    }
    scarto += righe.length;
  }
  return tutte;
}

const parametri = () => new URLSearchParams((location.hash.split("?")[1] || ""));

// --- elenco ----------------------------------------------------------------

async function vistaElenco() {
  document.getElementById("sottotitolo").textContent = t("Dalle conversazioni alle idee. Tutto in un unico posto.");
  const [raccolte, cfg] = await Promise.all([elenco(), impostazioni()]);

  const stats = statistiche([
    [raccolte.length, "Raccolte"],
    [raccolte.reduce((n, r) => n + r.nPost, 0), "Post"],
    [raccolte.reduce((n, r) => n + r.nCommenti, 0), "Commenti e risposte"],
    [raccolte.filter((r) => r.quando >= Date.now() - 7 * 86400000).length, "Ultimi 7 giorni"],
  ]);

  const { input, box } = cercaInput("Cerca per titolo, pagina o etichetta…", "cerca-raccolte");
  const ordine = el("select", { "aria-label": "Ordina raccolte" },
    el("option", { value: "recenti", text: "Più recenti" }), el("option", { value: "commenti", text: "Più commenti" }), el("option", { value: "titolo", text: "Titolo A–Z" }));
  const filtro = el("select", { "aria-label": "Filtra raccolte" },
    el("option", { value: "tutte", text: "Tutte" }), el("option", { value: "facebook", text: "Solo Facebook" }),
    el("option", { value: "instagram", text: "Solo Instagram" }), el("option", { value: "parziali", text: "Solo parziali" }));
  const etichette = [...new Set(raccolte.map((r) => r.etichetta).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale()));
  const perEtichetta = el("select", { "aria-label": "Filtra per etichetta", id: "filtro-etichetta" },
    el("option", { value: "", text: "Tutte le etichette" }), etichette.map((e) => el("option", { value: e, text: e })));

  const griglia = el("div", { class: "row griglia" });
  const conta = el("p", { class: "p-text--small u-text--muted", role: "status" });

  const aggiorna = () => {
    const q = input.value.trim().toLocaleLowerCase(locale());
    let visibili = raccolte.filter((r) =>
      `${r.titolo || ""} ${r.url} ${r.etichetta || ""}`.toLocaleLowerCase(locale()).includes(q)
      && (filtro.value === "tutte" || (filtro.value === "parziali" ? parziale(r) : sitoDi(r).toLowerCase() === filtro.value))
      && (!perEtichetta.value || r.etichetta === perEtichetta.value));
    visibili.sort(ordine.value === "commenti" ? (a, b) => b.nCommenti - a.nCommenti
      : ordine.value === "titolo" ? (a, b) => (a.titolo || "").localeCompare(b.titolo || "", locale())
      : (a, b) => b.quando - a.quando);
    conta.textContent = tf("{n} di {tot} raccolte", { n: visibili.length, tot: raccolte.length });
    griglia.replaceChildren(...visibili.map((r) => el("div", { class: "col-4 col-medium-3 col-small-4" },
      el("a", { class: "p-card scheda u-no-margin--bottom", href: `#/raccolta/${r.id}` },
        el("div", { class: "card-top" }, el("span", {}, iconaSito(r), " ", el("span", { class: "p-text--small u-text--muted", text: sitoDi(r) })), badgeRaccolta(r)),
        el("div", { class: "titolo", text: r.titolo || "Senza titolo" }),
        el("div", { class: "origine", text: r.url }),
        r.etichetta ? el("span", { class: "p-chip--information" }, el("span", { class: "p-chip__value", text: r.etichetta })) : null,
        el("div", { class: "numeri" },
          el("div", {}, el("b", { text: numero(r.nPost) }), el("span", { text: "post" })),
          el("div", {}, el("b", { text: numero(r.nCommenti) }), el("span", { text: "commenti" }))),
        el("div", { class: "data" }, el("span", { text: quando(r.quando) }), el("span", { text: "Apri ›" }))))));
    if (!visibili.length) griglia.append(el("div", { class: "col-12" }, card(
      el("h3", { class: "p-heading--4", text: raccolte.length ? "Nessuna raccolta corrisponde" : "La prima conversazione ti aspetta" }),
      el("p", { class: "u-text--muted", text: raccolte.length ? "Prova un'altra ricerca o cambia il filtro."
        : "Apri un post di Facebook o Instagram, premi l'icona di Piazza e scegli «Raccogli questa pagina». La ritroverai qui." }),
      !raccolte.length ? el("a", { class: "p-button--positive", href: "#/guida", text: "Scopri come iniziare" }) : null)));
  };
  [input, ordine, filtro, perEtichetta].forEach((n) => n.addEventListener(n === input ? "input" : "change", aggiorna));

  const scadute = cfg.giorniConservazione > 0 ? raccolte.filter((r) => r.quando < Date.now() - cfg.giorniConservazione * 86400000) : [];
  mostra(stats,
    scadute.length ? avviso("caution", tf("{n} raccolte superano i {giorni} giorni di conservazione.", { n: scadute.length, giorni: cfg.giorniConservazione }) + " ",
      el("button", { class: "p-button--base is-dense u-no-margin--bottom", text: "Cancella le scadute", onclick: async () => {
        if (!confirm(tf("Cancellare definitivamente {n} raccolte scadute?", { n: scadute.length }))) return;
        await cancellaScadute(cfg.giorniConservazione); disegna();
      } })) : null,
    el("div", { class: "toolbar" }, box, filtro, etichette.length ? perEtichetta : null, ordine),
    conta, griglia);
  aggiorna();
}

// --- dettaglio -------------------------------------------------------------

async function vistaRaccolta(id, scheda) {
  const raccolta = (await elenco()).find((r) => r.id === id);
  if (!raccolta) return mostra(card(el("p", { class: "u-text--muted u-no-margin--bottom", text: "Raccolta non trovata." })));

  const righe = await voci(id);

  // Le raccolte fatte prima della 1.3 si chiamano tutte «Facebook»: il titolo
  // veniva da document.title, che li non dice nulla. Si ricalcola alla prima
  // apertura, quando i contenuti sono gia in memoria.
  if (!raccolta.titolo || /^\(?\d*\)?\s*(facebook|instagram)\s*$/i.test(raccolta.titolo)) {
    const migliore = titoloDa({ title: raccolta.titolo }, righe);
    if (migliore && migliore !== raccolta.titolo) { raccolta.titolo = migliore; await rinomina(id, migliore); }
  }
  document.getElementById("sottotitolo").textContent = tf("{sito} · {quando}", { sito: sitoDi(raccolta), quando: quando(raccolta.quando) });

  const esporta = (formato, costruisci, tipo) =>
    bottone(formato, { class: "p-button is-dense u-no-margin--bottom", onclick: () => scarica(`piazza-${id}.${formato.replace(".", "")}`, costruisci(raccolta, righe), tipo) });

  // Titolo ed etichetta si cambiano sul posto: sono il modo di ritrovarsi fra molte raccolte.
  const campoTitolo = el("input", { type: "text", id: "titolo-raccolta", value: raccolta.titolo || "", maxlength: "160", "aria-label": "Titolo della raccolta" });
  const campoEtichetta = el("input", { type: "text", id: "etichetta", value: raccolta.etichetta || "", maxlength: "60", placeholder: "Etichetta (es. fine vita)", "aria-label": "Etichetta della raccolta" });
  const salvaMeta = async () => {
    const t = campoTitolo.value.trim();
    if (t && t !== raccolta.titolo) { await rinomina(id, t); raccolta.titolo = t; }
    if ((campoEtichetta.value.trim() || null) !== (raccolta.etichetta || null)) { await salvaEtichetta(id, campoEtichetta.value); raccolta.etichetta = campoEtichetta.value.trim() || null; }
    toast("Salvato");
  };

  const testata = card(
    el("div", { class: "tra" },
      el("div", { style: "flex:1 1 20rem" },
        el("div", { class: "p-text--small u-text--muted" }, iconaSito(raccolta), " ", badgeRaccolta(raccolta)),
        el("h2", { class: "p-heading--4 u-no-margin--bottom", text: raccolta.titolo || "Raccolta senza titolo" }),
        el("a", { class: "p-text--small", href: raccolta.url, target: "_blank", rel: "noopener noreferrer", text: "Apri la pagina originale ↗" })),
      el("div", { class: "riga-azioni" },
        esporta(".md", inMarkdown, "text/markdown"), esporta(".json", inJSON, "application/json"), esporta(".csv", inCSV, "text/csv"),
        bottone("Copia in Markdown", { class: "p-button is-dense u-no-margin--bottom", onclick: async () => {
          try { await navigator.clipboard.writeText(inMarkdown(raccolta, righe)); toast("Markdown copiato: incollalo dove vuoi."); }
          catch { toast("Copia non disponibile: usa il pulsante .md."); } } }),
        bottone("Cancella", { class: "p-button--negative is-dense u-no-margin--bottom", onclick: async () => {
          if (!confirm(tf("Cancellare la raccolta «{titolo}» e tutti i suoi contenuti?", { titolo: raccolta.titolo || id }))) return;
          await cancella(id); location.hash = "#/";
        } }))),
    el("details", {}, el("summary", { class: "p-text--small", text: "Rinomina o etichetta" }),
      el("div", { class: "inline-form u-sv1" }, campoTitolo, campoEtichetta, bottone("Salva", { class: "p-button is-dense u-no-margin--bottom", onclick: salvaMeta }))));

  const analisi = scheda === "analisi";
  const linguette = el("div", { class: "p-tabs" }, el("ul", { class: "p-tabs__list", role: "tablist" },
    el("li", { class: "p-tabs__item", role: "presentation" }, el("a", { class: "p-tabs__link", role: "tab", href: `#/raccolta/${id}`, "aria-selected": String(!analisi), text: "Testi" })),
    el("li", { class: "p-tabs__item", role: "presentation" }, el("a", { class: "p-tabs__link", role: "tab", href: `#/raccolta/${id}/analisi`, "aria-selected": String(analisi), text: "Analisi aggregata" }))));

  mostra(
    el("p", { class: "p-text--small" }, el("a", { href: "#/", text: "‹ Tutte le raccolte" })),
    testata,
    avviso(parziale(raccolta) ? "caution" : "information",
      raccolta.diagnostica?.soloVisibile ? "Sono stati salvati i contenuti già visibili, senza aprire commenti o scorrere."
      : parziale(raccolta) ? "La raccolta si è fermata per un limite o su tua richiesta. I contenuti già letti sono salvati."
      : tf("Contenuti salvati dalla pagina. {sito} può nascondere commenti: l'archivio non certifica la completezza della conversazione.", { sito: sitoDi(raccolta) })),
    linguette,
    analisi ? bloccoAnalisi(righe) : bloccoTesti(righe, id));
}

function bloccoTesti(righe, raccoltaId) {
  const { input, box } = cercaInput("Cerca una parola nei testi…", "cerca-testi");
  input.value = parametri().get("q") || "";
  const tipo = el("select", { "aria-label": "Tipo di contenuto" },
    ...[["", "Tutti i contenuti"], ["post", "Solo post"], ["comment", "Solo commenti"], ["reply", "Solo risposte"], ["domande", "Solo domande"]].map(([value, text]) => el("option", { value, text })));
  const count = el("p", { class: "p-text--small u-text--muted", role: "status" });
  const filo = el("div", { class: "filo" });
  const carica = bottone("Mostra altri 100", { class: "p-button u-sv1" });
  let limite = 100;

  const aggiorna = () => {
    const query = input.value.trim().toLocaleLowerCase(locale());
    const filtrate = ordinaAdAlbero(righe).filter((v) =>
      (!tipo.value || (tipo.value === "domande" ? v.kind !== "post" && v.text.includes("?") : v.kind === tipo.value))
      && v.text.toLocaleLowerCase(locale()).includes(query));
    count.textContent = tf(query || tipo.value ? "{n} contenuti corrispondenti · {vis} visualizzati" : "{n} contenuti nella conversazione · {vis} visualizzati",
      { n: filtrate.length, vis: Math.min(limite, filtrate.length) });
    filo.replaceChildren(...filtrate.slice(0, limite).map((v) => {
      const body = el("p", { class: "body" });
      const text = v.text; let start = 0;
      if (query) { let i; const lower = text.toLocaleLowerCase(locale()); while ((i = lower.indexOf(query, start)) !== -1) { body.append(text.slice(start, i), el("mark", { text: text.slice(i, i + query.length) })); start = i + query.length; } }
      body.append(text.slice(start));
      const scegliTipo = el("select", { "aria-label": tf("Tipo del contenuto {n}", { n: v.position + 1 }), onchange: async (e) => {
        try { await correggiTipo(raccoltaId, v.position, e.target.value); await disegna(); toast("Tipo e conteggi aggiornati"); }
        catch { toast("Correzione non salvata. Riprova."); }
      } }, ...Object.entries(ETICHETTA).map(([value, text]) => el("option", { value, text })));
      scegliTipo.value = v.kind;
      return el("article", { class: `item ${v.kind}` },
        el("div", { class: "meta" }, scegliTipo,
          v.posted_at_label ? el("span", { text: v.posted_at_label }) : null,
          v.reactions != null ? el("span", { text: tf("{n} reazioni", { n: v.reactions }) }) : null,
          safeURL(v.permalink) ? el("a", { href: v.permalink, target: "_blank", rel: "noopener noreferrer", text: "Originale ↗" }) : null,
          bottone("Copia testo", { class: "p-button--base is-dense u-no-margin--bottom item-copy", onclick: async () => {
            try { await navigator.clipboard.writeText(v.text); toast("Testo copiato"); } catch { toast("Copia non disponibile. Seleziona il testo e usa Ctrl+C."); } } })),
        body);
    }));
    if (!filtrate.length) filo.append(card(el("h3", { class: "p-heading--5", text: "Nessun contenuto trovato" }), el("p", { class: "u-text--muted u-no-margin--bottom", text: "Prova un'altra parola o scegli un tipo diverso." })));
    carica.hidden = limite >= filtrate.length;
  };
  input.addEventListener("input", () => { limite = 100; aggiorna(); });
  tipo.addEventListener("change", () => { limite = 100; aggiorna(); });
  carica.onclick = () => { limite += 100; aggiorna(); };
  aggiorna();
  return el("section", {}, el("div", { class: "toolbar" }, box, tipo), count, filo, carica);
}

function bloccoAnalisi(righe, opzioni = {}) {
  const a = analizza(righe);
  const nodi = [];
  nodi.push(statistiche([[a.nPost, "post"], [a.nCommenti, "commenti"], [righe.filter((v) => v.kind === "reply").length, "risposte"], [a.mediaParole, "parole per commento"]]));

  if (a.termini.length) nodi.push(titolo("Di che cosa si parla"), card(barre(a.termini)));
  if (a.bigrammi.length) nodi.push(titolo("Espressioni ricorrenti"), card(chips(a.bigrammi)));

  if (a.piuDiscussi.length && !opzioni.senzaPost) {
    nodi.push(titolo("Post che hanno acceso la discussione"),
      el("table", { class: "p-table--mobile-card" },
        el("thead", {}, el("tr", {}, el("th", { class: "u-align--right", text: "Commenti" }), el("th", { class: "u-align--right", text: "Reazioni" }), el("th", { text: "Post" }))),
        el("tbody", {}, a.piuDiscussi.map((p) => el("tr", {},
          el("td", { class: "u-align--right", "aria-label": "Commenti", text: String(p.commenti) }),
          el("td", { class: "u-align--right", "aria-label": "Reazioni", text: p.reactions === null || p.reactions === undefined ? "—" : String(p.reactions) }),
          el("td", { "aria-label": "Post" }, safeURL(p.permalink)
            ? el("a", { href: p.permalink, target: "_blank", rel: "noopener noreferrer", text: p.estratto || "(senza testo)" })
            : document.createTextNode(p.estratto || "(senza testo)")))))));
  }

  if (a.domande.length) {
    nodi.push(titolo("Domande poste nei commenti"),
      el("p", { class: "u-text--muted", text: "Il materiale più utile per una campagna: sono le obiezioni e i dubbi a cui rispondere." }),
      el("div", { class: "row" }, a.domande.map((d) => el("div", { class: "col-6" },
        el("div", { class: "p-card--highlighted" }, el("blockquote", { class: "domanda", text: d }))))));
  }

  if (a.hashtag.length || a.collegamenti.length) {
    nodi.push(titolo("Hashtag e link citati"), card(
      a.hashtag.length ? chips(a.hashtag.map(([h, n]) => ["#" + h, n]), "p-chip--information") : null,
      a.collegamenti.length ? el("ul", { class: "p-list--divided u-no-margin--bottom" }, a.collegamenti.map(([u, n]) =>
        el("li", { class: "p-list__item" }, el("a", { href: u, target: "_blank", rel: "noopener noreferrer", text: u }), el("span", { class: "u-text--muted", text: ` ×${n}` })))) : null));
  }
  return nodi;
}

// --- analisi complessiva -----------------------------------------------------

async function vistaAnalisi() {
  document.getElementById("sottotitolo").textContent = t("Più raccolte lette insieme: i temi che tornano da un post all'altro.");
  const gruppi = await tutteLeVoci();
  if (!gruppi.length) return mostra(card(el("p", { class: "u-text--muted u-no-margin--bottom", text: "Ancora nessuna raccolta da analizzare." })));

  const scelte = new Set(gruppi.map((g) => g.raccolta.id));
  const caselle = gruppi.map(({ raccolta: r }) => {
    const input = el("input", { type: "checkbox", class: "p-checkbox__input", "aria-labelledby": `sel-${r.id}`, "data-id": String(r.id) });
    input.checked = true;
    input.addEventListener("change", () => { input.checked ? scelte.add(r.id) : scelte.delete(r.id); ridisegna(); });
    return el("label", { class: "p-checkbox" }, input, el("span", { class: "p-checkbox__label", id: `sel-${r.id}` },
      `${r.titolo || r.url} `, el("span", { class: "u-text--muted p-text--small", text: `· ${sitoDi(r)} · ${numero(r.nCommenti)} ${t("commenti")}` })));
  });
  const applica = (filtro) => { caselle.forEach((l) => { const i = l.querySelector("input"); const r = gruppi.find((g) => String(g.raccolta.id) === i.dataset.id).raccolta;
    i.checked = filtro(r); i.checked ? scelte.add(r.id) : scelte.delete(r.id); }); ridisegna(); };

  const esito = el("div");
  const ridisegna = () => {
    const attive = gruppi.filter((g) => scelte.has(g.raccolta.id));
    const unite = unisci(attive);
    esito.replaceChildren(
      el("p", { class: "p-text--small u-text--muted", role: "status", text: tf("{n} raccolte · {c} contenuti", { n: attive.length, c: unite.length }) }),
      ...(attive.length ? bloccoAnalisi(unite) : [card(el("p", { class: "u-no-margin--bottom u-text--muted", text: "Seleziona almeno una raccolta." }))]),
      attive.length ? titolo("Raccolta per raccolta") : null,
      attive.length ? el("table", { class: "p-table--mobile-card" },
        el("thead", {}, el("tr", {}, el("th", { text: "Raccolta" }), el("th", { class: "u-align--right", text: "Commenti" }), el("th", { class: "u-align--right", text: "Domande" }))),
        el("tbody", {}, attive.map(({ raccolta: r, voci: v }) => el("tr", {},
          el("td", { "aria-label": "Raccolta" }, el("a", { href: `#/raccolta/${r.id}`, text: r.titolo || r.url })),
          el("td", { class: "u-align--right", "aria-label": "Commenti", text: numero(r.nCommenti) }),
          el("td", { class: "u-align--right", "aria-label": "Domande", text: numero(v.filter((x) => x.kind !== "post" && x.text.includes("?")).length) }))))) : null);
  };

  mostra(
    card(el("div", { class: "riga-azioni u-sv1" },
      bottone("Tutte", { class: "p-button is-dense u-no-margin--bottom", onclick: () => applica(() => true) }),
      bottone("Nessuna", { class: "p-button is-dense u-no-margin--bottom", onclick: () => applica(() => false) }),
      bottone("Ultimi 30 giorni", { class: "p-button is-dense u-no-margin--bottom", onclick: () => applica((r) => r.quando >= Date.now() - 30 * 86400000) }),
      bottone("Solo Facebook", { class: "p-button is-dense u-no-margin--bottom", onclick: () => applica((r) => sitoDi(r) === "Facebook") }),
      bottone("Solo Instagram", { class: "p-button is-dense u-no-margin--bottom", onclick: () => applica((r) => sitoDi(r) === "Instagram") })),
      el("div", { id: "selezione-raccolte" }, caselle)),
    esito);
  ridisegna();
}

// --- ricerca in tutti i testi ---------------------------------------------------

async function vistaCerca() {
  document.getElementById("sottotitolo").textContent = t("Una parola, tutte le raccolte.");
  const { input, box } = cercaInput("Cerca una parola in tutti i testi…", "cerca-globale");
  input.value = parametri().get("q") || "";
  const conta = el("p", { class: "p-text--small u-text--muted", role: "status" });
  const lista = el("ul", { class: "p-list--divided" });
  const gruppi = await tutteLeVoci();

  const estratto = (testo, q) => {
    const lower = testo.toLocaleLowerCase(locale()); const i = lower.indexOf(q);
    const inizio = Math.max(0, i - 80), fine = Math.min(testo.length, i + q.length + 120);
    const frag = el("span", { class: "snippet" });
    if (inizio > 0) frag.append("…");
    frag.append(testo.slice(inizio, i), el("mark", { text: testo.slice(i, i + q.length) }), testo.slice(i + q.length, fine));
    if (fine < testo.length) frag.append("…");
    return frag;
  };

  const aggiorna = () => {
    const q = input.value.trim().toLocaleLowerCase(locale());
    lista.replaceChildren();
    if (q.length < 2) { conta.textContent = "Scrivi almeno due lettere."; return; }
    const trovati = [];
    for (const { raccolta, voci: righe } of gruppi) for (const v of righe) {
      if (v.text.toLocaleLowerCase(locale()).includes(q)) trovati.push({ raccolta, v });
      if (trovati.length >= 300) break;
    }
    conta.textContent = tf("{n} contenuti in {r} raccolte",
      { n: `${trovati.length}${trovati.length >= 300 ? "+" : ""}`, r: new Set(trovati.map((x) => x.raccolta.id)).size });
    lista.append(...trovati.slice(0, 200).map(({ raccolta, v }) => el("li", { class: "p-list__item" },
      el("p", { class: "p-text--small u-text--muted u-no-margin--bottom" }, iconaSito(raccolta), " ",
        el("a", { href: `#/raccolta/${raccolta.id}?q=${encodeURIComponent(input.value.trim())}`, text: raccolta.titolo || raccolta.url }),
        ` · ${t(ETICHETTA[v.kind] || v.kind)}${v.posted_at_label ? " · " + v.posted_at_label : ""}`),
      el("p", { class: "u-no-margin--bottom" }, estratto(v.text, q)))));
    if (!trovati.length) lista.append(el("li", { class: "p-list__item u-text--muted", text: "Nessun contenuto contiene questa parola." }));
  };
  input.addEventListener("input", aggiorna);
  mostra(el("div", { class: "toolbar" }, box), conta, lista);
  aggiorna();
}

// --- impostazioni ----------------------------------------------------------

async function vistaImpostazioni() {
  document.getElementById("sottotitolo").textContent = t("Privacy, conservazione, backup.");
  const cfg = await impostazioni();

  const interruttore = (id, testo, acceso) => {
    const input = el("input", { type: "checkbox", class: "p-switch__input", role: "switch", id });
    input.checked = acceso;
    return { input, nodo: el("label", { class: "p-switch" }, input, el("span", { class: "p-switch__slider" }), el("span", { class: "p-switch__label", text: testo })) };
  };
  const nomi = interruttore("nomi", "Salva i nomi veri degli autori dei post", cfg.salvaNomi);
  const giorni = el("input", { type: "number", min: "0", max: "3650", id: "giorni", value: String(cfg.giorniConservazione) });
  const inoltra = interruttore("inoltra", "Manda anche a Piazza", cfg.inoltraAPiazza);
  const indirizzo = el("input", { type: "url", id: "indirizzo", value: cfg.indirizzo || "", placeholder: "http://127.0.0.1:5070" });
  const token = el("input", { type: "password", id: "token", value: cfg.token || "", autocomplete: "off" });
  const salvato = el("span", { role: "status", class: "p-text--small u-text--muted" });

  const salva = async () => {
    if (!giorni.checkValidity() || giorni.value === "" || !Number.isInteger(Number(giorni.value))) { giorni.reportValidity(); salvato.textContent = "Inserisci un numero intero fra 0 e 3650."; return; }
    if (inoltra.input.checked) {
      try { const u = new URL(indirizzo.value); if (u.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(u.hostname) || u.username || u.password || u.search || u.hash || u.pathname !== "/") throw new Error(); }
      catch { salvato.textContent = "Usa un indirizzo locale, ad esempio http://127.0.0.1:5070."; return; }
    }
    try {
      await salvaImpostazioni({ salvaNomi: nomi.input.checked, giorniConservazione: Math.max(0, parseInt(giorni.value, 10) || 0),
        inoltraAPiazza: inoltra.input.checked, indirizzo: indirizzo.value.trim(), token: token.value.trim() });
      salvato.textContent = "Impostazioni salvate.";
    } catch { salvato.textContent = "Salvataggio non riuscito. Riprova."; }
    setTimeout(() => (salvato.textContent = ""), 2500);
  };

  // Backup: l'unico modo di portare l'archivio fuori dal browser e di rimetterlo dentro.
  const fileImporta = el("input", { type: "file", id: "importa-file", accept: "application/json,.json", "aria-label": "File di archivio da importare" });
  const esitoBackup = el("p", { class: "p-text--small u-text--muted u-no-margin--bottom", role: "status", id: "esito-backup" });
  fileImporta.addEventListener("change", async () => {
    const file = fileImporta.files && fileImporta.files[0];
    if (!file) return;
    try {
      const dati = JSON.parse(await file.text());
      const { importate, saltate } = await importaArchivio(dati);
      esitoBackup.textContent = tf("Importate {n} raccolte{coda}.",
        { n: importate, coda: saltate ? tf(", {n} saltate perché già presenti o non valide", { n: saltate }) : "" });
      document.getElementById("nav-count").textContent = numero((await elenco()).length);
    } catch (e) { esitoBackup.textContent = tf("Importazione non riuscita: {errore}", { errore: e.message || e }); }
    fileImporta.value = "";
  });

  const sceltaLingua = el("select", { id: "lingua", "aria-label": "Lingua dell'interfaccia" },
    el("option", { value: "auto", text: "Come il browser" }),
    el("option", { value: "it", text: "Italiano" }),
    el("option", { value: "en", text: "Inglese" }));
  sceltaLingua.value = cfg.lingua || "auto";
  // Cambiare lingua ridisegna subito: aspettare il salvataggio confonderebbe.
  sceltaLingua.addEventListener("change", async () => {
    await salvaImpostazioni({ lingua: sceltaLingua.value });
    impostaLinguaLocale(sceltaLingua.value);
    location.reload();
  });

  mostra(
    titolo("Lingua"),
    card(el("label", { for: "lingua", text: "Lingua dell'interfaccia" }), sceltaLingua),
    titolo("Privacy"),
    card(nomi.nodo,
      el("p", { class: "p-text--small u-text--muted", text: "Vale solo per i post. Per commenti e risposte non vengono conservati nomi, profili o pseudonimi: gli autori non compaiono nella lettura né negli export." }),
      el("label", { for: "giorni", text: "Giorni di conservazione (0 = nessun limite)" }), giorni),

    titolo("Inoltro a Piazza (facoltativo)"),
    card(el("p", { class: "p-text--small u-text--muted", text: "L'estensione basta a se stessa. Questo serve solo se vuoi una copia anche nell'applicazione Piazza sul computer, insieme alle raccolte fatte con Playwright." }),
      inoltra.nodo, el("label", { for: "indirizzo", text: "Indirizzo" }), indirizzo, el("label", { for: "token", text: "Parola d'ordine" }), token),
    el("div", { class: "riga-azioni u-sv3" }, bottone("Salva impostazioni", { class: "p-button--positive u-no-margin--bottom", onclick: salva }), salvato),

    titolo("Backup dell'archivio"),
    card(el("p", { class: "u-text--muted", text: "Disinstallare l'estensione cancella l'archivio. Il backup è un file .json con tutte le raccolte: puoi rimetterlo dentro qui, anche su un altro computer. Le raccolte già presenti non vengono duplicate." }),
      el("div", { class: "riga-azioni" },
        bottone("Esporta tutto l'archivio (.json)", { class: "p-button u-no-margin--bottom", id: "esporta-archivio", onclick: async () => {
          const dati = await esportaArchivio();
          scarica(`piazza-archivio-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dati), "application/json");
          esitoBackup.textContent = tf("Esportate {n} raccolte.", { n: dati.raccolte.length });
        } }),
        el("label", { class: "p-button--base u-no-margin--bottom", for: "importa-file", text: "Importa un archivio…" }), fileImporta),
      esitoBackup),

    titolo("Zona pericolosa"),
    card(el("p", { class: "u-text--muted", text: "Cancella tutte le raccolte da questo browser. Le impostazioni restano. Non si torna indietro: esporta prima un backup." }),
      bottone("Cancella tutto l'archivio", { class: "p-button--negative u-no-margin--bottom", id: "cancella-tutto", onclick: async () => {
        const n = (await elenco()).length;
        if (!n) return toast("L'archivio è già vuoto.");
        if (!confirm(tf("Cancellare definitivamente tutte le {n} raccolte?", { n }))) return;
        await cancellaTutto(); toast("Archivio svuotato."); disegna();
      } })));
  fileImporta.hidden = true;
}

// --- diagnostica -----------------------------------------------------------

async function vistaDiagnostica() {
  document.getElementById("sottotitolo").textContent = t("Che cosa ha fatto l'ultima raccolta, passo per passo.");
  const passi = await registro();
  const esito = await ultimoEsito();
  const testo = [
    `Piazza — diagnostica del ${new Date().toLocaleString(locale())}`,
    `ultimo esito: ${esito ? JSON.stringify(esito) : "nessuno"}`, "",
    ...passi.map((v) => { const { t, ...resto } = v; return `${new Date(t).toLocaleTimeString(locale())}  ${JSON.stringify(resto)}`; }),
  ].join("\n");

  mostra(
    avviso("information", "Qui resta la traccia dell'ultima raccolta, anche quando non arriva in fondo. Se qualcosa non torna, copia questo testo: dice dove si è fermata."),
    titolo("Ultimo esito"),
    card(esito
      ? el("div", {}, el("span", { class: esito.ok ? "p-status-label--positive" : "p-status-label--negative", text: esito.ok ? "Archiviata" : "Non archiviata" }),
          el("p", { class: "u-no-margin--bottom u-sv1", text: esito.ok ? tf("{post} post, {commenti} commenti · {quando}", { post: esito.nPost, commenti: esito.nCommenti, quando: quando(esito.quando) }) : `${esito.errore} · ${quando(esito.quando)}` }))
      : el("p", { class: "u-text--muted u-no-margin--bottom", text: "Nessuna raccolta ancora tentata." })),
    titolo(tf("Passi registrati · {n}", { n: passi.length })),
    el("div", { class: "riga-azioni u-sv1" },
      bottone("Copia tutto", { class: "p-button u-no-margin--bottom", onclick: async (e) => { await navigator.clipboard.writeText(testo); e.target.textContent = "Copiato"; setTimeout(() => (e.target.textContent = "Copia tutto"), 2000); } }),
      bottone("Svuota", { class: "p-button--base u-no-margin--bottom", onclick: async () => { await svuotaRegistro(); disegna(); } })),
    el("div", { class: "p-code-snippet" }, el("pre", { class: "p-code-snippet__block", text: passi.length ? testo : "Nessun passo registrato." })));
}

// --- guida -------------------------------------------------------------------

function vistaGuida() {
  document.getElementById("sottotitolo").textContent = t("Dalla pagina alla tua prima lettura aggregata.");
  const passo = (n, t, d) => el("div", { class: "col-4" }, card(el("p", { class: "p-muted-heading", text: n }), el("h3", { class: "p-heading--5", text: t }), el("p", { class: "u-text--muted u-no-margin--bottom", text: d })));
  mostra(
    el("div", { class: "row" },
      passo("01", "Apri una conversazione", "Vai al post o alla pagina di Facebook o Instagram che vuoi leggere, nel tuo Chrome, con l'accesso che hai già."),
      passo("02", "Scegli come raccogliere", "Premi l'icona di Piazza: Visibile salva ciò che è già caricato; Rapida e Approfondita aprono commenti e scorrono, fino a 1 o 3 minuti."),
      passo("03", "Esplora quello che emerge", "Cerca nei testi, filtra le domande, leggi l'analisi, mettine insieme più raccolte ed esporta in Markdown, JSON o CSV.")),
    titolo("Durante la raccolta"),
    card(el("p", { class: "u-no-margin--bottom u-text--muted", text: "Puoi cambiare scheda, chiudere il popup o ridurre la finestra: la raccolta prosegue e il riquadro sulla pagina mostra lo stato. Lascia aperti Chrome e la scheda. Pausa e «Interrompi e salva» restano disponibili nel riquadro." })),
    titolo("Il tuo archivio, sotto controllo"),
    card(el("p", { class: "u-no-margin--bottom u-text--muted", text: "I commenti vengono raccolti senza nomi, profili o pseudonimi. I dati restano in questo profilo Chrome. Disinstallare l'estensione cancella l'archivio: nelle Impostazioni trovi il backup completo, da rimettere dentro quando vuoi." })));
}

// --- instradamento ---------------------------------------------------------

async function disegna() {
  try {
    // La lingua va decisa prima di disegnare: dopo sarebbe troppo tardi.
    impostaLinguaLocale((await impostazioni()).lingua);
    traduciDocumento();
    const [rotta] = location.hash.replace(/^#/, "").split("?");
    const parti = (rotta || "/").split("/").filter(Boolean);
    const titoli = { diagnostica: "Attività e diagnostica", impostazioni: "Impostazioni", raccolta: "Dentro la conversazione", guida: "Come funziona", cerca: "Cerca nei testi", analisi: "Analisi complessiva" };
    const briciole = { diagnostica: "Attività", impostazioni: "Impostazioni", guida: "Come funziona", raccolta: "Raccolta", cerca: "Cerca", analisi: "Analisi" };
    document.getElementById("page-title").textContent = t(titoli[parti[0]] || "Le tue raccolte");
    document.getElementById("breadcrumb").textContent = t(briciole[parti[0]] || "Raccolte");

    if (parti[0] === "guida") vistaGuida();
    else if (parti[0] === "diagnostica") await vistaDiagnostica();
    else if (parti[0] === "impostazioni") await vistaImpostazioni();
    else if (parti[0] === "cerca") await vistaCerca();
    else if (parti[0] === "analisi") await vistaAnalisi();
    else if (parti[0] === "raccolta") await vistaRaccolta(parseInt(parti[1], 10), parti[2]);
    else await vistaElenco();

    const corrente = parti[0] === "raccolta" ? "#/" : `#/${parti[0] || ""}`.replace(/\/$/, "/");
    for (const a of document.querySelectorAll(".p-side-navigation__link")) {
      const attiva = a.getAttribute("href") === (parti.length ? corrente : "#/");
      if (attiva) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
    // Il contatore sta qui e non nella vista elenco: aprendo direttamente una
    // raccolta quella vista non gira, e il numero resterebbe a zero.
    document.getElementById("nav-count").textContent = numero((await elenco()).length);
    const byte = await spazioUsato();
    document.getElementById("spazio").textContent = byte === null ? "" : tf("{mb} MB usati", { mb: (byte / 1048576).toFixed(1) });
    document.getElementById("navigazione").classList.add("is-collapsed");
    window.scrollTo(0, 0);
  } catch (e) {
    mostra(card(el("h2", { class: "p-heading--4", text: "L'archivio non si è aperto" }), el("p", { class: "u-text--muted", text: String(e.message || e) }), bottone("Riprova", { onclick: disegna })));
  }
}

// Menu a scomparsa sui piccoli schermi: Vanilla lo disegna, aprire e chiudere spetta a noi.
const navigazione = document.getElementById("navigazione");
document.getElementById("menu-apri").addEventListener("click", () => { navigazione.classList.remove("is-collapsed"); document.getElementById("menu-apri").setAttribute("aria-expanded", "true"); });
document.getElementById("menu-chiudi").addEventListener("click", () => { navigazione.classList.add("is-collapsed"); document.getElementById("menu-apri").setAttribute("aria-expanded", "false"); });
const fissa = () => navigazione.classList.toggle("is-pinned", window.innerWidth >= 1036);
window.addEventListener("resize", fissa); fissa();

window.addEventListener("hashchange", disegna);
disegna();
