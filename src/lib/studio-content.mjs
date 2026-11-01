import { load, dump, JSON_SCHEMA } from 'js-yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkGuestbook, { validDate, safeMarkdownUrl } from './guestbook-rules.mjs';
import remarkMedia from './media.mjs';

export function contentKind(path) {
  if (/^src\/pages\/posts\/[^/\\]+\.md$/.test(path) && !path.endsWith('/index.md')) return 'article';
  if (/^src\/content\/guestbook\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path)) return 'message';
  if (/^src\/content\/replies\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path)) return 'reply';
  return null;
}

export function parseDocument(source) {
  const normalized = source.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error('这份文件缺少开头的标题和日期信息。');
  const metadata = load(match[1], { schema: JSON_SCHEMA });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('文件开头的内容格式不正确。');
  return { metadata, body: normalized.slice(match[0].length).replace(/^\n/, '') };
}

export function buildDocument(fields, originalMetadata = {}) {
  const type = fields.type;
  if (!['article', 'message', 'question', 'reply'].includes(type)) throw new Error('请选择发布内容的类型。');
  const name = fields.name.trim();
  if (!fields.editPath && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('文件名请使用小写英文字母、数字和连字符，例如 my-first-project。');
  if (!validDate(fields.date)) throw new Error('请填写有效的发布日期。');
  const body = fields.body.trim();
  if (!body) throw new Error('先写一点正文，再保存或发布。');
  const metadata = { ...originalMetadata };
  if (type !== 'reply') {
    const title = fields.title.trim();
    if (!title || title.length > 80) throw new Error('请填写 1–80 个字的标题。');
    metadata.title = title;
  }
  let directory;
  if (type === 'article') {
    directory = 'src/pages/posts';
    metadata.layout = '../../layouts/PostLayout.astro';
    metadata.description = fields.description.trim();
    metadata.pubDate = fields.date;
    metadata.category = fields.category;
  } else if (type === 'reply') {
    directory = 'src/content/replies';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.message.trim())) throw new Error('请填写要回复的留言文件名，不含 .md。');
    metadata.message = fields.message.trim();
    metadata.date = fields.date;
  } else {
    directory = 'src/content/guestbook';
    if (['index', 'contribute', 'elsewhere'].includes(name)) throw new Error('这个文件名已被留言页面使用，请换一个。');
    const author = fields.author.trim();
    if (!author || author.length > 40) throw new Error('请填写 1–40 个字的昵称。');
    const source = fields.source.trim();
    if (source.length > 40) throw new Error('来源最多填写 40 个字。');
    metadata.author = author;
    metadata.date = fields.date;
    metadata.kind = type;
    metadata.channel = originalMetadata.channel || 'other';
    if (source) metadata.source = source;
    else delete metadata.source;
  }
  if (type !== 'article' && typeof fields.draft === 'boolean') metadata.draft = fields.draft;
  const path = fields.editPath || `${directory}/${name}.md`;
  if (contentKind(path) !== (type === 'question' ? 'message' : type)) throw new Error('内容类型与文件位置不一致，请重新选择。');
  const yaml = dump(metadata, { schema: JSON_SCHEMA, lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: true });
  return { path, metadata, body, source: `---\n${yaml}---\n\n${body}\n` };
}

// 与网站使用同样的留言检查和媒体转换；预览不执行手写 HTML。
export async function renderMarkdown(body, type = 'article') {
  const path = type === 'article' ? '/src/pages/posts/preview.md' : '/src/content/guestbook/preview.md';
  function previewLinks() {
    return (tree, file) => {
      function visit(node) {
        if (typeof node.url === 'string' && !safeMarkdownUrl(node.url)) file.fail('预览中的链接请使用完整网址或以 /、# 开头的站内地址。');
        for (const child of node.children ?? []) visit(child);
      }
      visit(tree);
    };
  }
  const output = await unified().use(remarkParse).use(remarkGuestbook).use(previewLinks).use(remarkMedia)
    .use(remarkRehype).use(rehypeStringify).process({ value: body, path });
  return String(output);
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function base64ToText(content) {
  return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, '')), (character) => character.charCodeAt(0)));
}
