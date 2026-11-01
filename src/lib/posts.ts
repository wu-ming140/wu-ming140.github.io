import type { MarkdownInstance } from 'astro';
import { getPostColumn } from './columns';

export interface PostData {
  title: string;
  description?: string;
  pubDate: string;
  category?: string;
  draft?: boolean;
  sample?: boolean;
}

const modules = import.meta.glob<MarkdownInstance<PostData>>('../pages/posts/*.md', {
  eager: true,
});

export const posts = Object.values(modules)
  .filter((post) => !post.frontmatter.draft)
  .map((post) => ({ ...post, column: getPostColumn(post.frontmatter.category) }))
  .sort((a, b) => String(b.frontmatter.pubDate).localeCompare(String(a.frontmatter.pubDate)));

export type Post = (typeof posts)[number];

export function dateParts(value: string | Date) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return { full: text, year: text.slice(0, 4), day: text.slice(5).replace('-', '.') };
}
