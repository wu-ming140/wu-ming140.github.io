import type { APIRoute } from 'astro';
import { posts } from '../lib/posts';
import { getGuestbook } from '../lib/guestbook';
import { createSearchIndex } from '../lib/search-index.mjs';
import { site, about, localPath } from '../site';

export const GET: APIRoute = async () => {
  const messages = (await getGuestbook()).map((message) => ({ ...message, url: localPath(`guestbook/${message.id}/`) }));
  const index = createSearchIndex(posts, messages);
  index.push({ title: `关于${site.shortName}`, url: localPath('about/'), description: site.description, type: '页面', category: '关于', date: '', tags: [], body: `${site.name} 欢迎来到这个小站。 ${about.intro} ${about.sections.map((section) => `${section.title} ${section.text}`).join(' ')} ${about.thanks}` });
  // URL 按浏览器规则编码，带空格或中文的原文章地址仍可访问。
  for (const entry of index) entry.url = new URL(entry.url!, 'https://index.invalid').pathname;
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
