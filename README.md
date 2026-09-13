# Piazza

Estensione per Chrome che raccoglie **post e commenti** dalla pagina Facebook o
Instagram che stai guardando, li archivia **dentro il browser** e te li
restituisce in forma leggibile e aggregata: di che cosa si parla, quali domande
tornano nei commenti, quali post hanno acceso la discussione.

Nasce per il lavoro di campagna: capire che cosa scrive la gente sotto i post di
un'organizzazione senza doverli leggere a uno a uno.

<!-- Sostituisci con una schermata dell'archivio quando ne hai una -->

## Installazione

Non è sul Chrome Web Store: si carica a mano.

1. scarica o clona questa cartella;
2. apri `chrome://extensions`;
3. accendi **Modalità sviluppatore**, in alto a destra;
4. premi **Carica estensione non pacchettizzata** e scegli la cartella.

Fatto. Apri un post di Facebook o Instagram, premi l'icona di Piazza e scegli
**Raccogli questa pagina**.

## Come si usa

Tre modalità, nel pannello dell'estensione:

| | |
|---|---|
| **Visibile** | salva solo ciò che è già caricato, senza scorrere |
| **Rapida** | apre commenti e scorre, fino a un minuto |
| **Approfondita** | come sopra, fino a tre minuti |

Durante la raccolta compare un riquadro in basso a destra **sulla pagina**, che
dice a che punto è e quanti elementi ha trovato, con **Pausa** e **Interrompi e
salva**. Puoi chiudere il pannello, cambiare scheda o ridurre la finestra: il
lavoro continua nella scheda.

Nell'archivio trovi i testi con la conversazione annidata, l'analisi aggregata,
la ricerca in tutte le raccolte, l'analisi di più raccolte insieme, le etichette
e l'export in Markdown, JSON e CSV.

### Come fa a vedere *tutti* i commenti

Facebook ordina i commenti per «Più rilevanti», e in quella modalità ne
*nasconde* una parte: per quanto si scorra, non compariranno. Piazza passa
prima a **«Tutti i commenti»** — è il passaggio che sblocca il resto. Poi apre a
ripetizione «altri commenti», le risposte annidate e i testi lunghi troncati da
«Altro», finché la pagina smette di crescere. Nei Reel, dove il pannello dei
commenti è chiuso, lo apre da sola.

Non è garantito che prenda tutto: l'archivio non certifica la completezza di una
conversazione, e ogni raccolta dice se si è fermata perché la pagina era
esaurita o perché è scaduto il tempo.

## Che cosa non fa

Sono limiti scelti, non funzioni mancanti:

- **non fa il login al posto tuo** — usa la sessione che hai già aperto tu nel
  tuo browser, non chiede né vede le tue credenziali;
- **non risolve CAPTCHA né checkpoint** — li riconosce e si ferma, dicendo che
  cosa fare;
- **non usa stealth plugin, fingerprint spoofing, rotazione di proxy o account**;
- **non esplora** — legge la singola pagina che hai aperto, non segue link, non
  entra nei profili, non ricostruisce reti di persone;
- **non chiede permessi permanenti su Facebook o Instagram** — agisce solo nella
  scheda in cui premi il pulsante (`activeTab`);
- **non manda niente a nessun server.**

Se una di queste cose ti serve, questo non è lo strumento giusto.

## Privacy

**I commenti vengono archiviati senza autore**: niente nomi, niente URL di
profilo, niente pseudonimi. L'opzione sui nomi, nelle impostazioni, vale solo
per i post.

I dati restano in `chrome.storage.local`, in questo profilo del browser.
**Disinstallare l'estensione cancella l'archivio**: nelle impostazioni c'è
«Esporta tutto l'archivio», e il file si può rimettere dentro quando vuoi.

I commenti sono dati personali anche quando sono pubblici. Il senso di questo
strumento è leggere l'insieme — i temi, le domande ricorrenti — non schedare le
persone: non trasformare commenti politici in liste di contatti.

## Termini di Meta

I Termini di Facebook e Instagram vietano la raccolta automatizzata di dati
senza autorizzazione scritta. È una questione contrattuale fra te e Meta, non un
illecito penale, ma il rischio concreto — limitazione o blocco dell'account con
cui accedi — è reale e ricade su di te. Valutalo prima, soprattutto se
quell'account amministra pagine che ti servono.

## Struttura

```
manifest.json        Manifest V3
popup.html/.js       il pannello: modalità e avvio
raccogli.js          apre commenti, risposte e testi lunghi; il riquadro sulla pagina
estrattore.js        legge il DOM (generato: Facebook e Instagram hanno due strategie)
sfondo.js            service worker: archivia, tiene la traccia diagnostica
archivio.html/.js    archivio, analisi, ricerca, impostazioni
libreria/            deposito, privacy, albero, analisi, export, lingua
vendor/              Vanilla Framework (LGPL v3, vedi LEGGIMI.md)
```

Il pezzo fragile è `estrattore.js`: i selettori di Facebook e Instagram cambiano
senza preavviso. È scritto perché un campo che smette di funzionare faccia
perdere quel campo e non l'intera raccolta. Se qualcosa non torna, la voce
**Attività** nell'archivio conserva la traccia di ogni passo dell'ultima
raccolta: dice dove si è fermata.

## Licenza

MIT — vedi [LICENSE](LICENSE).

Il foglio di stile in `vendor/` è il
[Vanilla Framework](https://vanillaframework.io) di Canonical, sotto licenza
LGPL v3, incluso senza modifiche: vedi [vendor/LEGGIMI.md](vendor/LEGGIMI.md).

Piazza non è affiliato né sostenuto da Meta Platforms. «Facebook» e «Instagram»
sono marchi dei rispettivi titolari, citati solo per indicare i siti da cui lo
strumento legge.
