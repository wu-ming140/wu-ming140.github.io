import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { buildDocument, parseDocument, contentKind, bytesToBase64, base64ToText } from '../src/lib/studio-content.mjs';
import { createDraftArchive } from '../src/lib/studio-archive.mjs';
import { GitHubPublisher } from '../src/lib/studio-github.mjs';

const fields = { type: 'article', name: 'my-project', date: '2026-11-01', title: '作品："小工具"', description: '简介', category: '作品集', author: '无暝', source: '博主自留', message: '2026-11-01-hello', body: '正文\n\n![演示](/media/2026-11-01/abc-demo.mp4)' };

test('new portfolio posts, questions and replies round-trip Chinese and YAML safely', () => {
  for (const type of ['article', 'message', 'question', 'reply']) {
    const result = buildDocument({ ...fields, type });
    const parsed = parseDocument(result.source);
    assert.deepEqual(parsed.metadata, result.metadata);
    assert.equal(parsed.body.trim(), fields.body);
    assert.ok(contentKind(result.path));
    if (type === 'article') assert.equal(parsed.metadata.pubDate, '2026-11-01');
    else assert.equal(parsed.metadata.date, '2026-11-01');
    if (['message', 'question'].includes(type)) assert.equal(parsed.metadata.channel, 'other');
  }
});

test('existing articles retain their filename and metadata when edited', async () => {
  const path = 'src/pages/posts/wuming&first.md';
  const old = parseDocument(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const updated = buildDocument({ ...fields, editPath: path }, old.metadata);
  assert.equal(updated.path, path);
  assert.equal(updated.metadata.sample, old.metadata.sample);
  assert.equal(updated.metadata.title, fields.title);
  assert.equal(updated.metadata.layout, '../../layouts/PostLayout.astro');
});

test('invalid and reserved filenames, mismatched types, empty bodies and bad dates fail before publication', () => {
  for (const change of [{ name: '../escape' }, { name: 'index' }, { body: ' ' }, { date: '2026-02-30' }, { type: 'article', editPath: 'src/content/replies/old.md' }]) {
    assert.throws(() => buildDocument({ ...fields, ...change }));
  }
  assert.throws(() => buildDocument({ ...fields, type: 'message', name: 'elsewhere' }));
});

test('draft archive contains exact media bytes and correct repository paths', () => {
  const document = buildDocument(fields);
  const bytes = new Uint8Array([0, 255, 10, 128, 42]);
  const files = unzipSync(createDraftArchive(document, [{ path: 'public/media/2026-11-01/abc-demo.mp4', bytes }]));
  assert.deepEqual(Object.keys(files).sort(), ['public/media/2026-11-01/abc-demo.mp4', document.path].sort());
  assert.equal(strFromU8(files[document.path]), document.source);
  assert.deepEqual(files['public/media/2026-11-01/abc-demo.mp4'], bytes);
  assert.equal(base64ToText(bytesToBase64(new TextEncoder().encode(document.source))), document.source);
});

function fixture({ head = 'base', failPatch = false, failBlob = false, canPush = true } = {}) {
  const calls = [];
  let blobId = 0;
  const client = new GitHubPublisher({
    repository: 'https://github.com/owner/blog', branch: 'main', token: 'test-secret',
    fetchImpl: async (url, options) => {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ url, ...options, body });
      if (url.endsWith('/user')) return { ok: true, json: async () => ({ login: 'owner' }) };
      if (url.endsWith('/repos/owner/blog')) return { ok: true, json: async () => ({ permissions: { push: canPush } }) };
      if (url.endsWith('/git/ref/heads/main')) return { ok: true, json: async () => ({ object: { sha: head } }) };
      if (url.endsWith('/git/blobs')) return { ok: !failBlob, status: 500, json: async () => ({ sha: `blob-${++blobId}` }) };
      if (url.endsWith('/git/trees')) return { ok: true, json: async () => ({ sha: 'new-tree' }) };
      if (url.endsWith('/git/commits')) return { ok: true, json: async () => ({ sha: 'new-commit' }) };
      if (url.endsWith('/git/refs/heads/main')) return { ok: !failPatch, status: 422, json: async () => ({}) };
      throw new Error(`Unexpected URL ${url}`);
    },
  });
  const snapshot = { head: 'base', tree: 'base-tree', entries: new Map() };
  const document = buildDocument(fields);
  const assets = [{ path: 'public/media/2026-11-01/abc-demo.mp4', bytes: new Uint8Array([0, 1, 255]) }];
  return { client, calls, snapshot, document, assets };
}

test('publishing writes text and media atomically in one commit without forcing the branch', async () => {
  const f = fixture();
  await f.client.connect();
  const saved = await f.client.publish(f);
  assert.deepEqual(saved, { sha: 'new-commit', documentSha: 'blob-2' });
  const tree = f.calls.find((call) => call.url.endsWith('/git/trees')).body;
  assert.equal(tree.base_tree, 'base-tree');
  assert.deepEqual(tree.tree.map((entry) => entry.path), [f.assets[0].path, f.document.path]);
  assert.deepEqual(f.calls.find((call) => call.url.endsWith('/git/commits')).body.parents, ['base']);
  assert.deepEqual(f.calls.at(-1).body, { sha: 'new-commit', force: false });
  for (const call of f.calls) {
    assert.equal(new URL(call.url).origin, 'https://api.github.com');
    assert.equal(call.headers.Authorization, 'Bearer test-secret');
    assert.equal(call.credentials, 'omit');
    assert.ok(!JSON.stringify(call.body || {}).includes('test-secret'));
  }
  assert.ok(!JSON.stringify(f.client).includes('test-secret'));
});

test('existing path collisions and changed documents fail without writing any blob', async () => {
  const f = fixture();
  f.snapshot.entries.set(f.document.path, 'old-blob');
  await assert.rejects(f.client.publish(f), /文件名/);
  await assert.rejects(f.client.publish({ ...f, existing: true, expectedSha: 'stale-blob' }), /其他提交修改/);
  assert.equal(f.calls.length, 0);
});

test('concurrent updates and upload failures never replace the branch', async () => {
  for (const options of [{ head: 'changed' }, { failBlob: true }]) {
    const f = fixture(options);
    await assert.rejects(f.client.publish(f));
    assert.ok(!f.calls.some((call) => call.method === 'PATCH'));
  }
  const f = fixture({ failPatch: true });
  await assert.rejects(f.client.publish(f), /已有更新/);
  assert.equal(f.calls.filter((call) => call.method === 'PATCH').length, 1);
  assert.equal(f.calls.at(-1).body.force, false);
});

test('read-only accounts cannot connect as a publisher and media paths cannot replace code', async () => {
  const f = fixture({ canPush: false });
  await assert.rejects(f.client.connect(), /没有/);
  f.calls.length = 0;
  await assert.rejects(f.client.publish({ ...f, assets: [{ ...f.assets[0], path: '.github/workflows/deploy.yml' }] }), /媒体文件名/);
  assert.equal(f.calls.length, 0);
});
