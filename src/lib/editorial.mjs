import { tagSlug } from './post-meta.mjs';

export const boardLabels = {
  hall: '大厅', life: '生活随笔 / 心得分享', learning: '学习记录 / 学习心得', portfolio: '作品集', interests: '爱好', 'site-log': '小站日志',
  guestbook: '留言与问答 · 全部', messages: '留言', questions: '提问', unanswered: '待回答', elsewhere: '其他渠道来信',
};

export function availableBoards(type, column = '', channel = 'other') {
  if (type === 'article') return ['hall', column].filter((key) => Object.hasOwn(boardLabels, key));
  if (type === 'reply') return [];
  return ['guestbook', type === 'question' ? 'questions' : 'messages', ...(type === 'question' ? ['unanswered'] : []), ...(channel === 'other' ? ['elsewhere'] : [])];
}

export function normalizePlacements(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('置顶与精选的板块设置格式不正确。');
  const result = {};
  for (const [board, flags] of Object.entries(value)) {
    if (!Object.hasOwn(boardLabels, board) || !flags || typeof flags !== 'object' || Array.isArray(flags)
      || Object.entries(flags).some(([key, enabled]) => !['pinned', 'featured'].includes(key) || typeof enabled !== 'boolean')) throw new Error('置顶与精选请使用对应板块的勾选设置。');
    if (flags.pinned || flags.featured) result[board] = { pinned: Boolean(flags.pinned), featured: Boolean(flags.featured) };
  }
  return result;
}

export function normalizeCollections(value = []) {
  if (!Array.isArray(value) || value.length > 12) throw new Error('每份内容最多加入 12 个合集。');
  const result = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || typeof item.name !== 'string') throw new Error('请填写合集名称。');
    const name = item.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (name.length > 60) throw new Error('合集名称最多 60 个字。');
    const order = Number(item.order || 1);
    if (!Number.isSafeInteger(order) || order < 1 || order > 99999) throw new Error('合集排序号请填写 1–99999 的整数。');
    const key = collectionSlug(name);
    if (seen.has(key)) throw new Error('同一份内容不能重复加入同一个合集。');
    seen.add(key);
    result.push({ name, order });
  }
  return result;
}

export function collectionSlug(name) { return tagSlug(name); }
export function contentDate(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
export function chronological(entries) { return [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); }
export function boardEntries(entries, board) {
  return entries.filter((entry) => {
    if (board === 'hall') return entry.type === 'article';
    if (board === 'guestbook') return entry.type !== 'article';
    if (board === 'messages') return entry.type === 'message';
    if (board === 'questions') return entry.type === 'question';
    if (board === 'unanswered') return entry.type === 'question' && !entry.answered;
    if (board === 'elsewhere') return entry.type !== 'article' && entry.channel === 'other';
    return entry.type === 'article' && entry.column === board;
  });
}
export function curatedEntries(entries, board, flag) {
  return chronological(boardEntries(entries, board).filter((entry) => entry.placements?.[board]?.[flag])).reverse();
}
export function collectionGroups(entries) {
  const groups = new Map();
  for (const entry of entries) for (const membership of entry.collections || []) {
    const slug = collectionSlug(membership.name);
    const group = groups.get(slug) || { slug, name: membership.name, items: [] };
    group.items.push({ ...entry, order: membership.order });
    groups.set(slug, group);
  }
  return [...groups.values()].map((group) => ({ ...group, items: group.items.sort((a, b) => a.order - b.order || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
export function neighbors(entries, current) {
  const ordered = chronological(entries);
  const index = ordered.findIndex((entry) => entry.id === current.id);
  return index < 0 ? {} : { previous: ordered[index - 1], next: ordered[index + 1] };
}
export function relatedEntries(current, entries, limit = 3) {
  const tags = new Set((current.tags || []).map((tag) => tag.toLowerCase()));
  const groups = new Set((current.collections || []).map((item) => collectionSlug(item.name)));
  return entries.filter((entry) => entry.id !== current.id).map((entry) => ({ entry, score:
    (entry.collections || []).filter((item) => groups.has(collectionSlug(item.name))).length * 8
    + (entry.tags || []).filter((tag) => tags.has(tag.toLowerCase())).length * 3
    + (current.type === 'article' ? Number(entry.type === 'article' && entry.column === current.column) : Number(entry.type === current.type)),
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date) || a.entry.id.localeCompare(b.entry.id)).slice(0, limit).map((item) => item.entry);
}
