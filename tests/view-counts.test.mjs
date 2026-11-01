import test from 'node:test';
import assert from 'node:assert/strict';
import { initViewCounts } from '../src/lib/view-counts.mjs';

function fixture(origin = 'https://wu-ming140.github.io', types = ['site_pv', 'page_pv']) {
  const counters = types.map((type) => ({
    dataset: { viewCount: type, countOrigin: 'https://wu-ming140.github.io' },
    value: { textContent: '加载中…' },
    querySelector() { return this.value; },
  }));
  const calls = [];
  const timers = new Map();
  const listeners = new Map();
  let resolveRequest;
  let rejectRequest;
  const request = new Promise((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject; });
  const doc = {
    readyState: 'complete',
    querySelectorAll: () => counters,
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  // No crypto.randomUUID: counting must work without this unrelated browser API.
  const win = {
    location: { origin, pathname: '/posts/wuming&first/', search: '?share=1', hash: '#text' },
    AbortController,
    fetch(url, options) { calls.push({ url, options }); return request; },
    setTimeout(fn) { timers.set(1, fn); return 1; },
    clearTimeout(id) { timers.delete(id); },
  };
  const respond = (data, status = 'success', ok = true) => resolveRequest({ ok, json: async () => ({ status, data }) });
  return { doc, win, counters, calls, timers, listeners, respond, reject: (error) => rejectRequest(error) };
}

test('local and other preview origins never send a counting request', async () => {
  for (const origin of ['http://localhost:4321', 'http://127.0.0.1:4321', 'https://preview.example.com', 'http://wu-ming140.github.io']) {
    const f = fixture(origin);
    await initViewCounts(f.doc, f.win);
    assert.equal(f.calls.length, 0);
    assert.ok(f.counters.every((counter) => counter.value.textContent === '预览不计数'));
  }
});

test('one request updates homepage, footer and article, including real zero', async () => {
  const f = fixture('https://wu-ming140.github.io', ['site_pv', 'page_pv', 'site_pv']);
  const pending = initViewCounts(f.doc, f.win);
  await initViewCounts(f.doc, f.win);
  assert.equal(f.calls.length, 1);
  assert.equal(f.counters[0].value.textContent, '加载中…');
  const { url, options } = f.calls[0];
  assert.equal(url, 'https://events.vercount.one/api/v2/log');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.deepEqual(JSON.parse(options.body), { url: 'https://wu-ming140.github.io/posts/wuming&first/', isNewUv: false });
  f.respond({ site_pv: 12345, page_pv: 0 });
  await pending;
  assert.deepEqual(f.counters.map((counter) => counter.value.textContent), ['12,345 次', '0 次', '12,345 次']);
  assert.equal(f.timers.size, 0);
});

test('network, HTTP and API errors show unavailable rather than zero or endless loading', async () => {
  for (const fail of [(f) => f.reject(new Error('network')), (f) => f.respond({}, 'success', false), (f) => f.respond({ site_pv: 0 }, 'error'), (f) => f.respond(null)]) {
    const f = fixture();
    const pending = initViewCounts(f.doc, f.win);
    fail(f);
    await pending;
    assert.ok(f.counters.every((counter) => counter.value.textContent === '暂不可用'));
    assert.equal(f.timers.size, 0);
  }
});

test('timeouts abort requests, display a final state and ignore late responses', async () => {
  const f = fixture();
  const pending = initViewCounts(f.doc, f.win);
  f.timers.get(1)();
  assert.equal(f.calls[0].options.signal.aborted, true);
  assert.ok(f.counters.every((counter) => counter.value.textContent === '暂不可用'));
  f.respond({ site_pv: 5, page_pv: 2 });
  await pending;
  assert.ok(f.counters.every((counter) => counter.value.textContent === '暂不可用'));
  assert.equal(f.timers.size, 0);
});

test('invalid counter values cannot render markup or misleading numbers', async () => {
  for (const invalid of ['<img src=x onerror=alert(1)>', '12', -1, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined]) {
    const f = fixture();
    const pending = initViewCounts(f.doc, f.win);
    f.respond({ site_pv: 3, page_pv: invalid });
    await pending;
    assert.equal(f.counters[0].value.textContent, '3 次');
    assert.equal(f.counters[1].value.textContent, '暂不可用');
  }
});

test('initialization before parsing waits until the counter elements exist', async () => {
  const f = fixture();
  f.doc.readyState = 'loading';
  await initViewCounts(f.doc, f.win);
  assert.equal(f.calls.length, 0);
  f.doc.readyState = 'interactive';
  const pending = f.listeners.get('DOMContentLoaded')();
  assert.equal(f.calls.length, 1);
  f.respond({ site_pv: 3, page_pv: 1 });
  await pending;
  assert.equal(f.counters[1].value.textContent, '1 次');
});

test('disabled counter markup makes initialization inert', async () => {
  const f = fixture('https://wu-ming140.github.io', []);
  await initViewCounts(f.doc, f.win);
  assert.equal(f.calls.length, 0);
  assert.equal(f.timers.size, 0);
});
