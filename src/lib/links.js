// All user-supplied links pass through the same protocol check before rendering.
export function linkHref(value) {
  if (typeof value !== 'string') return '';
  let text = value.trim();
  if (!text || /[\s\u0000-\u001f\u007f]/.test(text)) return '';
  if (/^(?:www\.|[\p{L}\d-]+(?:\.[\p{L}\d-]+)+(?::\d+)?(?:[/?#]|$))/u.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    return ['https:', 'http:'].includes(url.protocol) && url.hostname ? url.href : '';
  } catch { return ''; }
}

export function linkParts(value) {
  const text = String(value ?? '');
  const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s<>"']+)\)|https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
  const parts = []; let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    let target = match[2] || match[0], suffix = '';
    if (!match[2]) {
      while (/[.,!?;:]$/.test(target) || target.endsWith(')') && (target.match(/\)/g)?.length || 0) > (target.match(/\(/g)?.length || 0)) {
        suffix = target.at(-1) + suffix; target = target.slice(0, -1);
      }
    }
    const href = linkHref(target);
    parts.push(href ? { text: match[1] || target, href } : { text: match[0] });
    if (suffix) parts.push({ text: suffix });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function recordLinks(record) {
  if (!record) return [];
  const entries = [...(record.details || []).filter(item => item.showOnCard !== false).map(item => ({ label: item.label, value: item.value })),
    ...(record.showContactOnCard !== false ? [{ label: 'Контакт', value: record.contact }] : [])];
  const links = entries.flatMap(entry => {
    const whole = linkHref(entry.value);
    return whole ? [{ label: entry.label, href: whole }] : linkParts(entry.value).filter(part => part.href).map(part => ({ label: part.text === part.href || /^https?:\/\//.test(part.text) ? entry.label : part.text, href: part.href }));
  });
  return links.filter((link, index) => links.findIndex(item => item.href === link.href) === index);
}
