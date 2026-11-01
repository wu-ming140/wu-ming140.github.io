import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { safeMarkdownUrl } from './guestbook-rules.mjs';
import { collectionSlug } from './editorial.mjs';
import { resolveColumn } from './column-data.mjs';

const parser = unified().use(remarkParse);
export function inspectPublication(document, { assets = [], entries, catalog = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const findings = [];
  const add = (level, message) => findings.push({ level, message });
  const metadata = document.metadata;
  const article = document.path.startsWith('src/pages/posts/');
  if (article && !metadata.description) add('warning', '还没有填写一句话简介，列表中会少一段介绍。');
  if (article && resolveColumn(metadata.category).slug === 'portfolio' && !metadata.cover) add('warning', '作品还没有设置封面，卡片会使用文字封面。');
  if (metadata.cover && !metadata.coverAlt) add('warning', '封面还没有填写图片说明。');
  if ((metadata.pubDate || metadata.date) > today) add('warning', '发布日期在未来，确认这就是你想使用的日期。');
  if (metadata.draft) add('info', '这份内容设为草稿，不会进入公开列表、搜索、合集或 RSS。');
  const references = new Map();
  const definitions = new Map();
  const tree = parser.parse(document.body);
  function collect(node) {
    if (node.type === 'definition') definitions.set(node.identifier, node.url);
    for (const child of node.children || []) collect(child);
  }
  collect(tree);
  function visit(node) {
    const url = node.url || (['imageReference', 'linkReference'].includes(node.type) ? definitions.get(node.identifier) : null);
    if (['imageReference', 'linkReference'].includes(node.type) && !url) add('error', `正文里有未定义的引用链接：${node.identifier}。`);
    if (url) {
      if (!safeMarkdownUrl(url)) add('error', '正文中有格式不安全的链接，请使用完整网址或 /、# 开头的站内地址。');
      references.set(url, node.type.startsWith('image') ? '媒体' : '链接');
      if (node.type.startsWith('image') && !node.alt?.trim()) add('warning', '有图片或视频没有填写说明，可以在 ![这里] 补上。');
    }
    for (const child of node.children || []) visit(child);
  }
  visit(tree);
  if (metadata.cover) references.set(metadata.cover, '封面');
  for (const [url, label] of references) {
    if (!url.startsWith('/media/')) continue;
    let path;
    try { path = `public${decodeURIComponent(url.split(/[?#]/)[0])}`; }
    catch { add('error', `${label}路径编码无效：${url}`); continue; }
    if (assets.some((asset) => asset.path === path && !asset.published)) continue;
    if (entries && !entries.has(path)) add('error', `仓库里找不到${label}文件：${url}`);
  }
  if (!entries && [...references.keys()].some((url) => url.startsWith('/media/') && !assets.some((asset) => asset.url === url))) add('info', '尚未连接仓库，已有站内媒体是否存在将在连接后核对。');
  const unused = assets.filter((asset) => !document.source.includes(asset.url));
  if (unused.length) add('info', `${unused.length} 个附件没有用于正文或封面，本次不会上传。`);
  for (const membership of metadata.collections || []) {
    const conflict = catalog.find((entry) => entry.path !== document.path && entry.collections?.some((item) => collectionSlug(item.name) === collectionSlug(membership.name) && item.order === membership.order));
    if (conflict) add('warning', `合集「${membership.name}」已有顺序号 ${membership.order}，同号内容会再按日期排序。`);
  }
  if (!findings.length) add('success', '检查通过，标题、正文及所用媒体未发现需要处理的问题。');
  return findings;
}
