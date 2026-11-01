import { getCatalog } from './catalog';
import { buildFeed } from './rss.mjs';
import { site, localPath } from '../site';
export async function feedResponse(origin: URL | undefined, scope: 'all' | 'posts' | 'guestbook') {
  const entries = (await getCatalog()).filter((entry) => scope === 'all' || (scope === 'posts' ? entry.type === 'article' : entry.type !== 'article'));
  const name = scope === 'all' ? '全站动态' : scope === 'posts' ? '文章与作品' : '留言与问答';
  const path = localPath(scope === 'all' ? 'rss.xml' : `${scope}/rss.xml`);
  const xml = buildFeed(entries, { title: `${site.name} · ${name}`, description: `${site.description} ${name}的最新公开内容。`, site: origin!.href, path });
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
