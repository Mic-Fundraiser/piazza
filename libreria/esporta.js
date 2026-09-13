/*
 * Export di una raccolta: JSON, CSV e Markdown.
 * Trasposizione di piazza/exports.py.
 */
import { analizza } from "./analisi.js";
import { ordinaAdAlbero } from "./albero.js";

const CAMPI = ["position", "kind", "parent_position", "author", "posted_at_label", "reactions", "permalink", "text"];

const riga = (v) => ({
  position: v.position,
  kind: v.kind,
  parent_position: v.parent_position === null || v.parent_position === undefined ? "" : v.parent_position,
  author: "",
  posted_at_label: v.posted_at_label || "",
  reactions: v.reactions === null || v.reactions === undefined ? "" : v.reactions,
  permalink: v.permalink || "",
  text: v.text,
});

export function inJSON(raccolta, voci) {
  return JSON.stringify(
    {
      raccolta: {
        id: raccolta.id,
        url: raccolta.url,
        titolo: raccolta.titolo,
        quando: new Date(raccolta.quando).toISOString(),
        nPost: raccolta.nPost,
        nCommenti: raccolta.nCommenti,
      },
      voci: voci.map(riga),
    },
    null,
    2
  );
}

export function inCSV(raccolta, voci) {
  // Neutralizza formule quando il CSV viene aperto in un foglio di calcolo.
  const cita = (v) => { let s=String(v); if (/^[\s]*[=+@-]/.test(s) || /^[\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g, '""')+'"'; };
  const righe = [CAMPI.map(cita).join(",")];
  for (const v of voci) righe.push(CAMPI.map((c) => cita(riga(v)[c])).join(","));
  return righe.join("\n") + "\n";
}

export function inMarkdown(raccolta, voci) {
  const a = analizza(voci);
  const post = new Map(voci.filter((v) => v.kind === "post").map((v) => [v.position, v]));
  const out = [];

  out.push(`# Raccolta #${raccolta.id} - ${raccolta.titolo || raccolta.url}`, "");
  out.push(`- Origine: ${raccolta.url}`);
  out.push(`- Raccolta il: ${new Date(raccolta.quando).toLocaleString("it-IT")}`);
  out.push(`- Post: ${a.nPost} - commenti e risposte: ${a.nCommenti}`, "");
  out.push("> Autori omessi. Materiale da usare in forma aggregata.", "");

  if (a.termini.length) {
    out.push("## Termini piu ricorrenti", a.termini.map(([w, n]) => `${w} (${n})`).join(", "), "");
  }
  if (a.bigrammi.length) {
    out.push("## Espressioni ricorrenti", a.bigrammi.map(([w, n]) => `«${w}» (${n})`).join(", "), "");
  }
  if (a.piuDiscussi.length) {
    out.push("## Post con piu discussione");
    for (const p of a.piuDiscussi) out.push(`- **${p.commenti} commenti** - ${p.estratto}`);
    out.push("");
  }
  if (a.domande.length) {
    out.push("## Domande poste nei commenti");
    for (const d of a.domande) out.push(`- ${d}`);
    out.push("");
  }

  out.push("## Testi");
  for (const v of ordinaAdAlbero(voci)) {
    if (v.kind === "post") {
      out.push("", `### Post #${v.position}`);
      if (v.permalink) out.push(`<${v.permalink}>`);
      out.push("", v.text);
    } else {
      const padre = post.get(v.parent_position);
      const etichetta = v.kind === "reply" ? "Risposta" : "Commento";
      let testa = `**${etichetta}**`;
      if (padre) testa += ` (sotto il post #${padre.position})`;
      out.push("", testa, "");
      for (const l of v.text.split("\n")) out.push(`> ${l}`);
    }
  }
  return out.join("\n") + "\n";
}

export function scarica(nomeFile, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
