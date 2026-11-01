import { validDate } from './guestbook-rules.mjs';

export function xmlText(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
export function buildFeed(entries, { title, description, site, path, now = new Date() }) {
  const base = new URL(site);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('订阅源需要有效的网站地址。');
  const items = [...entries].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 50).map((entry) => {
    if (!validDate(entry.date)) throw new Error(`订阅内容日期无效：${entry.title}`);
    const url = new URL(entry.url, base).href;
    return `<item><title>${xmlText(entry.title)}</title><link>${xmlText(url)}</link><guid isPermaLink="true">${xmlText(url)}</guid><pubDate>${new Date(`${entry.date}T00:00:00Z`).toUTCString()}</pubDate><description>${xmlText(entry.excerpt || entry.description)}</description>${[entry.label, ...(entry.tags || [])].filter(Boolean).map((tag) => `<category>${xmlText(tag)}</category>`).join('')}</item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlText(title)}</title><link>${xmlText(base.href)}</link><description>${xmlText(description)}</description><language>zh-cn</language><lastBuildDate>${now.toUTCString()}</lastBuildDate><atom:link href="${xmlText(new URL(path, base).href)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
