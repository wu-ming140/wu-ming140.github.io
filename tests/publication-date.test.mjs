import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { dateParts, validPublicationDate, publicationValue, publicationInstant, comparePublicationDates, replyPredatesMessage } from '../src/lib/publication-date.mjs';
import { buildDocument, parseDocument } from '../src/lib/studio-content.mjs';
import { serializeDraft, restoreDraft } from '../src/lib/studio-drafts.mjs';
import { initBrowseLists, groupMonths } from '../src/lib/browse.mjs';
import { contentDate, neighbors } from '../src/lib/editorial.mjs';
import { createSearchIndex } from '../src/lib/search-index.mjs';
import { searchEntries } from '../src/lib/search.mjs';
import { buildFeed } from '../src/lib/rss.mjs';
import { inspectPublication } from '../src/lib/publication-checks.mjs';

const fields = { type: 'article', name: 'timed-post', title: '学习笔记', date: '2026-11-02', time: '20:30', category: '笔记', description: '学习记录', author: '无暝', source: '博主自留', message: 'a-message', body: '正文' };

test('publication dates validate calendar dates, minute values and explicit time zones', () => {
  for (const value of ['2026-11-02', '2024-02-29T23:59+08:00', '2026-11-02T00:00Z', '2026-11-02 20:30', '2026-11-02T20:30:45.123+08:00']) assert.equal(validPublicationDate(value), true, value);
  for (const value of ['2026-02-29T20:30+08:00', '2026-02-30T20:30Z', '2026-11-02T24:00+08:00', '2026-11-02T20:60+08:00', '2026-11-02T20:30:60Z', '2026-11-02T20:30+08:60', '2026-11-02T2:30', '', undefined]) assert.equal(validPublicationDate(value), false, String(value));
  assert.throws(() => publicationValue('2026-11-02', '24:00'));
  assert.equal(publicationValue('2026-11-02', '00:00'), '2026-11-02T00:00+08:00');
});

test('display and sorting use Beijing time across day boundaries without inventing old article times', () => {
  const parts = dateParts('2026-11-01T16:05Z');
  assert.equal(parts.date, '2026-11-02');
  assert.equal(parts.time, '00:05');
  assert.equal(parts.day, '11.02 00:05');
  assert.equal(parts.label, '2026-11-02 00:05');
  assert.equal(parts.full, '2026-11-02T00:05+08:00');
  assert.deepEqual(dateParts(new Date('2026-11-01T16:05:49Z')), parts);
  assert.equal(dateParts('2026-10-30').time, '');
  assert.equal(dateParts('2026-10-30').label, '2026-10-30');
  assert.equal(comparePublicationDates('2026-11-02', '2026-11-02T00:00+08:00'), 0);
  assert.equal(comparePublicationDates('2026-11-02T00:05+08:00', '2026-11-01T16:05Z'), 0);
  assert.equal(publicationInstant('2026-11-02 20:30'), publicationInstant(fields.date + 'T20:30+08:00'));
});

test('all studio document types preserve minute precision through Markdown export and editing', () => {
  for (const type of ['article', 'message', 'question', 'reply']) {
    const result = buildDocument({ ...fields, type });
    const key = type === 'article' ? 'pubDate' : 'date';
    assert.equal(parseDocument(result.source).metadata[key], '2026-11-02T20:30+08:00');
    const parts = dateParts(result.metadata[key]);
    const edited = buildDocument({ ...fields, type, date: parts.date, time: parts.time, editPath: result.path, body: '修改正文' }, result.metadata);
    assert.equal(edited.metadata[key], result.metadata[key]);
    assert.equal(buildDocument({ ...fields, type, time: '' }).metadata[key], '2026-11-02');
  }
});

test('saved drafts retain chosen minutes and drafts from the old editor restore without adding a time', () => {
  const record = serializeDraft({ fields, assets: [], dirty: true });
  assert.equal(restoreDraft(record).fields.time, '20:30');
  delete record.fields.time;
  const old = restoreDraft(record);
  assert.equal(old.fields.time, '');
  assert.equal(old.fields.date, '2026-11-02');
});

test('same-day minute order reaches list modes, previous/next, search and RSS', () => {
  const early = { id: 'z-early', title: '学习早', date: '2026-11-02T20:30+08:00', url: '/early/', label: '学习', tags: [], body: '学习', category: '学习' };
  const late = { ...early, id: 'a-late', title: '学习晚', date: '2026-11-02T20:31+08:00', url: '/late/' };
  const entries = [early, late];
  const dom = new JSDOM('<div data-browse-list><div data-browse-controls><select><option value="newest">新</option><option value="oldest">旧</option><option value="months">月</option></select></div><div data-browse-items></div></div>', { url: 'https://blog.example/' });
  const document = dom.window.document;
  for (const entry of entries) {
    const node = document.createElement('article');
    node.dataset.entryDate = entry.date; node.dataset.entryId = entry.id;
    document.querySelector('[data-browse-items]').append(node);
  }
  initBrowseLists(document);
  const ids = () => [...document.querySelectorAll('[data-entry-id]')].map((node) => node.dataset.entryId);
  assert.deepEqual(ids(), [late.id, early.id]);
  for (const [mode, expected] of [['oldest', [early.id, late.id]], ['months', [late.id, early.id]]]) {
    document.querySelector('select').value = mode;
    document.querySelector('select').dispatchEvent(new dom.window.Event('change'));
    assert.deepEqual(ids(), expected, mode);
  }
  assert.equal(neighbors(entries, early).next.id, late.id);
  assert.equal(contentDate(late.date), late.date);
  const post = { frontmatter: { title: early.title, pubDate: early.date }, url: early.url, tags: [], column: { slug: 'learning', title: '学习' }, rawContent: () => '学习' };
  assert.equal(createSearchIndex([post])[0].date, early.date);
  assert.equal(searchEntries(entries, '学习')[0].id, late.id);
  const feed = new JSDOM(buildFeed(entries, { title: '学习', description: '记录', site: 'https://blog.example/', path: '/rss.xml' }), { contentType: 'application/xml' });
  assert.equal(feed.window.document.querySelector('item title').textContent, late.title);
  assert.equal(feed.window.document.querySelector('item pubDate').textContent, 'Mon, 02 Nov 2026 12:31:00 GMT');
  assert.equal(groupMonths([{ ...early, date: '2026-10-31T16:05Z' }])[0].month, '2026-11');
  feed.window.close(); dom.window.close();
});

test('publication checks and replies compare actual minutes while respecting missing legacy times', () => {
  assert.equal(replyPredatesMessage('2026-11-02T20:29+08:00', '2026-11-02T20:30+08:00'), true);
  assert.equal(replyPredatesMessage('2026-11-02T12:30Z', '2026-11-02T20:30+08:00'), false);
  assert.equal(replyPredatesMessage('2026-11-02', '2026-11-02T20:30+08:00'), false);
  const content = buildDocument(fields);
  const isFuture = (options) => inspectPublication(content, options).some((finding) => finding.message.includes('在未来'));
  assert.equal(isFuture({ today: '2026-11-02' }), false);
  assert.equal(isFuture({ now: new Date('2026-11-02T20:29:59+08:00') }), true);
  assert.equal(isFuture({ now: new Date('2026-11-02T20:30:01+08:00') }), false);
});
