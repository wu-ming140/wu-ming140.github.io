import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { availableBoards, normalizePlacements, normalizeCollections, curatedEntries, collectionGroups, neighbors, relatedEntries } from '../src/lib/editorial.mjs';
import { createEditorialControls } from '../src/lib/editorial-controls.mjs';
import { initBrowseLists } from '../src/lib/browse.mjs';
import { inspectPublication } from '../src/lib/publication-checks.mjs';
import { buildFeed } from '../src/lib/rss.mjs';
import { buildDocument } from '../src/lib/studio-content.mjs';

const base = { id: '/posts/first/', url: '/posts/first/', path: 'src/pages/posts/first.md', title: '算法入门', date: '2026-10-30', type: 'article', column: 'learning', label: '学习心得', tags: ['编程'], channel: '', answered: false, placements: {}, collections: [] };
const fields = { type: 'article', name: 'first', title: '算法入门', date: '2026-10-30', category: '笔记', description: '学习记录', body: '正文', tags: '编程' };

test('pinning and selection are isolated by scope, kind, channel and unanswered state', () => {
  const entries = [
    { ...base, placements: { learning: { pinned: true }, hall: { featured: true } } },
    { ...base, id: 'question', type: 'question', channel: 'other', placements: { questions: { pinned: true }, elsewhere: { featured: true } } },
    { ...base, id: 'answered', type: 'question', answered: true, placements: { unanswered: { pinned: true } } },
    { ...base, id: 'wrong', type: 'article', placements: { questions: { pinned: true } } },
  ];
  assert.deepEqual(curatedEntries(entries, 'learning', 'pinned').map((entry) => entry.id), [base.id]);
  assert.equal(curatedEntries(entries, 'hall', 'pinned').length, 0);
  assert.equal(curatedEntries(entries, 'hall', 'featured').length, 1);
  assert.deepEqual(curatedEntries(entries, 'questions', 'pinned').map((entry) => entry.id), ['question']);
  assert.equal(curatedEntries(entries, 'guestbook', 'pinned').length, 0);
  assert.equal(curatedEntries(entries, 'messages', 'pinned').length, 0);
  assert.equal(curatedEntries(entries, 'unanswered', 'pinned').length, 0);
  assert.deepEqual(availableBoards('question', '', 'github'), ['guestbook', 'questions', 'unanswered']);
  assert.throws(() => normalizePlacements({ toString: { pinned: true } }));
  assert.throws(() => normalizePlacements({ hall: { pinned: 'false' } }));
});

test('publishing and cancelling placements preserve other scopes; changing columns does not migrate flags', () => {
  const metadata = { placements: { hall: { pinned: true, featured: true }, learning: { pinned: true } }, collections: [{ name: '基础课', order: 2 }] };
  const saved = buildDocument({ ...fields, placements: { hall: { pinned: false, featured: true }, learning: { pinned: true } }, collections: [] }, metadata);
  assert.deepEqual(saved.metadata.placements, { hall: { pinned: false, featured: true }, learning: { pinned: true, featured: false } });
  assert.equal(saved.metadata.collections, undefined);
  const cleared = buildDocument({ ...fields, placements: {} }, metadata);
  assert.equal(cleared.metadata.placements, undefined);
  const moved = buildDocument({ ...fields, category: '生活' }, metadata);
  assert.equal(moved.metadata.placements.learning, undefined);
  assert.equal(moved.metadata.placements.life, undefined);
  assert.equal(moved.metadata.placements.hall.pinned, true);
  const question = buildDocument({ ...fields, type: 'question', author: '读者', source: '微信', placements: { questions: { pinned: true }, messages: { featured: true } } });
  assert.ok(question.metadata.placements.questions.pinned);
  assert.equal(question.metadata.placements.messages, undefined);
});

test('collections support cross-type entries, multiple membership and explicit sequence independent of dates', () => {
  const entries = [
    { ...base, collections: [{ name: '算法基础', order: 3 }] },
    { ...base, id: 'second', date: '2026-11-01', type: 'question', collections: [{ name: '算法基础', order: 1 }, { name: '问答', order: 1 }] },
    { ...base, id: 'third', date: '2026-10-29', collections: [{ name: '算法基础', order: 2 }] },
  ];
  const group = collectionGroups(entries).find((item) => item.name === '算法基础');
  assert.deepEqual(group.items.map((item) => item.id), ['second', 'third', base.id]);
  const adjacent = neighbors(entries, base);
  assert.equal(adjacent.previous.id, 'third');
  assert.equal(adjacent.next.id, 'second');
  assert.equal(relatedEntries(entries[0], entries)[0].id, 'third');
  assert.ok(!relatedEntries(base, entries).some((item) => item.id === base.id));
  assert.throws(() => normalizeCollections([{ name: 'A', order: -1 }]));
  assert.throws(() => normalizeCollections([{ name: 'A', order: 1 }, { name: 'a', order: 2 }]));
  assert.deepEqual(normalizeCollections([{ name: '', order: 'bad' }]), []);
});

