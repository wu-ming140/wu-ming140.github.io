import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalizeTags, tagSlug, normalizeCover, collectTags } from '../src/lib/post-meta.mjs';
import { createSearchIndex, markdownText } from '../src/lib/search-index.mjs';
import { searchEntries, initSearch } from '../src/lib/search.mjs';
import { initToc } from '../src/lib/toc.mjs';
import { buildDocument, parseDocument } from '../src/lib/studio-content.mjs';

test('tags normalize Chinese separators and Unicode, deduplicate and keep punctuation-distinct routes', () => {
  assert.deepEqual(normalizeTags(' #编程，C++、Ｃ＋＋\nC# , 学习笔记 '), ['编程', 'C++', 'C#', '学习笔记']);
  assert.deepEqual(normalizeTags(['JavaScript', 'javascript', ' ']), ['JavaScript']);
  assert.equal(tagSlug('JavaScript'), tagSlug('javascript'));
  assert.notEqual(tagSlug('C++'), tagSlug('C#'));
  assert.notEqual(tagSlug('a/b'), tagSlug('a b'));
  for (const tag of ['C++', 'C#', '机器学习', '../', '<script>', 'A/B']) assert.match(tagSlug(tag), /^[\p{Letter}\p{Number}-]+$/u);
  assert.throws(() => normalizeTags([true]));
  assert.throws(() => normalizeTags('字'.repeat(33)));
  assert.throws(() => normalizeTags(Array.from({ length: 13 }, (_, i) => `tag${i}`)));
  assert.deepEqual(collectTags([{ tags: ['C++', '编程'] }, { tags: ['编程'] }]).map(({ tag, count }) => [tag, count]), [['编程', 2], ['C++', 1]]);
});

test('covers reject executable schemes and videos; studio document round-trips tags and covers', () => {
  for (const value of ['javascript:alert(1)', '//external.invalid/a.jpg', 'data:image/png;base64,AA', '/media/movie.mp4', '/media/a.jpg\n<script>']) assert.throws(() => normalizeCover(value));
  assert.equal(normalizeCover(' /media/cover.webp '), '/media/cover.webp');
  assert.equal(normalizeCover('https://example.com/cover.png?token=x'), 'https://example.com/cover.png?token=x');
  const fields = { type: 'article', name: 'project', title: '一个作品', description: '作品简介', category: '作品集', date: '2026-11-01', body: '正文', tags: '编程，C++', cover: '/media/cover.webp', coverAlt: '作品截图' };
  const saved = buildDocument(fields);
  const parsed = parseDocument(saved.source);
  assert.deepEqual(parsed.metadata.tags, ['编程', 'C++']);
  assert.equal(parsed.metadata.cover, fields.cover);
  assert.equal(parsed.metadata.coverAlt, fields.coverAlt);
  const removed = buildDocument({ ...fields, tags: '', cover: '' }, parsed.metadata);
  assert.equal(removed.metadata.cover, undefined);
  assert.equal(removed.metadata.tags, undefined);
});

test('full-text index includes public replies and image captions but excludes drafts and Markdown/HTML markup', () => {
  const post = { frontmatter: { title: '公开作品', pubDate: '2026-11-01' }, url: '/posts/project/', tags: ['C++'], column: { slug: 'portfolio', title: '作品集' }, rawContent: () => '## 功能\n\n**递归**与 `DFS`，![截图说明](/media/a.png)\n\n<script>secret()</script>' };
  const message = { data: { title: '提问', author: '读者', date: '2026-11-01' }, url: '/guestbook/question/', body: '问题正文', replies: [{ data: {}, body: '公开回答' }, { data: { draft: true }, body: '隐藏回答' }] };
  const index = createSearchIndex([post, { ...post, frontmatter: { ...post.frontmatter, draft: true, title: '隐藏文章' } }], [message, { ...message, data: { ...message.data, draft: true, title: '隐藏留言' } }]);
  assert.equal(index.length, 2);
  assert.equal(index[0].type, '作品');
  assert.ok(index[0].body.includes('递归与 DFS'));
  assert.ok(index[0].body.includes('截图说明'));
  assert.ok(index[1].body.includes('公开回答'));
  assert.ok(!JSON.stringify(index).includes('隐藏'));
  assert.ok(!JSON.stringify(index).includes('secret()'));
  assert.equal(markdownText('[链接文字](https://example.com)'), '链接文字');
});

