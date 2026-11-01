import { posts } from './posts';
import { getGuestbook } from './guestbook';
import { localPath } from '../site';
import { normalizePlacements, normalizeCollections, contentDate } from './editorial.mjs';
import { markdownText } from './search-index.mjs';

export async function getCatalog() {
  const articles = posts.map((post) => ({
    id: post.url!, url: post.url!, path: `src/pages/posts/${post.file.split(/[\\/]/).pop()!}`, title: post.frontmatter.title, description: post.frontmatter.description || '',
    date: contentDate(post.frontmatter.pubDate), type: 'article', label: post.column.title, column: post.column.slug,
    tags: post.tags, cover: post.cover, channel: '', answered: false,
    placements: normalizePlacements(post.frontmatter.placements), collections: normalizeCollections(post.frontmatter.collections),
    excerpt: markdownText(post.rawContent()).slice(0, 280),
  }));
  const messages = (await getGuestbook()).map((message) => ({
    id: localPath(`guestbook/${message.id}/`), url: localPath(`guestbook/${message.id}/`), path: `src/content/guestbook/${message.id}.md`, title: message.data.title,
    description: `${message.data.author}的${message.data.kind === 'question' ? '提问' : '留言'}${message.replies.length ? ` · ${message.replies.length} 条回复` : ''}`,
    date: message.data.date, type: message.data.kind, label: message.data.kind === 'question' ? '提问' : '留言', column: '', tags: [], cover: '',
    channel: message.data.channel, answered: message.replies.length > 0,
    placements: normalizePlacements(message.data.placements), collections: normalizeCollections(message.data.collections),
    excerpt: markdownText([message.body, ...message.replies.map((reply) => reply.body)].join('\n\n')).slice(0, 280),
  }));
  return [...articles, ...messages];
}
export type CatalogEntry = Awaited<ReturnType<typeof getCatalog>>[number];