test('editor controls cancel one board without altering another and add/remove collection membership', () => {
  const dom = new JSDOM('<div id="placements"></div><div id="collections"></div>');
  let changes = 0;
  const controls = createEditorialControls({ document: dom.window.document, placementsRoot: dom.window.document.getElementById('placements'), collectionsRoot: dom.window.document.getElementById('collections'), getContext: () => ({ type: 'article', column: 'learning', channel: '', busy: false }), onChange: () => changes++ });
  controls.set({ placements: { hall: { pinned: true }, learning: { featured: true } }, collections: [{ name: '编程课', order: 4 }] });
  const hall = dom.window.document.querySelector('[data-board="hall"]');
  hall.closest('.studio-placement-row').querySelector('button').click();
  assert.equal(controls.fields().placements.hall, undefined);
  assert.equal(controls.fields().placements.learning.featured, true);
  assert.deepEqual(controls.fields().collections, [{ name: '编程课', order: '4' }]);
  dom.window.document.querySelector('#collections button').click();
  assert.deepEqual(controls.fields().collections, []);
  assert.equal(changes, 2);
  dom.window.close();
});

test('archive is selectable, reversible and filter-aware, without duplicating content nodes', () => {
  const dom = new JSDOM('<div data-browse-list data-layout="rows"><div data-browse-controls hidden><select><option value="newest">新</option><option value="oldest">旧</option><option value="months">归档</option></select></div><div data-browse-items><article data-entry-date="2026-10-01" data-entry-id="a">A</article><article data-entry-date="2026-11-01" data-entry-id="b">B</article></div></div>', { url: 'https://blog.example/' });
  const document = dom.window.document;
  initBrowseLists(document);
  const select = document.querySelector('select');
  assert.equal(select.value, 'newest');
  assert.equal(document.querySelector('[data-browse-items]').firstElementChild.textContent, 'B');
  select.value = 'months'; select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(document.querySelectorAll('[data-browse-month]').length, 2);
  assert.equal(document.querySelectorAll('[data-entry-date]').length, 2);
  document.querySelector('[data-entry-id="b"]').hidden = true;
  document.querySelector('[data-browse-list]').dispatchEvent(new dom.window.Event('browse:filter'));
  assert.equal(document.querySelector('[data-browse-month="2026-11"]').hidden, true);
  select.value = 'oldest'; select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(document.querySelector('[data-browse-items]').firstElementChild.textContent, 'A');
  assert.equal(document.querySelectorAll('[data-browse-month]').length, 0);
  assert.equal(new URL(dom.window.location.href).searchParams.get('sort'), 'oldest');
  dom.window.close();
});

test('publication checks distinguish suggestions from missing files and do not reject new attachments', () => {
  const content = buildDocument({ ...fields, category: '作品集', description: '', body: '![](/media/missing.png)\n\n[引用][undefined]' });
  const findings = inspectPublication(content, { entries: new Map(), today: '2026-11-01' });
  assert.ok(findings.some((item) => item.level === 'warning' && item.message.includes('封面')));
  assert.ok(findings.some((item) => item.level === 'warning' && item.message.includes('说明')));
  assert.ok(findings.some((item) => item.level === 'error' && item.message.includes('找不到')));
  const image = buildDocument({ ...fields, body: '![图片说明](/media/new.png)' });
  assert.ok(!inspectPublication(image, { assets: [{ path: 'public/media/new.png', url: '/media/new.png' }], entries: new Map() }).some((item) => item.level === 'error'));
  assert.ok(inspectPublication(image, { assets: [{ path: 'public/media/new.png', url: '/media/new.png', published: true }], entries: new Map() }).some((item) => item.level === 'error'));
  const alias = buildDocument({ ...fields, body: '![说明][image]\n\n[image]: /media/existing.png' });
  assert.ok(!inspectPublication(alias, { entries: new Map([['public/media/existing.png', 'sha']]) }).some((item) => item.level === 'error'));
});

test('RSS is well-formed XML with absolute stable URLs, escaped content and a 50-item limit', () => {
  const entries = Array.from({ length: 55 }, (_, index) => ({ ...base, id: `entry-${index}`, url: `/posts/中文-${index}/?a=1&b=2`, title: '<作品> & "说明"', excerpt: '<script>不会作为 HTML 执行</script> & 字符\u0001' }));
  const xml = buildFeed(entries, { title: '无暝 & 小站', description: '公开内容', site: 'https://blog.example/', path: '/rss.xml', now: new Date('2026-11-01T00:00:00Z') });
  const dom = new JSDOM(xml, { contentType: 'application/xml' });
  const document = dom.window.document;
  assert.equal(document.querySelectorAll('item').length, 50);
  assert.equal(document.querySelector('channel > title').textContent, '无暝 & 小站');
  assert.equal(document.querySelector('item title').textContent, '<作品> & "说明"');
  assert.ok(document.querySelector('item link').textContent.startsWith('https://blog.example/posts/%E4%B8%AD'));
  assert.equal(document.querySelector('item guid').getAttribute('isPermaLink'), 'true');
  assert.equal(document.querySelectorAll('script').length, 0);
  assert.equal(document.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')[0].getAttribute('href'), 'https://blog.example/rss.xml');
  dom.window.close();
});
