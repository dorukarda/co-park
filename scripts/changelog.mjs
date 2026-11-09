// CHANGELOG.md → HTML (bağımlılıksız, yalnızca bu dosyanın kullandığı Markdown alt kümesi).
import { readFileSync } from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

export function renderChangelog(md) {
  const out = [];
  let list = false, section = null, sectionHasContent = false;
  const closeList = () => { if (list) { out.push('</ul>'); list = false; } };
  const lines = md.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^## \[([^\]]+)\](?: - (\S+))?/))) {
      closeList();
      if (section !== null && !sectionHasContent) out[section] = out[section].replace('<h2', '<h2 class="empty"');
      const date = m[2] ? `<span class="date">${m[2]}</span>` : '';
      const label = /^\d/.test(m[1]) ? `<span class="ver">v${m[1]}</span>` : `<span>${esc(m[1])}</span>`;
      out.push(`<h2 id="v${esc(m[1])}">${label}${date}</h2>`);
      section = out.length - 1; sectionHasContent = false;
    } else if ((m = line.match(/^### (.+)/))) {
      closeList(); sectionHasContent = true;
      out.push(`<h3 class="${m[1].toLowerCase('tr')}">${esc(m[1])}</h3>`);
    } else if ((m = line.match(/^# (.+)/))) {
      closeList(); out.push(`<h1>${inline(m[1])}</h1>`);
    } else if ((m = line.match(/^- (.+)/))) {
      if (!list) { out.push('<ul>'); list = true; }
      sectionHasContent = true;
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (line === '') {
      closeList();
    } else {
      closeList(); out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  if (section !== null && !sectionHasContent) out[section] = out[section].replace('<h2', '<h2 class="empty"');
  return out.join('\n');
}

export const loadChangelog = (path) => renderChangelog(readFileSync(path, 'utf8'));
