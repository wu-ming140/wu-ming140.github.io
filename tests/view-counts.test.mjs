import test from 'node:test';
import assert from 'node:assert/strict';
import { initViewCounts } from '../src/lib/view-counts.mjs';

function fixture(origin = 'https://wu-ming140.github.io', types = ['site_pv', 'page_pv']) {
  const counters = types.map((type) => ({
    dataset: { viewCount: type, countOrigin: 'https://wu-ming140.github.io' },
    value: { textContent: '—' },
    querySelector() { return this.value; },
  }));
  const scripts = [];
  const timers = new Map();
  const doc = {
    querySelectorAll: () => counters,
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild: (script) => scripts.push(script) },
  };
  const win = {
    location: { origin },
    crypto: { randomUUID: () => 'test-request-id' },
    setTimeout(fn) { timers.set(1, fn); return 1; },
    clearTimeout(id) { timers.delete(id); },
  };
  const respond = (data) => {
    const callback = new URL(scripts[0].src).searchParams.get('jsonpCallback');
    win[callback](data);
  };
  return { doc, win, counters, scripts, timers, respond };
}

test('local and other preview origins never send a counting request', () => {
  for (const origin of ['http://localhost:4321', 'http://127.0.0.1:4321', 'https://preview.example.com', 'http://wu-ming140.github.io']) {
    const f = fixture(origin);
    initViewCounts(f.doc, f.win);
    assert.equal(f.scripts.length, 0);
    assert.ok(f.counters.every((counter) => counter.value.textContent === '预览不计数'));
  }
});

test('one request updates both counts, accepts zero, and uses a scoped referrer policy', () => {
  const f = fixture();
  initViewCounts(f.doc, f.win);
  initViewCounts(f.doc, f.win);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.counters[0].value.textContent, '—');
  assert.equal(f.scripts[0].referrerPolicy, 'no-referrer-when-downgrade');
  assert.equal(new URL(f.scripts[0].src).origin, 'https://busuanzi.ibruce.info');
  f.respond({ site_pv: 12345, page_pv: 0 });
  assert.equal(f.counters[0].value.textContent, '12,345 次');
  assert.equal(f.counters[1].value.textContent, '0 次');
  assert.equal(f.scripts[0].removed, true);
  assert.equal(f.timers.size, 0);
});

test('network errors, empty responses and timeouts never display a fake zero', () => {
  for (const fail of [(f) => f.scripts[0].onerror(), (f) => f.scripts[0].onload(), (f) => f.timers.get(1)()]) {
    const f = fixture();
    initViewCounts(f.doc, f.win);
    fail(f);
    assert.ok(f.counters.every((counter) => counter.value.textContent === '暂不可用'));
    assert.equal(f.scripts[0].removed, true);
    assert.equal(f.timers.size, 0);
    f.respond({ site_pv: 5, page_pv: 2 });
    assert.ok(f.counters.every((counter) => counter.value.textContent === '暂不可用'));
  }
});

test('invalid counter values cannot render markup or misleading numbers', () => {
  for (const invalid of ['<img src=x onerror=alert(1)>', '12', -1, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined]) {
    const f = fixture();
    initViewCounts(f.doc, f.win);
    f.respond({ site_pv: 3, page_pv: invalid });
    assert.equal(f.counters[0].value.textContent, '3 次');
    assert.equal(f.counters[1].value.textContent, '暂不可用');
  }
});

test('disabled counter markup makes initialization inert', () => {
  const f = fixture('https://wu-ming140.github.io', []);
  initViewCounts(f.doc, f.win);
  assert.equal(f.scripts.length, 0);
  assert.equal(f.timers.size, 0);
});
