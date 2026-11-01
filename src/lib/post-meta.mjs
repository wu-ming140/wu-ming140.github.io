import { mediaType, safeMediaUrl } from './media.mjs';

export function normalizeTags(value) {
  if (value == null || value === '') return [];
  const input = typeof value === 'string' ? value.split(/[,，、\n]/) : value;
  if (!Array.isArray(input) || input.some((tag) => typeof tag !== 'string')) throw new Error('标签请填写文字，多个标签用逗号分隔。');
  const tags = [];
  const seen = new Set();
  for (const item of input) {
    const tag = item.normalize('NFKC').trim().replace(/^#\s*/, '').replace(/\s+/g, ' ');
    if (!tag) continue;
    if (tag.length > 32) throw new Error('每个标签最多 32 个字。');
    const key = tag.toLowerCase();
    if (!seen.has(key)) { tags.push(tag); seen.add(key); }
  }
  if (tags.length > 12) throw new Error('每份内容最多填写 12 个标签。');
  return tags;
}

export function tagSlug(tag) {
  const key = tag.normalize('NFKC').trim().toLowerCase();
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(key)) hash = Math.imul(hash ^ byte, 16777619);
  const label = Array.from(key.replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '')).slice(0, 36).join('') || 'tag';
  return `${label}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function normalizeCover(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw new Error('封面请填写图片路径或网址。');
  const cover = value.trim();
  if (cover && (!safeMediaUrl(cover) || mediaType(cover) !== 'image')) throw new Error('封面请使用 /media/ 开头的图片路径，或完整的 HTTP / HTTPS 图片网址。');
  return cover;
}

export function collectTags(posts) {
  const entries = new Map();
  for (const post of posts) for (const tag of post.tags) {
    const slug = tagSlug(tag);
    const entry = entries.get(slug) || { tag, slug, count: 0 };
    entry.count++;
    entries.set(slug, entry);
  }
  return [...entries.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));
}
