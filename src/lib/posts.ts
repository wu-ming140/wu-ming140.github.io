import type { MarkdownInstance } from 'astro';
import { getPostColumn } from './columns';
import { normalizeTags, normalizeCover } from './post-meta.mjs';
import { comparePublicationDates } from './publication-date.mjs';
export { dateParts } from './publication-date.mjs';

export interface PostData {
  title: string;
  description?: string;
  pubDate: string | Date;
  category?: string;
  draft?: boolean;
  sample?: boolean;
  tags?: string[] | string;
  cover?: string;
  coverAlt?: string;
  placements?: Record<string, { pinned?: boolean; featured?: boolean }>;
  collections?: { name: string; order?: number }[];
}

const modules = import.meta.glob<MarkdownInstance<PostData>>('../pages/posts/*.md', {
  eager: true,
});

export const posts = Object.values(modules)
  .filter((post) => !post.frontmatter.draft)
  .map((post) => ({ ...post, column: getPostColumn(post.frontmatter.category), tags: normalizeTags(post.frontmatter.tags), cover: normalizeCover(post.frontmatter.cover) }))
  .sort((a, b) => comparePublicationDates(b.frontmatter.pubDate, a.frontmatter.pubDate) || (a.url || a.file).localeCompare(b.url || b.file));

export type Post = (typeof posts)[number];
