/*
 * Apre tutto quello che Facebook tiene ripiegato, poi chiama l'estrattore.
 *
 * Tre cose imparate provandolo sul campo:
 *
 *  1. Facebook ordina i commenti per «Piu rilevanti», che ne nasconde una parte
 *     a prescindere da quanto scorri. Bisogna passare a «Tutti i commenti».
 *  2. La raccolta prosegue anche con scheda o finestra in secondo piano.
 *     Chrome può rallentare i timer; solo il pulsante Pausa sospende il lavoro.
 *  3. I commenti lunghi sono troncati da un «Altro» che spesso non e un
 *     [role=button] e a volte porta davanti dei puntini di sospensione: cercarlo
 *     fra i soli pulsanti non lo trova.
 *
 * Resta quello che c'era di buono: se compare un checkpoint o un CAPTCHA questa
 * funzione si ferma e lo dice. Non aggira nessuna verifica.
 */
globalThis.__piazzaRaccogli = async function (opzioni) {
  if (globalThis.__piazzaSessione?.attiva) return { ok: false, errore: "Una raccolta è già in corso in questa scheda." };
  const sessione = globalThis.__piazzaSessione = { attiva: true, pausa: false, stop: false, testo: "Avvio", elementi: 0, esito: null };
  const o = Object.assign(
    {
      scadenzaMs: 180000, // tetto di durata: non conta il tempo passato in pausa
      maxClic: 400,
      maxAltro: 300,
      pausaMin: 500,
      pausaMax: 1200,
      attesaCrescitaMs: 6000,
      giriAVuotoMax: 3,
      pannello: true,
      soloVisibile: false,
    },
    opzioni || {}
  );

  let scadenza = Date.now() + o.scadenzaMs;
  let interrotto = false;
  const iniziata = Date.now();
  let tempoPausa = 0;
  let battito = null;
  const urlIniziale = location.href;
  // Snapshot incrementali: Facebook può virtualizzare il feed rimuovendo nodi
  // già letti. Manteniamo identità e parentela anche tra DOM differenti.
  const memoria = new Map(), nodi = new WeakMap(), chiavi = new Map();
  let prossimoId = 0;
  const senzaTroncamento = testo => testo.replace(/[\s.…·]*(vedi altro|mostra altro|altro|see more|show more|read more)[\s.…·]*$/i, "").trim();
  const cattura = () => {
    const payload = globalThis.__piazzaEstrai();
    // Su Facebook l'indice della voce corrisponde alla posizione fra gli
    // [role=article], e riconoscere lo stesso nodo fra una cattura e l'altra
    // aiuta a seguire un testo che si espande. Su Instagram quella
    // corrispondenza non esiste - gli indici nascono dai <time> riordinati -
    // e una mappatura sbagliata sarebbe peggio di nessuna mappatura.
    const dom = SITO === "facebook" ? [...document.querySelectorAll(PROFILO.selettore)] : [];
    const indici = new Map(), occorrenze = new Map();
    for (const voce of payload.items || []) {
      const padre = indici.get(voce.parent_index) ?? null;
      const identita = `${voce.kind}|${padre}|${voce.author_url || voce.author_name || ""}`;
      const base = voce.permalink ? `${voce.kind}|${voce.permalink}` : `${identita}|${voce.text}`;
      const occ = occorrenze.get(base) || 0; occorrenze.set(base, occ + 1);
      const chiave = `${base}|${occ}`;
      const nodo = dom[voce.dom_index], precedente = nodo && nodi.get(nodo);
      const vecchio = senzaTroncamento(precedente?.testo || ""), nuovo = senzaTroncamento(voce.text);
      const stesso = precedente && precedente.identita === identita &&
        (precedente.testo === voce.text || (vecchio.length > 15 && nuovo.startsWith(vecchio)) || (nuovo.length > 15 && vecchio.startsWith(nuovo)));
      const id = chiavi.get(chiave) ?? (stesso ? precedente.id : prossimoId++);
      indici.set(voce.dom_index, id); chiavi.set(chiave, id);
      if (nodo) nodi.set(nodo, { id, identita, testo: voce.text });
      const prima = memoria.get(id);
      memoria.set(id, { ...voce, text: prima && prima.text.length > voce.text.length ? prima.text : voce.text, dom_index: id, parent_index: padre });
    }
    sessione.elementi = [...memoria.values()].filter(v=>v.text.trim().length>1).length;
    return { ...payload, url: urlIniziale, items: [...memoria.values()] };
  };

  /**
   * Facebook e Instagram chiamano le stesse cose in modi diversi, e soprattutto
   * marcano i contenuti in modi diversi: su Facebook ogni post e commento e un
   * [role=article], su Instagram no - li si riconoscono dal <time datetime>.
   * Tutto cio che dipende dal sito sta raccolto qui.
   */
  const SITO = (() => {
    const h = location.hostname.replace(/^www\./, "");
    return h === "instagram.com" || h.endsWith(".instagram.com") ? "instagram" : "facebook";
  })();

  const PROFILI = {
    facebook: {
      selettore: '[role="article"], article',
      altriCommenti:
        /(visualizza|mostra|vedi|carica|view|see|load)\s.{0,30}(commenti|commento|comments|comment|precedenti|previous)/i,
      altreRisposte:
        /(visualizza|mostra|vedi|view|see)\s.{0,30}(risposte|risposta|replies|reply)|^\d+\s+(risposte|risposta|replies|reply)$/i,
      altro: /^[\s.…·]*(vedi altro|mostra altro|altro|leggi tutto|continua a leggere|see more|show more|read more|see full comment)[\s.…·]*$/i,
      ordina: true,
    },
    instagram: {
      // Su Instagram si contano i <time>: uno per didascalia e uno per commento.
      selettore: "time[datetime]",
      altriCommenti:
        /(carica|visualizza|mostra|vedi|load|view|see)\s.{0,24}(altri\s+)?(commenti|comments)/i,
      // «Nascondi risposte» va escluso di proposito: cliccarlo le richiuderebbe.
      altreRisposte:
        /(visualizza|mostra|vedi|view|see)\s.{0,28}(risposte|replies)|^\d+\s*(risposte|replies)$/i,
      altro: /^[\s.…·]*(altro|ancora|more)[\s.…·]*$/i,
      ordina: false, // Instagram non offre un ordinamento dei commenti
    },
  };

  const PROFILO = PROFILI[SITO];
  const ALTRI_COMMENTI = PROFILO.altriCommenti;
  const ALTRE_RISPOSTE = PROFILO.altreRisposte;
  // Facebook cambia l'etichetta di questo pulsante a seconda di dove sei e di
  // che ordinamento e attivo, quindi vanno riconosciute tutte le varianti: e il
  // passaggio che sblocca i commenti nascosti, se fallisce non se ne apre uno.
  const ORDINAMENTO = /^[\s·]*(più rilevanti|piu rilevanti|principali|in evidenza|più recenti|piu recenti|meno recenti|tutti i commenti|most relevant|top comments|newest|oldest|all comments)[\s·]*$/i;
  const ORDINA_ETICHETTA = /\b(ordin|sort)/i; // aria-label tipo «Ordina i commenti»
  const GIA_TUTTI = /^[\s·]*(tutti i commenti|all comments)[\s·]*$/i;
  const TUTTI_I_COMMENTI = /^[\s·]*(tutti i commenti|all comments|tutti)[\s·]*$/i;
  // I puntini davanti sono quelli con cui il testo lungo viene troncato.
  const ALTRO = PROFILO.altro;

  /**
   * Il contenitore da scorrere.
   *
   * Su Facebook scorre la finestra. Su Instagram i commenti vivono spesso in un
   * riquadro con scorrimento proprio: muovere la finestra non carica nulla.
   * Si cerca una volta sola, perche getComputedStyle su molti nodi si paga.
   */
  let contenitoreNoto;
  const contenitoreScorrevole = () => {
    if (contenitoreNoto !== undefined) return contenitoreNoto;
    contenitoreNoto = null;
    if (SITO !== "instagram") return null;
    const radice = document.querySelector('article, [role="main"], main') || document.body;
    let esaminati = 0;
    for (const el of radice.querySelectorAll("div, ul, section")) {
      if (++esaminati > 400) break;
      if (el.scrollHeight - el.clientHeight < 200) continue;
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowY)) continue;
      if (!contenitoreNoto || el.scrollHeight > contenitoreNoto.scrollHeight) contenitoreNoto = el;
    }
    return contenitoreNoto;
  };

  const scorri = () => {
    const c = contenitoreScorrevole();
    if (c) c.scrollTop = c.scrollHeight;
    window.scrollBy(0, Math.max(600, window.innerHeight * 0.85));
  };

  /*
   * Il riquadro sulla pagina parla la lingua del browser.
   *
   * Questo file viene iniettato con executeScript, non e un modulo: non puo
   * importare libreria/lingua.js. Le frasi sono poche e stanno qui.
   */
  const INGLESE = {
    "Piazza — raccolta in corso": "Piazza — collecting",
    "Pausa": "Pause",
    "Riprendi": "Resume",
    "Interrompi e salva": "Stop and save",
    "in pausa — premi Riprendi per continuare": "paused — press Resume to continue",
    "ripresa in corso": "resuming",
    "Salvataggio dei contenuti letti…": "Saving what has been read…",
    "passaggio a «Tutti i commenti»": "switching to “All comments”",
    "Lettura dei contenuti già caricati": "Reading the content already loaded",
    "pannello dei commenti aperto": "comments panel opened",
    "commenti in apertura": "opening comments",
    "risposte in apertura": "opening replies",
    "scorrimento": "scrolling",
    "apertura dei commenti lunghi": "expanding long comments",
    "lettura del contenuto": "reading the content",
    "Piazza — archiviata": "Piazza — archived",
    "Piazza — non archiviata": "Piazza — not archived",
    "Tempo scaduto: potrebbe mancare qualcosa.": "Time limit reached: something may be missing.",
    "Interrotta da te.": "Stopped by you.",
    "Pagina esaurita.": "Nothing more on the page.",
    "Errore sconosciuto.": "Unknown error.",
    "Facebook ha aperto un checkpoint di sicurezza. Sbloccalo a mano nella scheda, poi riprova.":
      "Facebook opened a security checkpoint. Clear it by hand in the tab, then try again.",
    "Questa scheda non risulta collegata a Facebook. Accedi nella scheda e riprova.":
      "This tab does not appear to be signed in. Sign in in the tab and try again.",
    "La pagina mostra un CAPTCHA. Piazza non li risolve: sistemalo a mano e riprova.":
      "The page is showing a CAPTCHA. Piazza does not solve them: clear it by hand and try again.",
  };
  const inglese = !(navigator.language || "it").toLowerCase().startsWith("it");
  const tr = (testo) => (inglese && INGLESE[testo]) || testo;

  const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
  const pausa = () => dormi(o.pausaMin + Math.random() * (o.pausaMax - o.pausaMin));
  const contaArticoli = () => document.querySelectorAll(PROFILO.selettore).length;

  // ---- il riquadro sulla pagina -------------------------------------------
  // Serve a rispondere alla domanda «sta facendo qualcosa?» senza dover tenere
  // aperto il pannello dell'estensione, che si chiude da solo.

  let pannello = null;
  let rigaStato = null;
  let rigaConto = null;

  const creaPannello = () => {
    if (!o.pannello || pannello) return;
    document.querySelectorAll('[data-piazza="1"]').forEach(n=>n.remove());
    pannello = document.createElement("div");
    pannello.id = "piazza-pannello";
    pannello.setAttribute("data-piazza", "1");
    pannello.setAttribute("role", "region");
    pannello.setAttribute("aria-label", "Piazza · Stato della raccolta");
    pannello.style.cssText = "box-sizing:border-box;position:fixed;right:20px;bottom:20px;z-index:2147483647;width:340px;max-width:calc(100vw - 40px);padding:20px;border-radius:18px;background:#f8faf5;color:#203b30;box-shadow:0 16px 60px #10291f33;border:1px solid #d4e1d2;font:13px/1.5 system-ui,sans-serif;text-align:left;";
    const stile = document.createElement("style");
    stile.textContent = `#piazza-pannello *{box-sizing:border-box} #piazza-pannello button{font:600 12px/1.4 system-ui;cursor:pointer;border:1px solid #d2dfd2;border-radius:8px;padding:9px 12px;background:white;color:#244f3c} #piazza-pannello button:focus-visible{outline:3px solid #789e7c;outline-offset:2px} #piazza-pannello button:hover{background:#e9f1e5}`;
    const testa = document.createElement("div");
    testa.style.cssText = "display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;margin-bottom:17px";
    testa.textContent = "◍ Piazza";
    const etichetta = document.createElement("span"); etichetta.textContent = "RACCOLTA IN CORSO";
    etichetta.style.cssText = "margin-left:auto;font-size:9px;letter-spacing:1px;font-weight:600;color:#64816b"; testa.append(etichetta);
    rigaStato = document.createElement("div"); rigaStato.setAttribute("role", "status");
    rigaStato.style.cssText = "color:#607565;font-size:12px;margin-bottom:12px;min-height:36px";
    rigaConto = document.createElement("div"); rigaConto.style.cssText = "font-size:25px;font-weight:600;letter-spacing:-.5px;margin-bottom:6px;font-variant-numeric:tabular-nums";
    const tempo = document.createElement("div"); tempo.style.cssText = "font-size:10px;color:#607565;margin-bottom:15px";
    const aggiornaTempo = () => { const secondi=Math.floor((Date.now()-iniziata-tempoPausa)/1000); tempo.textContent=`${Math.floor(secondi/60)}:${String(secondi%60).padStart(2,"0")} di tempo attivo · limite ${Math.round(o.scadenzaMs/60000)} min`; };
    battito=setInterval(()=>{if(!sessione.pausa) aggiornaTempo();},1000); aggiornaTempo();
    const azioni = document.createElement("div"); azioni.style.cssText="display:flex;gap:8px";
    const sospendi=document.createElement("button"); sospendi.textContent=tr("Pausa");
    sospendi.onclick=()=>{ sessione.pausa=!sessione.pausa; sospendi.textContent=tr(sessione.pausa?"Riprendi":"Pausa"); segnala(tr(sessione.pausa?"in pausa — premi Riprendi per continuare":"ripresa in corso")); };
    const stop = document.createElement("button"); stop.textContent=tr("Interrompi e salva"); stop.style.cssText="flex:1;background:#173e34;color:#f0f7e9;border-color:#173e34";
    stop.onclick=()=>{sessione.stop=true;interrotto=true;sessione.pausa=false;stop.disabled=true;segnala(tr("Salvataggio dei contenuti letti…"));};
    azioni.append(sospendi,stop);
    pannello.append(stile,testa,rigaStato,rigaConto,tempo,azioni);
    document.body.appendChild(pannello);
  };

  const togliPannello = () => {
    if (battito) { clearInterval(battito); battito = null; }
    if (pannello) { pannello.remove(); pannello = null; }
  };

  /** Toglie il riquadro dal DOM tenendone il posto per il messaggio finale. */
  const svuotaPannello = () => togliPannello();

  /** Consegna al service worker, che archivia. Torna l'esito, o null se non c'e. */
  const consegna = async (payload) => {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) return null;
      const risposta = await chrome.runtime.sendMessage({ tipo: "invia", payload });
      return risposta || { ok: false, errore: "L'estensione non ha risposto." };
    } catch (e) {
      return { ok: false, errore: String((e && e.message) || e) };
    }
  };

  /** Il verdetto resta scritto sulla pagina: e li che stai guardando. */
  const esitoSulPannello = (archivio, payload) => {
    togliPannello();
    sessione.esito = archivio;
    if (!o.pannello || archivio === null) return;

    const buono = archivio && archivio.ok;
    const cassetta = document.createElement("div");
    cassetta.setAttribute("data-piazza", "1");
    cassetta.style.cssText = [
      "box-sizing:border-box", "position:fixed", "right:18px", "bottom:18px", "z-index:2147483647",
      "width:340px", "max-width:calc(100vw - 40px)", "padding:20px", "border-radius:18px",
      buono ? "background:#0f2b25" : "background:#3a1d19",
      buono ? "color:#eaf5f1" : "color:#f6d9d4",
      "box-shadow:0 12px 40px -12px rgba(0,0,0,.55)",
      "font:13px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
      buono ? "border:1px solid rgba(95,211,180,.28)" : "border:1px solid rgba(240,167,157,.3)",
    ].join(";");

    const titolo = document.createElement("div");
    titolo.style.cssText = "font-weight:650;margin-bottom:6px";
    titolo.textContent = tr(buono ? "Piazza — archiviata" : "Piazza — non archiviata");

    const dettaglio = document.createElement("div");
    dettaglio.style.cssText = "opacity:.9";
    if (buono) {
      dettaglio.textContent = `${archivio.nPost} post, ${archivio.nCommenti} commenti e risposte.`;
    } else {
      dettaglio.textContent = (archivio && archivio.errore) || tr("Errore sconosciuto.");
    }

    cassetta.append(titolo, dettaglio);
    if (buono && payload && payload.diagnostica) {
      const nota = document.createElement("div");
      nota.style.cssText = "opacity:.55;margin-top:6px;font-size:12px";
      const d = payload.diagnostica;
      nota.textContent = d.tempoScaduto
        ? "Tempo scaduto: potrebbe mancare qualcosa."
        : d.interrotto ? "Interrotta da te: contenuti già letti salvati." : d.soloVisibile ? "Salvati solo i contenuti già visibili." : d.limiteClic ? "Limite di apertura raggiunto: raccolta parziale." : "Non sono comparsi altri contenuti. Facebook può nasconderne altri.";
      cassetta.append(nota);
    }

    document.body.appendChild(cassetta);
    const azioni = document.createElement("div"); azioni.style.cssText="display:flex;gap:8px;margin-top:14px";
    const pulsante = (testo, azione) => { const b=document.createElement("button");b.textContent=testo;b.style.cssText="font:600 12px system-ui;padding:9px 12px;background:#e3efce;color:#173e34;border:0;border-radius:7px;cursor:pointer";b.onclick=azione;return b; };
    if (buono) azioni.append(pulsante("Apri la raccolta ↗",()=>{chrome.runtime.sendMessage({tipo:"apriArchivio",id:archivio.id}).catch(()=>{});}));
    else if(payload) azioni.append(pulsante("Riprova a salvare",async(e)=>{e.target.disabled=true; const nuovo=await consegna(payload); cassetta.remove(); esitoSulPannello(nuovo,payload);}));
    azioni.append(pulsante("Chiudi",()=>cassetta.remove())); cassetta.append(azioni);
    if (archivio.avvisoInoltro) { const n=document.createElement("div");n.style.cssText="font-size:11px;margin-top:10px;color:#e8c68b";n.textContent="Salvata qui. Inoltro al server non riuscito: "+archivio.avvisoInoltro;cassetta.append(n); }
  };

  const registro = [];

  /**
   * Aggiorna il riquadro e lascia una traccia.
   *
   * La traccia serve quando qualcosa va storto e non si arriva alla fine: il
   * service worker la conserva, e in «Diagnostica» si legge dove si e fermata.
   * Senza, un guasto su una pagina vera resta invisibile.
   */
  const segnala = (testo) => {
    const conta = contaArticoli();
    if (rigaStato) rigaStato.textContent = testo;
    sessione.testo = testo;
    if (rigaConto) rigaConto.textContent = `${sessione.elementi} elementi letti`;
    registro.push({ t: Date.now(), testo, articoli: conta });
    try {
      const invio = chrome.runtime.sendMessage({ tipo: "stato", testo, articoli: conta });
      // In MV3 senza ascoltatori la promessa viene respinta: e normale, e il
      // popup chiuso. Va assorbita, o resta un rifiuto non gestito a ogni passo.
      if (invio && invio.catch) invio.catch(() => {});
    } catch (e) {
      /* niente runtime: siamo fuori dall'estensione */
    }
  };

  // ---- pausa richiesta dall’utente --------------------------

  const attendiPausa = async () => {
    if (!sessione.pausa || sessione.stop) return;
    const inizio = Date.now();
    segnala(tr("in pausa — premi Riprendi per continuare"));
    while (sessione.pausa && !sessione.stop) await dormi(150);
    const durata=Date.now()-inizio; scadenza+=durata; tempoPausa+=durata;
    if(!sessione.stop) segnala("ripreso");
  };
  const scaduto = () => Date.now() > scadenza || interrotto || sessione.stop;

  // ---- guardie -------------------------------------------------------------

  const guardia = () => {
    const url = location.href.toLowerCase();
    if (location.href !== urlIniziale) return "La pagina è cambiata durante la raccolta. Torna alla pagina da raccogliere e riprova.";
    if (url.includes("/checkpoint/") || url.includes("/challenge/"))
      return tr("Facebook ha aperto un checkpoint di sicurezza. Sbloccalo a mano nella scheda, poi riprova.");
    if (url.includes("/login") || document.querySelector('input[name="pass"]'))
      return tr("Questa scheda non risulta collegata a Facebook. Accedi nella scheda e riprova.");
    if (document.querySelector('iframe[src*="recaptcha"], iframe[title*="captcha" i], [id*="captcha" i]'))
      return tr("La pagina mostra un CAPTCHA. Piazza non li risolve: sistemalo a mano e riprova.");
    return null;
  };

  const visibile = (el) => {
    try {
      if (el.checkVisibility && !el.checkVisibility()) return false;
    } catch (e) { /* browser senza checkVisibility */ }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const nostro = (el) => !!(el.closest && el.closest("[data-piazza]"));
  const nomeDi = (el) => (el.getAttribute("aria-label") || el.innerText || "").trim();

  /**
   * I pulsanti il cui nome corrisponde.
   *
   * Il filtro grosso si fa con textContent, non con innerText: su una pagina di
   * Facebook ci sono migliaia di [role=button], e innerText forza un ricalcolo
   * del layout a ogni lettura. Il primo giro costava minuti e mangiava tutto il
   * tempo a disposizione prima ancora di aprire un commento. textContent legge
   * l'albero e basta; innerText e getBoundingClientRect si pagano solo sui pochi
   * candidati rimasti.
   */
  const pulsanti = (regex, limite = 60) => {
    const trovati = [];
    for (const el of document.querySelectorAll('[role="button"], button, a[role="button"]')) {
      const etichetta = el.getAttribute("aria-label");
      const grezzo = etichetta !== null ? etichetta : el.textContent || "";
      if (!grezzo || grezzo.length > 160) continue;
      const nome = grezzo.trim();
      if (!nome || nome.length > 90 || !regex.test(nome)) continue;
      if (nostro(el) || !visibile(el)) continue;
      trovati.push(el);
      if (trovati.length >= limite) break;
    }
    return trovati;
  };

  /**
   * I «Altro» che troncano i commenti lunghi.
   *
   * Non basta guardare fra i [role=button]: dentro i commenti Facebook usa
   * spesso uno <span> semplice, e il testo puo avere davanti i puntini di
   * sospensione. Si cercano quindi i nodi di testo brevi che corrispondono, e
   * si clicca l'antenato cliccabile piu vicino.
   */
  const trovaAltro = (limite = 80) => {
    const trovati = [];
    const visti = new Set();
    const camminatore = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let nodo;
    while ((nodo = camminatore.nextNode())) {
      const testo = (nodo.nodeValue || "").trim();
      if (!testo || testo.length > 26 || !ALTRO.test(testo)) continue;
      const genitore = nodo.parentElement;
      if (!genitore || nostro(genitore)) continue;
      if (!genitore.closest('[role="article"], article')) continue;
      const cliccabile = genitore.closest('[role="button"], [tabindex], a') || genitore;
      if (visti.has(cliccabile) || !visibile(cliccabile)) continue;
      visti.add(cliccabile);
      trovati.push(cliccabile);
      if (trovati.length >= limite) break;
    }
    return trovati;
  };

  const attendiCrescita = async (partenza) => {
    const finestra = Date.now() + o.attesaCrescitaMs;
    const partenzaElementi = sessione.elementi;
    while (Date.now() < finestra && !scaduto()) {
      cattura();
      if (contaArticoli() > partenza || sessione.elementi > partenzaElementi) return true;
      await attendiPausa();
      await dormi(200);
    }
    return false;
  };

  /**
   * Nei Reel - su Facebook come su Instagram - e nei video, il pannello dei
   * commenti resta chiuso finche non si preme l'icona dei commenti: e senza
   * pannello nel DOM non c'e niente da leggere. Si prova ad aprirlo solo se la
   * pagina sembra vuota, cosi su un post normale non si tocca nulla.
   *
   * Su Instagram l'etichetta sta sull'<svg> dell'icona, non sul pulsante che
   * la contiene: per questo si guardano anche le icone.
   */
  const PANNELLO_COMMENTI =
    /^[\s·]*((\d[\d.,]*\s*)?(commenta|commenti|commento|comment|comments)|(visualizza|mostra|vedi|apri|view|see|show|open)\s.{0,20}(commenti|comments))[\s·]*$/i;

  const candidatiPannello = () => {
    const trovati = [];
    const aggiungi = (el) => { if (el && !nostro(el) && visibile(el) && !trovati.includes(el)) trovati.push(el); };
    for (const el of pulsanti(PANNELLO_COMMENTI, 6)) aggiungi(el);
    for (const svg of document.querySelectorAll("svg[aria-label]")) {
      if (!PANNELLO_COMMENTI.test(svg.getAttribute("aria-label") || "")) continue;
      aggiungi(svg.closest('[role="button"], button, a') || svg.parentElement);
      if (trovati.length >= 6) break;
    }
    return trovati;
  };

  const apriPannelloCommenti = async () => {
    if (contaArticoli() >= 2) return false;
    for (const el of candidatiPannello()) {
      if (scaduto()) break;
      const prima = contaArticoli();
      try { el.scrollIntoView({ block: "center" }); el.click(); } catch (e) { continue; }
      if (await attendiCrescita(prima)) { segnala(tr("pannello dei commenti aperto")); return true; }
    }
    return false;
  };

  /**
   * I pulsanti che aprono il menu d'ordinamento dei commenti.
   *
   * Due criteri, perche Facebook ne usa due: l'etichetta visibile («Più
   * rilevanti») e, quando il testo e sostituito da un'icona, un aria-label che
   * parla di ordinamento.
   */
  const pulsantiOrdinamento = () => {
    const trovati = new Set(pulsanti(ORDINAMENTO, 12));
    for (const el of document.querySelectorAll('[role="button"], button')) {
      const etichetta = el.getAttribute("aria-label");
      if (!etichetta || etichetta.length > 60 || !ORDINA_ETICHETTA.test(etichetta)) continue;
      if (nostro(el) || !visibile(el)) continue;
      trovati.add(el);
      if (trovati.size >= 12) break;
    }
    return [...trovati];
  };

  const ordinaPerTutti = async () => {
    if (!PROFILO.ordina) return 0; // Instagram non offre un ordinamento
    let cambiati = 0;
    for (const apri of pulsantiOrdinamento()) {
      // Se e gia su «Tutti i commenti» aprire il menu non serve, e anzi rischia
      // di cambiare un ordinamento che andava bene.
      if (GIA_TUTTI.test(nomeDi(apri))) { cambiati++; continue; }
      if (scaduto()) break;
      await attendiPausa();
      try {
        if (scaduto()) break;
        cattura();
        apri.scrollIntoView({ block: "center" });
        apri.click();
        await dormi(700);
        const voci = [];
        for (const v of document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')) {
          if (TUTTI_I_COMMENTI.test(nomeDi(v)) && visibile(v)) voci.push(v);
        }
        if (voci.length) {
          voci[0].click();
          cambiati++;
          await dormi(1200);
        } else {
          document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          await dormi(300);
        }
      } catch (e) { /* menu sparito sotto le mani */ }
    }
    return cambiati;
  };

  const apriRipiegati = async (regex, etichetta, budget) => {
    let clic = 0;
    let aVuoto = 0;

    while (clic < budget && aVuoto < o.giriAVuotoMax && !scaduto()) {
      await attendiPausa();
      const errore = guardia();
      if (errore) throw new Error(errore);

      const trovati = pulsanti(regex, 40);
      if (!trovati.length) break;

      let progredito = false;
      for (const el of trovati) {
        if (clic >= budget || scaduto()) break;
        await attendiPausa();
        if (scaduto()) break;
        cattura();
        const prima = contaArticoli();
        try {
          el.scrollIntoView({ block: "center" });
          el.click();
          clic++;
        } catch (e) { continue; }
        if (await attendiCrescita(prima)) progredito = true;
        segnala(tr(`${etichetta} in apertura`)); // la frase intera sta nel dizionario
        await pausa();
      }
      aVuoto = progredito ? 0 : aVuoto + 1;
    }
    return clic;
  };

  const apriTestiTroncati = async () => {
    let aperti = 0;
    for (let giro = 0; giro < 8 && aperti < o.maxAltro && !scaduto(); giro++) {
      await attendiPausa();
      const trovati = trovaAltro(o.maxAltro - aperti);
      if (!trovati.length) break;
      for (const el of trovati) {
        if (aperti >= o.maxAltro || scaduto()) break;
        try { el.click(); aperti++; } catch (e) { /* niente */ }
      }
      cattura();
      segnala(`testi lunghi aperti: ${aperti}`);
      await dormi(400); // il testo si espande, non arrivano articoli nuovi
    }
    return aperti;
  };

  // ---- il giro principale ---------------------------------------------------

  try {
    const subito = guardia();
    if (subito) throw new Error(subito);

    creaPannello();
    segnala(tr(o.soloVisibile ? "Lettura dei contenuti già caricati" : "passaggio a «Tutti i commenti»"));
    await attendiPausa();
    cattura();
    const pannelloAperto = o.soloVisibile ? false : await apriPannelloCommenti();
    const riordinati = o.soloVisibile ? 0 : await ordinaPerTutti();

    let clic = 0;
    let fermo = 0;

    while (!o.soloVisibile && fermo < o.giriAVuotoMax && !scaduto() && clic < o.maxClic) {
      cattura();
      const prima = sessione.elementi;

      clic += await apriRipiegati(ALTRI_COMMENTI, "commenti", o.maxClic - clic);
      clic += await apriRipiegati(ALTRE_RISPOSTE, "risposte", o.maxClic - clic);

      await attendiPausa();
      if (scaduto()) break;
      cattura();
      scorri();
      await pausa();
      await attendiCrescita(contaArticoli());
      await pausa();
      segnala(tr("scorrimento"));

      cattura();
      fermo = sessione.elementi > prima ? 0 : fermo + 1;
    }

    segnala(tr("apertura dei commenti lunghi"));
    const altro = o.soloVisibile ? 0 : await apriTestiTroncati();

    const errore = guardia();
    if (errore) { esitoSulPannello({ ok: false, errore }); return { ok: false, errore }; }

    segnala(tr("lettura del contenuto"));
    const articoli = contaArticoli();
    svuotaPannello(); // fuori dal DOM prima di leggere
    const payload = cattura();
    payload.diagnostica = {
      clic,
      testiLunghiAperti: altro,
      ordinamentiCambiati: riordinati,
      pannelloAperto,
      articoliNelDom: articoli,
      tempoScaduto: Date.now() > scadenza,
      interrotto: interrotto || sessione.stop,
      soloVisibile: o.soloVisibile,
      limiteClic: clic >= o.maxClic,
      durataAttivaMs: Date.now() - iniziata - tempoPausa,
      articoliLetti: payload.items ? payload.items.length : 0,
    };
    payload.registro = registro;

    // La consegna parte da qui, non dal popup.
    //
    // Il popup muore appena lo chiudi, e con lui muore l'attesa del risultato:
    // finiva che la raccolta si completava e non la riceveva nessuno. Lo script
    // nella pagina invece sopravvive, quindi consegna lui.
    const archivio = await consegna(payload);
    esitoSulPannello(archivio, payload);
    return { ok: true, payload, archivio };
  } catch (e) {
    const errore = String((e && e.message) || e);
    segnala(`errore: ${errore}`);
    try {
      const invio = chrome.runtime.sendMessage({ tipo: "errore", errore, registro });
      if (invio && invio.catch) invio.catch(() => {});
    } catch (_) { /* niente runtime */ }
    esitoSulPannello({ ok: false, errore });
    return { ok: false, errore };
  } finally {
    sessione.attiva = false;
    if (battito) clearInterval(battito);
  }
};
