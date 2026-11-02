import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { dateParts } from './publication-date.mjs';

const parser = unified().use(remarkParse);
export function markdownText(markdown = '') {
  const tree = parser.parse(markdown);
  function text(node) {
    if (node.type === 'html' || node.type === 'definition') return '';
    if (node.type === 'image') return node.alt || '';
    if (typeof node.value === 'string') return node.value;
    return (node.children || []).map(text).join(['paragraph', 'heading', 'emphasis', 'strong', 'link'].includes(node.type) ? '' : ' ');
  }
  return text(tree).replace(/\s+/g, ' ').trim();
}

export function createSearchIndex(posts, messages = []) {
  const entries = posts.filter((post) => !post.frontmatter.draft).map((post) => ({
    title: post.frontmatter.title, url: post.url, description: post.frontmatter.description || '',
    type: post.column.slug === 'portfolio' ? '作品' : '文章', category: post.column.title,
    date: dateParts(post.frontmatter.pubDate).full, tags: post.tags,
    body: markdownText(post.rawContent()),
  }));
  for (const message of messages.filter((item) => !item.data.draft)) {
    entries.push({
      title: message.data.title, url: message.url, description: `${message.data.author}的${message.data.kind === 'question' ? '提问' : '留言'}`,
      type: '留言与问答', category: message.data.source || '留言', date: message.data.date, tags: [],
      body: markdownText([message.body, ...message.replies.filter((reply) => !reply.data.draft).map((reply) => reply.body)].join('\n\n')),
    });
  }
  return entries;
}