const entries = [
  { title: '递归笔记', url: '/posts/recursion/', body: '深度优先搜索与算法', description: '学习过程', type: '文章', category: '学习心得', date: '2026-10-30', tags: ['C++'] },
  { title: '小工具', url: '/posts/tool/', body: '用递归写了一个工具', description: '', type: '作品', category: '作品集', date: '2026-11-01', tags: ['编程'] },
];
test('search ranks title hits, matches Chinese body and tags, combines keywords and filters types', () => {
  assert.deepEqual(searchEntries(entries, '递归').map((item) => item.title), ['递归笔记', '小工具']);
  assert.equal(searchEntries(entries, '深度优先 C++')[0].title, '递归笔记');
  assert.equal(searchEntries(entries, 'ｃ＋＋')[0].title, '递归笔记');
  assert.equal(searchEntries(entries, '递归', '作品')[0].title, '小工具');
  assert.equal(searchEntries(entries, '递归 不存在').length, 0);
  assert.equal(searchEntries(entries, '  ').length, 0);
});

function searchPage(query = '') {
  const dom = new JSDOM('<form id="site-search" data-index="/search-index.json"><input><select><option value="">全部</option><option>作品</option></select><p data-search-status></p><ul data-search-results></ul><button data-search-more type="button" hidden>更多</button></form>', { url: `https://blog.example/search/${query}` });
  return { dom, document: dom.window.document, root: dom.window.document.querySelector('form') };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('search UI handles URL query, text-only results, one lazy index request and type changes', async () => {
  const { dom, document, root } = searchPage('?q=递归');
  let requests = 0;
  initSearch(document, async () => { requests++; return { ok: true, json: async () => [...entries, { ...entries[0], title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' }] }; });
  await tick();
  assert.equal(root.querySelector('input').value, '递归');
  assert.equal(root.querySelectorAll('li').length, 2);
  assert.equal(root.querySelectorAll('img').length, 0);
  root.querySelector('select').value = '作品';
  root.querySelector('select').dispatchEvent(new dom.window.Event('change'));
  await tick();
  assert.equal(root.querySelectorAll('li').length, 1);
  assert.equal(requests, 1);
  assert.equal(new URL(dom.window.location.href).searchParams.get('type'), '作品');
  dom.window.close();
});

test('empty searches make no requests; failed index loads can be retried without an endless loading state', async () => {
  const { dom, document, root } = searchPage();
  let requests = 0;
  initSearch(document, async () => { requests++; return { ok: requests > 1, json: async () => entries }; });
  assert.equal(requests, 0);
  root.querySelector('input').value = '递归';
  root.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await tick();
  assert.match(root.querySelector('[data-search-status]').textContent, /重试/);
  root.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await tick();
  assert.equal(root.querySelectorAll('li').length, 2);
  assert.equal(requests, 2);
  dom.window.close();
});

test('article directory handles Chinese anchors, updates the active section and starts collapsed on mobile', () => {
  const dom = new JSDOM('<details data-article-toc open><a href="#%E6%97%A9%E4%B8%8A">早上</a><a href="#afternoon">下午</a></details><h2 id="早上">早上</h2><h2 id="afternoon">下午</h2>', { url: 'https://blog.example/post/' });
  const { document } = dom.window;
  dom.window.matchMedia = () => ({ matches: true });
  let first = 200, second = 500;
  document.getElementById('早上').getBoundingClientRect = () => ({ top: first });
  document.getElementById('afternoon').getBoundingClientRect = () => ({ top: second });
  initToc(document);
  assert.equal(document.querySelector('details').open, false);
  assert.equal(document.querySelectorAll('a')[0].getAttribute('aria-current'), 'location');
  first = -100; second = 120;
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(document.querySelectorAll('a')[1].getAttribute('aria-current'), 'location');
  assert.equal(document.querySelectorAll('a')[0].hasAttribute('aria-current'), false);
  dom.window.close();
});
