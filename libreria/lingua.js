/*
 * Italiano e inglese.
 *
 * Il dizionario va dall'italiano all'inglese, e la chiave e la frase italiana
 * per intero: cosi il codice resta leggibile - `text: "Le tue raccolte"` invece
 * di `text: t("archivio.titolo")` - e una frase senza traduzione resta in
 * italiano invece di mostrare una sigla.
 *
 * La traduzione si applica in un punto solo: `el()` in archivio.js e popup.js
 * passa di qui ogni `text`, `placeholder`, `aria-label` e `title`. Le frasi con
 * dei numeri dentro usano `tf()` con segnaposto fra graffe.
 */

const DIZIONARIO = {
  // --- navigazione e impianto ---
  "Ascolta. Comprendi.": "Listen. Understand.",
  "Raccolte": "Collections",
  "Cerca nei testi": "Search all texts",
  "Analisi complessiva": "Combined analysis",
  "Attività": "Activity",
  "Impostazioni": "Settings",
  "Come funziona": "How it works",
  "Raccolta": "Collection",
  "Cerca": "Search",
  "Analisi": "Analysis",
  "Menu": "Menu",
  "Chiudi il menu": "Close menu",
  "Navigazione principale": "Main navigation",
  "Archivio locale, in questo profilo del browser.": "Local archive, in this browser profile.",
  "Apertura dell'archivio…": "Opening the archive…",
  "Le tue raccolte": "Your collections",
  "Dalle conversazioni alle idee. Tutto in un unico posto.": "From conversations to ideas. All in one place.",
  "Attività e diagnostica": "Activity and diagnostics",
  "Dentro la conversazione": "Inside the conversation",
  "L'archivio non si è aperto": "The archive did not open",
  "Riprova": "Try again",

  // --- elenco ---
  "Post": "Posts",
  "Commenti e risposte": "Comments and replies",
  "Ultimi 7 giorni": "Last 7 days",
  "Cerca per titolo, pagina o etichetta…": "Search by title, page or label…",
  "Ordina raccolte": "Sort collections",
  "Più recenti": "Most recent",
  "Più commenti": "Most comments",
  "Titolo A–Z": "Title A–Z",
  "Filtra raccolte": "Filter collections",
  "Tutte": "All",
  "Solo Facebook": "Facebook only",
  "Solo Instagram": "Instagram only",
  "Solo parziali": "Partial only",
  "Filtra per etichetta": "Filter by label",
  "Tutte le etichette": "All labels",
  "Senza titolo": "Untitled",
  "post": "posts",
  "commenti": "comments",
  "Apri ›": "Open ›",
  "Nessuna raccolta corrisponde": "No collection matches",
  "La prima conversazione ti aspetta": "Your first conversation awaits",
  "Prova un'altra ricerca o cambia il filtro.": "Try another search or change the filter.",
  "Apri un post di Facebook o Instagram, premi l'icona di Piazza e scegli «Raccogli questa pagina». La ritroverai qui.":
    "Open a Facebook or Instagram post, click the Piazza icon and choose “Collect this page”. You will find it here.",
  "Scopri come iniziare": "See how to start",
  "Cancella le scadute": "Delete expired",
  "Svuota": "Clear",

  // --- stati della raccolta ---
  "Archiviata": "Archived",
  "Parziale": "Partial",
  "Salvata": "Saved",
  "Solo visibile": "Visible only",
  "Non archiviata": "Not archived",

  // --- scheda della raccolta ---
  "Raccolta non trovata.": "Collection not found.",
  "Raccolta senza titolo": "Untitled collection",
  "Apri la pagina originale ↗": "Open the original page ↗",
  "Copia in Markdown": "Copy as Markdown",
  "Cancella": "Delete",
  "Rinomina o etichetta": "Rename or label",
  "Salva": "Save",
  "Titolo della raccolta": "Collection title",
  "Etichetta della raccolta": "Collection label",
  "Etichetta (es. fine vita)": "Label (e.g. end of life)",
  "Salvato": "Saved",
  "‹ Tutte le raccolte": "‹ All collections",
  "Testi": "Texts",
  "Analisi aggregata": "Aggregate analysis",
  "Sono stati salvati i contenuti già visibili, senza aprire commenti o scorrere.":
    "Only the already visible content was saved, without opening comments or scrolling.",
  "La raccolta si è fermata per un limite o su tua richiesta. I contenuti già letti sono salvati.":
    "The collection stopped at a limit or at your request. Everything already read has been saved.",
  "Markdown copiato: incollalo dove vuoi.": "Markdown copied: paste it wherever you like.",
  "Copia non disponibile: usa il pulsante .md.": "Copy unavailable: use the .md button.",

  // --- testi ---
  "Cerca una parola nei testi…": "Search for a word in the texts…",
  "Tipo di contenuto": "Content type",
  "Tutti i contenuti": "All content",
  "Solo post": "Posts only",
  "Solo commenti": "Comments only",
  "Solo risposte": "Replies only",
  "Solo domande": "Questions only",
  "Mostra altri 100": "Show 100 more",
  "Commento": "Comment",
  "Risposta": "Reply",
  "Originale ↗": "Original ↗",
  "Copia testo": "Copy text",
  "Testo copiato": "Text copied",
  "Copia non disponibile. Seleziona il testo e usa Ctrl+C.": "Copy unavailable. Select the text and press Ctrl+C.",
  "Nessun contenuto trovato": "No content found",
  "Prova un'altra parola o scegli un tipo diverso.": "Try another word or pick a different type.",
  "Tipo e conteggi aggiornati": "Type and counts updated",
  "Correzione non salvata. Riprova.": "Correction not saved. Try again.",

  // --- analisi ---
  "risposte": "replies",
  "parole per commento": "words per comment",
  "Di che cosa si parla": "What people are talking about",
  "Espressioni ricorrenti": "Recurring phrases",
  "Post che hanno acceso la discussione": "Posts that sparked the discussion",
  "Reazioni": "Reactions",
  "(senza testo)": "(no text)",
  "Domande poste nei commenti": "Questions asked in the comments",
  "Il materiale più utile per una campagna: sono le obiezioni e i dubbi a cui rispondere.":
    "The most useful material for a campaign: the objections and doubts to answer.",
  "Hashtag e link citati": "Hashtags and links mentioned",
  "Più raccolte lette insieme: i temi che tornano da un post all'altro.":
    "Several collections read together: the themes that recur from one post to the next.",
  "Ancora nessuna raccolta da analizzare.": "No collections to analyse yet.",
  "Nessuna": "None",
  "Ultimi 30 giorni": "Last 30 days",
  "Seleziona almeno una raccolta.": "Select at least one collection.",
  "Raccolta per raccolta": "Collection by collection",
  "Domande": "Questions",

  // --- ricerca globale ---
  "Una parola, tutte le raccolte.": "One word, every collection.",
  "Cerca una parola in tutti i testi…": "Search for a word across all texts…",
  "Scrivi almeno due lettere.": "Type at least two letters.",
  "Nessun contenuto contiene questa parola.": "No content contains this word.",

  // --- impostazioni ---
  "Privacy, conservazione, backup.": "Privacy, retention, backup.",
  "Privacy": "Privacy",
  "Salva i nomi veri degli autori dei post": "Save the real names of post authors",
  "Vale solo per i post. Per commenti e risposte non vengono conservati nomi, profili o pseudonimi: gli autori non compaiono nella lettura né negli export.":
    "Applies to posts only. For comments and replies no names, profiles or pseudonyms are kept: authors appear neither in the reading view nor in exports.",
  "Giorni di conservazione (0 = nessun limite)": "Retention in days (0 = no limit)",
  "Inoltro a Piazza (facoltativo)": "Forwarding to Piazza (optional)",
  "L'estensione basta a se stessa. Questo serve solo se vuoi una copia anche nell'applicazione Piazza sul computer, insieme alle raccolte fatte con Playwright.":
    "The extension is self-sufficient. This is only for keeping a copy in the Piazza desktop app as well, alongside collections made with Playwright.",
  "Manda anche a Piazza": "Also send to Piazza",
  "Indirizzo": "Address",
  "Parola d'ordine": "Passphrase",
  "Salva impostazioni": "Save settings",
  "Impostazioni salvate.": "Settings saved.",
  "Salvataggio non riuscito. Riprova.": "Could not save. Try again.",
  "Inserisci un numero intero fra 0 e 3650.": "Enter a whole number between 0 and 3650.",
  "Usa un indirizzo locale, ad esempio http://127.0.0.1:5070.": "Use a local address, for example http://127.0.0.1:5070.",
  "Lingua": "Language",
  "Lingua dell'interfaccia": "Interface language",
  "Come il browser": "Match the browser",
  "Italiano": "Italiano",
  "Inglese": "English",
  "Backup dell'archivio": "Archive backup",
  "Disinstallare l'estensione cancella l'archivio. Il backup è un file .json con tutte le raccolte: puoi rimetterlo dentro qui, anche su un altro computer. Le raccolte già presenti non vengono duplicate.":
    "Uninstalling the extension deletes the archive. The backup is a .json file with every collection: you can load it back here, even on another computer. Collections already present are not duplicated.",
  "Esporta tutto l'archivio (.json)": "Export the whole archive (.json)",
  "Importa un archivio…": "Import an archive…",
  "File di archivio da importare": "Archive file to import",
  "Zona pericolosa": "Danger zone",
  "Cancella tutte le raccolte da questo browser. Le impostazioni restano. Non si torna indietro: esporta prima un backup.":
    "Delete every collection from this browser. Settings are kept. There is no undo: export a backup first.",
  "Cancella tutto l'archivio": "Delete the whole archive",
  "L'archivio è già vuoto.": "The archive is already empty.",
  "Archivio svuotato.": "Archive emptied.",

  // --- diagnostica ---
  "Che cosa ha fatto l'ultima raccolta, passo per passo.": "What the last collection did, step by step.",
  "Qui resta la traccia dell'ultima raccolta, anche quando non arriva in fondo. Se qualcosa non torna, copia questo testo: dice dove si è fermata.":
    "The trace of the last collection stays here, even when it does not finish. If something is wrong, copy this text: it says where it stopped.",
  "Ultimo esito": "Last outcome",
  "Nessuna raccolta ancora tentata.": "No collection attempted yet.",
  "Copia tutto": "Copy everything",
  "Copiato": "Copied",
  "Nessun passo registrato.": "No steps recorded.",

  // --- guida ---
  "Bastano pochi passi": "It only takes a few steps",
  "Dalla pagina alla tua prima lettura aggregata.": "From the page to your first aggregate reading.",
  "Apri una conversazione": "Open a conversation",
  "Vai al post o alla pagina di Facebook o Instagram che vuoi leggere, nel tuo Chrome, con l'accesso che hai già.":
    "Go to the Facebook or Instagram post or page you want to read, in your own Chrome, with the account you are already signed in to.",
  "Scegli come raccogliere": "Choose how to collect",
  "Premi l'icona di Piazza: Visibile salva ciò che è già caricato; Rapida e Approfondita aprono commenti e scorrono, fino a 1 o 3 minuti.":
    "Click the Piazza icon: Visible saves what is already loaded; Quick and Thorough open comments and scroll, for up to 1 or 3 minutes.",
  "Esplora quello che emerge": "Explore what comes out",
  "Cerca nei testi, filtra le domande, leggi l'analisi, mettine insieme più raccolte ed esporta in Markdown, JSON o CSV.":
    "Search the texts, filter the questions, read the analysis, combine several collections and export to Markdown, JSON or CSV.",
  "Durante la raccolta": "While collecting",
  "Puoi cambiare scheda, chiudere il popup o ridurre la finestra: la raccolta prosegue e il riquadro sulla pagina mostra lo stato. Lascia aperti Chrome e la scheda. Pausa e «Interrompi e salva» restano disponibili nel riquadro.":
    "You can switch tabs, close the popup or minimise the window: the collection carries on and the panel on the page shows its state. Keep Chrome and the tab open. Pause and “Stop and save” stay available in the panel.",
  "Il tuo archivio, sotto controllo": "Your archive, under control",
  "I commenti vengono raccolti senza nomi, profili o pseudonimi. I dati restano in questo profilo Chrome. Disinstallare l'estensione cancella l'archivio: nelle Impostazioni trovi il backup completo, da rimettere dentro quando vuoi.":
    "Comments are collected without names, profiles or pseudonyms. The data stays in this Chrome profile. Uninstalling the extension deletes the archive: Settings has a full backup you can load back whenever you like.",

  // --- popup ---
  "Controllo della pagina…": "Checking the page…",
  "Come vuoi raccogliere?": "How do you want to collect?",
  "Visibile": "Visible",
  "senza scorrere": "without scrolling",
  "Rapida": "Quick",
  "fino a 1 minuto": "up to 1 minute",
  "Approfondita": "Thorough",
  "fino a 3 minuti": "up to 3 minutes",
  "Raccogli questa pagina": "Collect this page",
  "Raccolta in corso…": "Collecting…",
  "Apri l'archivio": "Open the archive",
  "Apri una pagina Facebook o Instagram": "Open a Facebook or Instagram page",
  "Nessun sito compatibile in questa scheda": "No supported site in this tab",
  "Puoi chiudere questo pannello. Segui la raccolta direttamente nella pagina.":
    "You can close this panel. Follow the collection on the page itself.",
  "Una raccolta è già in corso in questa scheda.": "A collection is already running in this tab.",
  "Ultima raccolta salvata": "Last collection saved",
  "Esplora la raccolta ›": "Explore the collection ›",
  "Raccolta avviata": "Collection started",
  "Salvataggio locale": "Saved locally",
  "Archivio locale + inoltro al server": "Local archive + forwarding to the server",

  // --- frasi con numeri: i segnaposto restano identici nelle due lingue ---
  "{n} di {tot} raccolte": "{n} of {tot} collections",
  "{n} raccolte superano i {giorni} giorni di conservazione.": "{n} collections are older than the {giorni}-day retention limit.",
  "Cancellare definitivamente {n} raccolte scadute?": "Permanently delete {n} expired collections?",
  "Cancellare la raccolta «{titolo}» e tutti i suoi contenuti?": "Delete the collection “{titolo}” and all its content?",
  "Cancellare definitivamente tutte le {n} raccolte?": "Permanently delete all {n} collections?",
  "{n} contenuti nella conversazione · {vis} visualizzati": "{n} items in the conversation · {vis} shown",
  "{n} contenuti corrispondenti · {vis} visualizzati": "{n} matching items · {vis} shown",
  "{n} reazioni": "{n} reactions",
  "Tipo del contenuto {n}": "Type of item {n}",
  "{n} raccolte · {c} contenuti": "{n} collections · {c} items",
  "{n} contenuti in {r} raccolte": "{n} items in {r} collections",
  "Passi registrati · {n}": "Recorded steps · {n}",
  "{post} post, {commenti} commenti · {quando}": "{post} posts, {commenti} comments · {quando}",
  "Importate {n} raccolte{coda}.": "Imported {n} collections{coda}.",
  ", {n} saltate perché già presenti o non valide": ", {n} skipped as already present or invalid",
  "Esportate {n} raccolte.": "Exported {n} collections.",
  "Importazione non riuscita: {errore}": "Import failed: {errore}",
  "Contenuti salvati dalla pagina. {sito} può nascondere commenti: l'archivio non certifica la completezza della conversazione.":
    "Content saved from the page. {sito} may hide comments: the archive does not certify that the conversation is complete.",
  "{sito} · {quando}": "{sito} · {quando}",
  "{sito} · {percorso}": "{sito} · {percorso}",
  "{stato} · {elementi} elementi letti. Puoi cambiare scheda o chiudere questo pannello.":
    "{stato} · {elementi} items read. You can switch tabs or close this panel.",
  "{modo} · Commenti senza nomi": "{modo} · Comments without names",
  "Salvata nel browser. Inoltro non riuscito: {errore}": "Saved in the browser. Forwarding failed: {errore}",
  "Non riesco ad avviare la raccolta. Ricarica la pagina e riprova. {errore}":
    "Cannot start the collection. Reload the page and try again. {errore}",
  "Impossibile aprire Piazza: {errore}": "Cannot open Piazza: {errore}",
  "Pagina {sito}": "{sito} page",
  "{mb} MB usati": "{mb} MB used",
};

