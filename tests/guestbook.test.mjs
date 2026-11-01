import test from 'node:test';
import assert from 'node:assert/strict';
import remarkGuestbook, { validDate, safeMarkdownUrl, validateEntries } from '../src/lib/guestbook-rules.mjs';

test('dates must exist on the calendar, including leap years', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'bad']) {
    assert.equal(validDate(date), false, date);
  }
});

test('Markdown links reject executable schemes and control-character evasions', () => {
  for (const url of ['https://example.com/', 'http://example.com', '/posts/example/', '#heading', 'mailto:a@example.com']) {
    assert.equal(safeMarkdownUrl(url), true, url);
  }
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,test', '//example.com', '/\\example.com', 'file:///test', '../test']) {
    assert.equal(safeMarkdownUrl(url), false, url);
  }
});

const message = { id: '2026-11-01-alice', body: 'Hello', data: { date: '2026-11-01' } };
const reply = { id: '2026-11-02-reply', body: 'Hi', data: { message: message.id, date: '2026-11-02' } };

test('replies must refer to an existing message and cannot predate it', () => {
  assert.doesNotThrow(() => validateEntries([message], [reply]));
  assert.throws(() => validateEntries([], [reply]), /对应的留言不存在/);
  assert.throws(() => validateEntries([message], [{ ...reply, data: { ...reply.data, date: '2026-10-31' } }]), /不能早于/);
});

test('blank content and unsafe route names fail validation', () => {
  assert.throws(() => validateEntries([{ ...message, body: ' \n ' }], []), /正文不能为空/);
  assert.throws(() => validateEntries([{ ...message, id: '../bad' }], []), /文件名/);
  assert.throws(() => validateEntries([{ ...message, id: 'contribute' }], []), /页面地址冲突/);
  assert.throws(() => validateEntries([{ ...message, id: 'index' }], []), /页面地址冲突/);
  assert.throws(() => validateEntries([message], [{ ...reply, body: '' }]), /正文不能为空/);
});

test('Markdown guard handles nested HTML, links, images, and link definitions', () => {
  const guard = remarkGuestbook();
  const file = { path: 'D:\\blog\\src\\content\\guestbook\\hello.md', fail: (text) => { throw new Error(text); } };
  assert.throws(() => guard({ children: [{ children: [{ type: 'html', value: '<script>bad()</script>' }] }] }, file), /HTML/);
  for (const type of ['link', 'image', 'definition']) {
    assert.throws(() => guard({ children: [{ type, url: 'javascript:alert(1)' }] }, file), /链接/);
  }
  assert.doesNotThrow(() => guard({ children: [{ type: 'link', url: 'https://example.com' }] }, file));
  assert.doesNotThrow(() => guard({ children: [{ type: 'html' }] }, { ...file, path: '/blog/src/pages/posts/post.md' }));
  assert.throws(() => guard({ children: [{ type: 'html' }] }, { ...file, path: '/blog/src/content/replies/reply.md' }), /HTML/);
});
