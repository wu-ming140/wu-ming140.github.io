import type { MarkdownInstance } from 'astro';

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
  .sort((a, b) => String(b.frontmatter.pubDate).localeCompare(String(a.frontmatter.pubDate)));

export function dateParts(value: string | Date) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return { full: text, year: text.slice(0, 4), day: text.slice(5).replace('-', '.') };
}
