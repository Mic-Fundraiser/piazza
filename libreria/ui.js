const paths = {
  archive: 'M3 4h18v5H3z M5 9v11h14V9 M10 13h4',
  chart: 'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  external: 'M14 3h7v7 M21 3L10 14 M10 3H4v17h17v-6',
  chat: 'M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0 M7 10h10 M7 14h6',
  file: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  shield: 'M12 2l8 3v7c0 5-8 10-8 10S4 17 4 12V5z M8 12l3 3 5-6',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5 M12 17h.01',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name] || paths.file); svg.append(path);
  return svg;
}
export function decorateIcons() { document.querySelectorAll('[data-icon]').forEach(n => n.replaceChildren(icon(n.dataset.icon))); }
export function safeURL(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
let timer;
export function toast(message) { let n = document.getElementById('toast'); if (!n) { n = document.createElement('div'); n.id='toast'; n.className='toast'; n.setAttribute('role','status'); document.body.append(n); } n.textContent=message; n.hidden=false; clearTimeout(timer); timer=setTimeout(()=>n.hidden=true,4000); }