let scelta = "auto";

/** La lingua in uso: la scelta dell'utente, oppure quella del browser. */
export function lingua() {
  if (scelta === "it" || scelta === "en") return scelta;
  return (navigator.language || "it").toLowerCase().startsWith("it") ? "it" : "en";
}

export function impostaLinguaLocale(valore) {
  scelta = ["it", "en", "auto"].includes(valore) ? valore : "auto";
  document.documentElement.lang = lingua();
}

/** Traduce una frase. Se manca dal dizionario resta in italiano: meglio di una sigla. */
export function t(testo) {
  if (typeof testo !== "string" || lingua() === "it") return testo;
  return DIZIONARIO[testo] ?? DIZIONARIO[testo.trim()] ?? testo;
}

/** Come `t`, ma riempie i segnaposto fra graffe: tf("{n} di {tot} raccolte", {n, tot}). */
export function tf(testo, valori) {
  return t(testo).replace(/\{(\w+)\}/g, (intero, chiave) =>
    Object.prototype.hasOwnProperty.call(valori, chiave) ? String(valori[chiave]) : intero);
}

/**
 * Traduce l'HTML statico della pagina: i nodi di testo, e gli attributi che
 * l'utente legge. Serve per archivio.html e popup.html, che non passano da el().
 */
export function traduciDocumento(radice = document) {
  if (lingua() === "it") return;
  const camminatore = document.createTreeWalker(radice.body || radice, NodeFilter.SHOW_TEXT);
  const nodi = [];
  let n;
  while ((n = camminatore.nextNode())) nodi.push(n);
  for (const nodo of nodi) {
    const grezzo = nodo.nodeValue.trim();
    if (!grezzo) continue;
    const tradotto = t(grezzo);
    if (tradotto !== grezzo) nodo.nodeValue = nodo.nodeValue.replace(grezzo, tradotto);
  }
  for (const el of (radice.body || radice).querySelectorAll("[aria-label],[placeholder],[title]")) {
    for (const attr of ["aria-label", "placeholder", "title"]) {
      const v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, t(v));
    }
  }
}

/** Le voci del dizionario, per il test che verifica di non averne dimenticate. */
export const VOCI = Object.keys(DIZIONARIO);
