// GENERATO DA tools/build_estensione.py — non modificare a mano.
// Le sorgenti sono piazza/extract.js (Facebook, condivisa con la raccolta via
// Playwright) e piazza/extract_instagram.js.
globalThis.__piazzaEstraiFacebook = (
/*
 * Estrazione in un solo passaggio dal DOM di Facebook.
 *
 * Lo starter faceva una chiamata Playwright per ogni articolo e per ognuno dei
 * suoi link: su una pagina con 40 post erano oltre mille round-trip fra Python e
 * il browser. Qui il lavoro si fa tutto dentro la pagina e torna un solo JSON.
 *
 * Nulla qui dentro aggira protezioni: leggiamo soltanto quello che il browser ha
 * già disegnato nella sessione autenticata dall'utente.
 *
 * I selettori di Facebook cambiano senza preavviso. Ogni campo è quindi
 * opzionale e ogni euristica è racchiusa in un try/catch: se un pezzo smette di
 * funzionare perdiamo quel campo, non l'intera raccolta.
 */
() => {
  const TRACKING = ["__cft__", "__tn__", "fbclid", "__eep__", "notif_t", "notif_id", "ref", "rdid"];

  const clean = (s) =>
    (s || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const abs = (href) => {
    if (!href) return null;
    try {
      // location.origin vale "null" nelle pagine senza origine (about:blank, data:).
      const base = /^https?:/.test(location.origin) ? location.origin : "https://www.facebook.com";
      const u = new URL(href, base);
      // I parametri di Facebook sono indicizzati (__cft__[0], __cft__[1]):
      // vanno tolti per prefisso, non per nome esatto.
      for (const key of Array.from(u.searchParams.keys())) {
        if (TRACKING.some((t) => key === t || key.startsWith(t))) u.searchParams.delete(key);
      }
      return u.href;
    } catch (e) {
      return href; // meglio un link relativo che nessun link
    }
  };

  // Righe di interfaccia da togliere dal corpo del testo (italiano e inglese).
  const CHROME = [
    /^(mi piace|piace|commenta|commento|condividi|rispondi|invia|altro|segui|iscriviti)$/i,
    /^(like|comment|share|reply|send|more|follow|subscribe)$/i,
    /^(vedi altro|mostra altro|see more|see less|nascondi|hide|traduci|see translation|vedi traduzione)$/i,
    /^(modificato|edited|autore|author|admin|amministratore|top fan|principali contributori)$/i,
    /^(tutte le reazioni|all reactions|più rilevanti|most relevant|tutti i commenti|all comments|in evidenza)\s*:?$/i,
    /^(visualizza|mostra|view|see)\s+.{0,20}(commenti|comments|risposte|replies|precedenti|previous)/i,
    /^\d[\d.,]*\s*(commenti|commento|comments|comment|condivisioni|shares|share|visualizzazioni|views|risposte|replies)$/i,
    /^\d[\d.,]*$/,
    // orari relativi isolati: "2 g", "5 h", "12 min", "1 sett", "3 d"
    /^\d+\s*(min|minuti|h|ore|g|gg|giorni|sett|settimane|mesi|anni|m|d|w|y|hr|hrs|day|days|wk|wks)$/i,
    /^(adesso|ora|just now|yesterday|ieri)$/i,
  ];

  const isChromeLine = (line) => {
    const t = line.trim();
    if (!t) return false;
    if (t.length > 60) return false;
    return CHROME.some((re) => re.test(t));
  };

  const stripChrome = (text) =>
    clean(
      text
        .split("\n")
        .filter((line) => !isChromeLine(line))
        .join("\n")
    );

  const safeText = (el) => {
    try {
      return el.innerText || el.textContent || "";
    } catch (e) {
      return "";
    }
  };

  const articles = Array.from(document.querySelectorAll('[role="article"], article'));
  const indexOf = new Map();
  articles.forEach((el, i) => indexOf.set(el, i));

  // La parentela del DOM aiuta a collegare le risposte; non decide da sola
  // se un articolo indipendente sia un post o un commento.
  const ancestorArticle = (el) => {
    let p = el.parentElement;
    while (p) {
      if (p.nodeType === 1 && p.matches && p.matches('[role="article"], article')) return p;
      p = p.parentElement;
    }
    return null;
  };

  const ownsNode = (article, node) => {
    // true se il nodo appartiene a questo articolo e non a un commento annidato
    try {
      return node.closest('[role="article"], article') === article;
    } catch (e) {
      return false;
    }
  };

  const PERMA = /(\/posts\/|story_fbid=|\/permalink\/|\/videos\/|\/reel\/|\/photo\/|comment_id=|\/groups\/[^/]+\/posts\/)/;
  const TIMEISH = /^\d+\s*(min|h|g|gg|sett|m|d|w|y|hr)\b|^(adesso|ora|just now|ieri|yesterday)$/i;

  const findPermalink = (article) => {
    const links = Array.from(article.querySelectorAll("a[href]")).sort((a,b) => Number(/(?:reply_)?comment_id=/.test(b.href)) - Number(/(?:reply_)?comment_id=/.test(a.href)));
    for (const a of links) {
      if (!ownsNode(article, a)) continue;
      const href = a.getAttribute("href") || "";
      if (href && PERMA.test(href)) {
        return {
          url: abs(href),
          label: clean(a.getAttribute("aria-label") || safeText(a)).slice(0, 80) || null,
        };
      }
    }
    return { url: null, label: null };
  };

  const findAuthor = (article) => {
    const links = Array.from(article.querySelectorAll("a[href]"));
    for (const a of links) {
      if (!ownsNode(article, a)) continue;
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      if (PERMA.test(href)) continue; // è il link all'ora del post, non all'autore
      const name = clean(safeText(a));
      if (!name || name.length > 80 || name.includes("\n")) continue;
      if (TIMEISH.test(name)) continue;
      if (isChromeLine(name)) continue;
      const profileish =
        /\/profile\.php\?id=/.test(href) ||
        /\/people\//.test(href) ||
        /\/groups\/[^/]+\/user\//.test(href) ||
        /^\/[A-Za-z0-9._-]+\/?(\?|$)/.test(href) ||
        /facebook\.com\/[A-Za-z0-9._-]+\/?(\?|$)/.test(href);
      if (!profileish) continue;
      return { name, url: abs(href) };
    }
    const label = clean(article.getAttribute("aria-label") || "");
    const m = label.match(/^(?:commento|risposta|comment|reply)\s+(?:di|by)\s+(.+?)(?:\s+\d+\s+(?:min|h|g|ore|giorni|hours?|days?)\b|$)/i);
    return { name: m && m[1].length <= 80 ? m[1] : null, url: null };
  };

  const REACT_LABEL = /(\d[\d.,\s]*)\s*(reazion|reaction|persone|people|mi piace|like)/i;

  const findReactions = (article) => {
    const nodes = Array.from(article.querySelectorAll("[aria-label]"));
    let best = null;
    for (const n of nodes) {
      if (!ownsNode(article, n)) continue;
      const label = n.getAttribute("aria-label") || "";
      const m = label.match(REACT_LABEL);
      if (!m) continue;
      const value = parseInt(m[1].replace(/[.,\s]/g, ""), 10);
      if (Number.isFinite(value) && (best === null || value > best)) best = value;
    }
    return best;
  };

  // Nome dell'autore e orario finiscono spesso sulla stessa riga del corpo,
  // perché sono elementi inline: toglierli riga per riga è più affidabile che
  // confrontare l'intera prima riga.
  const headTrim = (text, tokens) => {
    const wanted = tokens.filter(Boolean);
    if (!wanted.length) return text;
    const lines = text.split("\n");
    const upto = Math.min(lines.length, 4);
    for (let i = 0; i < upto; i++) {
      let line = lines[i];
      for (const token of wanted) {
        if (!token) continue;
        if (line.startsWith(token)) line = line.slice(token.length);
        else line = line.split(token).join(" ");
      }
      lines[i] = line.replace(/^[\s·•|\-–—,]+/, "").replace(/[\s·•|]+$/, "");
    }
    return lines.join("\n");
  };

  const bodyOf = (article) => {
    let text = safeText(article);
    // Togliamo il testo dei commenti annidati: innerText li restituisce come
    // sottostringhe contigue, quindi la sottrazione è affidabile.
    for (const child of Array.from(article.querySelectorAll('[role="article"], article'))) {
      const childText = safeText(child).trim();
      if (childText.length > 12 && text.includes(childText)) {
        text = text.replace(childText, "\n");
      }
    }
    return text;
  };

  const out = [];
  const commentIds = new Map(), postIds = new Map(), ultimiPost = new Map();
  const datiLink = (href) => {
    try { const u = new URL(href, location.href); return {
      commento: u.searchParams.get("comment_id"), risposta: u.searchParams.get("reply_comment_id"),
      post: u.pathname.match(/\/(?:posts|permalink)\/([^/]+)/)?.[1] || u.searchParams.get("story_fbid") || null,
    }; } catch { return {}; }
  };
  const azionePropria = (article, regex) => [...article.querySelectorAll('[role="button"], button')].some(n=>ownsNode(article,n) && regex.test(clean(n.getAttribute("aria-label") || safeText(n))));
  articles.forEach((article, i) => {
    try {
      const parentEl = ancestorArticle(article);
      const depth = (() => {
        let d = 0,
          p = parentEl;
        while (p) {
          d++;
          p = ancestorArticle(p);
        }
        return d;
      })();

      const author = findAuthor(article);
      const perma = findPermalink(article);
      // Nome e orario sono già campi a sé: nel corpo del testo sono rumore.
      const text = stripChrome(headTrim(bodyOf(article), [author.name, perma.label]));

      const link = datiLink(perma.url);
      const label = clean(article.getAttribute("aria-label") || "");
      const scope = article.closest('[role="dialog"], [role="feed"], main, [role="main"]') || document.body;
      const parent = parentEl ? out.find(v=>v.dom_index === indexOf.get(parentEl)) : null;
      const risposta = Boolean(link.risposta) || /^(risposta|reply)\b/i.test(label);
      const commento = risposta || Boolean(link.commento) || /^(commento|comment)(?:\s|$)/i.test(label) || azionePropria(article, /^(rispondi|reply)$/i);
      const post = !commento && (/^post(?:\s|$)/i.test(label) || Boolean(perma.url && PERMA.test(perma.url)) || azionePropria(article,/^(commenta|condividi|share)$/i));
      // Un articolo indipendente non è necessariamente un post: in Facebook i
      // commenti del dialogo sono spesso fratelli, non discendenti del post.
      const kind = post ? "post" : risposta || (parent && parent.kind !== "post") ? "reply" : "comment";
      let parentIndex = kind === "post" ? null : parent?.dom_index ?? null;
      if (kind === "reply" && link.commento && commentIds.has(link.commento)) parentIndex = commentIds.get(link.commento);
      if (parentIndex === null && kind !== "post") parentIndex = postIds.get(link.post) ?? ultimiPost.get(scope) ?? null;
      if (kind === "post") { ultimiPost.set(scope,i); if(link.post) postIds.set(link.post,i); }
      if (link.commento && !link.risposta) commentIds.set(link.commento,i);
      out.push({
        dom_index: i,
        depth,
        parent_index: parentIndex,
        kind,
        text,
        permalink: perma.url,
        posted_at_label: perma.label,
        author_name: author.name,
        author_url: author.url,
        reactions: findReactions(article),
      });
    } catch (e) {
      out.push({
        dom_index: i,
        depth: 0,
        parent_index: null,
        kind: "post",
        text: "",
        permalink: null,
        posted_at_label: null,
        author_name: null,
        author_url: null,
        reactions: null,
        error: String(e && e.message ? e.message : e),
      });
    }
  });

  return {
    url: location.href,
    title: document.title,
    n_articles: articles.length,
    items: out,
  };
}
);

globalThis.__piazzaEstraiInstagram = (
/*
 * Estrazione da Instagram, in un solo passaggio come per Facebook.
 *
 * Instagram non marca i commenti con role="article": la struttura e una lista,
 * con classi generate e illeggibili. L'ancoraggio scelto e <time datetime>,
 * che accompagna la didascalia e ogni commento ed e semantico, quindi molto
 * piu stabile delle classi.
 *
 * Da ogni <time> si risale al blocco che lo contiene insieme a un link di
 * profilo: quel blocco e un contenuto. I blocchi annidati dentro un altro
 * blocco sono risposte.
 *
 * Nulla qui aggira protezioni: si legge solo cio che il browser ha gia
 * disegnato nella sessione aperta a mano dall'utente.
 */
() => {
  const TRACKING = ["igshid", "igsh", "hl", "img_index", "utm_source", "utm_medium", "utm_campaign"];

  const clean = (s) =>
    (s || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const abs = (href) => {
    if (!href) return null;
    try {
      const base = /^https?:/.test(location.origin) ? location.origin : "https://www.instagram.com";
      const u = new URL(href, base);
      for (const k of Array.from(u.searchParams.keys())) {
        if (TRACKING.some((t) => k === t || k.startsWith(t))) u.searchParams.delete(k);
      }
      return u.href;
    } catch (e) {
      return href;
    }
  };

  // Righe di interfaccia da togliere dal corpo del testo (italiano e inglese).
  const CHROME = [
    /^(rispondi|reply|mi piace|like|piace a|segui|following|segui gia|follow)$/i,
    /^(visualizza traduzione|vedi traduzione|see translation|traduci|translate)$/i,
    /^(nascondi risposte|hide replies|altro|more|altro\.\.\.|verificato|verified)$/i,
    /^(modifica|edit|elimina|delete|segnala|report|condividi|share)$/i,
    /^\d[\d.,\s]*(mi piace|like|likes|risposte|replies|commenti|comments|visualizzazioni|views)$/i,
    /^(visualizza|mostra|view|see|load)\s.{0,28}(risposte|replies|commenti|comments)/i,
    /^\d+\s*(s|m|h|g|sett|min|d|w|y|settimane|giorni|ore|minuti)$/i,
    /^(adesso|ora|just now|ieri|yesterday)$/i,
    /^\d[\d.,]*$/,
  ];

  const isChromeLine = (riga) => {
    const t = riga.trim();
    if (!t || t.length > 60) return false;
    return CHROME.some((re) => re.test(t));
  };

  const stripChrome = (testo) =>
    clean(testo.split("\n").filter((r) => !isChromeLine(r)).join("\n"));

  const safeText = (el) => {
    try {
      return el.innerText || el.textContent || "";
    } catch (e) {
      return "";
    }
  };

  // Un link di profilo: /nomeutente/ e non una pagina di servizio.
  const SERVIZIO = /^\/(p|reel|reels|explore|stories|direct|accounts|about|developer|legal)\//i;
  const isProfilo = (href) => {
    if (!href) return false;
    try {
      const u = new URL(href, "https://www.instagram.com");
      if (!/instagram\.com$/.test(u.hostname.replace(/^www\./, ""))) return false;
      if (SERVIZIO.test(u.pathname)) return false;
      return /^\/[A-Za-z0-9._]{1,40}\/?$/.test(u.pathname);
    } catch (e) {
      return false;
    }
  };

  /**
   * Il contenitore da leggere.
   *
   * Prendere il primo <article> non basta: su una pagina di post Instagram
   * quell'elemento puo contenere solo il media, con i commenti in un pannello
   * fuori da li - e si finirebbe a leggere zero commenti. Si sceglie quindi il
   * contenitore che contiene davvero dei <time>, dal piu stretto al piu largo.
   */
  const quantiTempi = (el) => (el ? el.querySelectorAll("time[datetime]").length : 0);

  let radice = null;
  for (const a of document.querySelectorAll("article")) {
    if (quantiTempi(a) > quantiTempi(radice)) radice = a;
  }
  if (!quantiTempi(radice)) radice = document.querySelector('[role="main"], main');
  if (!quantiTempi(radice)) radice = document.body;

  /**
   * Il blocco che possiede un <time>: il piu vicino antenato che contiene anche
   * un link di profilo. Senza questo vincolo si risalirebbe fino all'intera
   * pagina, e ogni commento risulterebbe contenere tutti gli altri.
   */
  const bloccoDi = (tempo) => {
    let n = tempo.parentElement;
    let ripiego = null;
    while (n && n !== document.body) {
      const profili = Array.from(n.querySelectorAll("a[href]")).filter((a) =>
        isProfilo(a.getAttribute("href"))
      );
      if (profili.length) {
        // Il primo antenato con un profilo e il blocco; se ne contiene troppi
        // siamo risaliti oltre e teniamo il precedente.
        if (profili.length <= 3 || !ripiego) ripiego = n;
        if (profili.length > 3) break;
        return n;
      }
      n = n.parentElement;
    }
    return ripiego;
  };

  const tempi = Array.from(radice.querySelectorAll("time[datetime]"));
  const blocchi = [];
  const visti = new Set();

  for (const t of tempi) {
    const b = bloccoDi(t);
    if (!b || visti.has(b)) continue;
    visti.add(b);
    blocchi.push({ el: b, tempo: t });
  }

  // La didascalia puo non avere un <time> proprio: su molte pagine sta in un h1.
  const titolo = radice.querySelector("h1");
  if (titolo && clean(safeText(titolo)).length > 1) {
    const gia = blocchi.some((b) => b.el.contains(titolo) || titolo.contains(b.el));
    if (!gia) blocchi.unshift({ el: titolo, tempo: null, didascalia: true });
  }

  // Ordine di documento: conta per stabilire chi viene prima.
  blocchi.sort((a, b) => {
    const rel = a.el.compareDocumentPosition(b.el);
    if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  const indice = new Map(blocchi.map((b, i) => [b.el, i]));

  const antenatoBlocco = (el) => {
    let n = el.parentElement;
    while (n) {
      if (indice.has(n)) return n;
      n = n.parentElement;
    }
    return null;
  };

  const autoreDi = (blocco) => {
    for (const a of blocco.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!isProfilo(href)) continue;
      if (antenatoBlocco(a) !== antenatoBlocco(blocco) && indice.has(a.closest("*"))) continue;
      const nome = clean(safeText(a));
      if (!nome || nome.length > 60 || nome.includes("\n")) continue;
      return { name: nome, url: abs(href) };
    }
    return { name: null, url: null };
  };

  const corpoDi = (blocco, autore) => {
    let testo = safeText(blocco);
    // I blocchi annidati (le risposte) hanno una voce propria: qui sono rumore.
    for (const b of blocchi) {
      if (b.el === blocco || !blocco.contains(b.el)) continue;
      const figlio = safeText(b.el).trim();
      if (figlio.length > 12 && testo.includes(figlio)) testo = testo.replace(figlio, "\n");
    }
    const righe = testo.split("\n");
    // Nome autore e orario aprono quasi sempre il blocco: sono campi, non testo.
    for (let i = 0; i < Math.min(righe.length, 3); i++) {
      let r = righe[i];
      if (autore && autore.name) {
        if (r.startsWith(autore.name)) r = r.slice(autore.name.length);
        else r = r.split(autore.name).join(" ");
      }
      righe[i] = r.replace(/^[\s·•|\-–—,]+/, "");
    }
    return stripChrome(righe.join("\n"));
  };

  const permalinkDi = (blocco, tempo) => {
    const dentro = tempo && tempo.closest("a[href]");
    if (dentro) return abs(dentro.getAttribute("href"));
    for (const a of blocco.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      return abs(a.getAttribute("href"));
    }
    return null;
  };

  /**
   * L'orario come lo vede l'utente («2 g»), non l'attributo grezzo.
   * Se il testo visibile manca si ricade sul datetime, ridotto alla data.
   */
  const etichettaTempo = (tempo) => {
    if (!tempo) return null;
    const visibile = clean(safeText(tempo));
    if (visibile) return visibile;
    const grezzo = tempo.getAttribute("datetime");
    if (!grezzo) return null;
    const d = new Date(grezzo);
    return isNaN(d) ? grezzo : d.toLocaleDateString("it-IT");
  };

  const out = [];
  blocchi.forEach((b, i) => {
    try {
      const genitore = antenatoBlocco(b.el);
      const autore = autoreDi(b.el);
      const testo = corpoDi(b.el, autore);
      const parentIndex = genitore ? indice.get(genitore) : null;

      // Il primo blocco di primo livello e la didascalia, cioe il post.
      const primoDiPrimoLivello = parentIndex === null && !out.some((v) => v.kind === "post");
      const kind = b.didascalia || primoDiPrimoLivello ? "post" : parentIndex === null ? "comment" : "reply";

      out.push({
        dom_index: i,
        depth: parentIndex === null ? 0 : 1,
        parent_index: kind === "post" ? null : parentIndex !== null ? parentIndex : indice.size ? 0 : null,
        kind,
        text: testo,
        permalink: permalinkDi(b.el, b.tempo),
        posted_at_label: etichettaTempo(b.tempo),
        author_name: autore.name,
        author_url: autore.url,
        reactions: null,
      });
    } catch (e) {
      out.push({
        dom_index: i, depth: 0, parent_index: null, kind: "comment",
        text: "", permalink: null, posted_at_label: null,
        author_name: null, author_url: null, reactions: null,
        error: String((e && e.message) || e),
      });
    }
  });

  return {
    url: location.href,
    title: document.title,
    sito: "instagram",
    n_articles: out.length,
    items: out,
    // Se la raccolta torna vuota, questi numeri dicono dove si e fermata:
    // nessun <time> significa selettori da rivedere, <time> senza blocchi
    // significa che la risalita al blocco non trova link di profilo.
    struttura: {
      radice: radice === document.body ? "body" : radice.tagName.toLowerCase(),
      articoli: document.querySelectorAll("article").length,
      tempiNellaPagina: document.querySelectorAll("time[datetime]").length,
      tempiNellaRadice: quantiTempi(radice),
      blocchi: blocchi.length,
    },
  };
}
);

// Instagram e Facebook hanno strutture diverse e richiedono due estrattori.
// La scelta si fa qui, una volta sola, in base al sito che si sta leggendo.
globalThis.__piazzaSito = () => {
  const h = location.hostname.replace(/^www\./, "");
  if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
  return "facebook";
};

globalThis.__piazzaEstrai = () =>
  globalThis.__piazzaSito() === "instagram"
    ? globalThis.__piazzaEstraiInstagram()
    : globalThis.__piazzaEstraiFacebook();
