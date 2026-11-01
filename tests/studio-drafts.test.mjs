import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createDraftStorage, createDraftSession, serializeDraft, restoreDraft } from '../src/lib/studio-drafts.mjs';

function fixture() {
  const asset = (extension, bytes, published = false) => ({
    file: new File([new Uint8Array(bytes)], `中文附件.${extension}`, { type: extension === 'png' ? 'image/png' : 'video/mp4', lastModified: 12345 }),
    path: `public/media/2026-11-01/abc-media.${extension}`, url: `/media/2026-11-01/abc-media.${extension}`,
    markdown: `![附件](/media/2026-11-01/abc-media.${extension})`, preview: 'blob:expired-preview', published,
    token: 'secret-never-save',
  });
  return {
    fields: { type: 'question', name: 'my-question', title: '来自微信的问题', date: '2026-11-01', category: '作品集', description: '说明', author: '无暝', source: '微信', message: '', draft: true, body: '问题与回答\n\n![图](/media/2026-11-01/abc-media.png)', editPath: 'src/content/guestbook/my-question.md', token: 'secret-never-save' },
    loadedSha: 'original-document-sha', originalMetadata: { custom: ['保留原来的属性'], channel: 'other' },
    dirty: true, assets: [asset('png', [0, 1, 128, 255]), asset('mp4', [42, 128, 0, 255, 10], true)],
    token: 'secret-never-save', publisher: { token: 'secret-never-save' }, snapshot: 'connection-only',
  };
}

test('IndexedDB restores fields, original revision and exact image/video bytes with fresh preview URLs', async () => {
  const storage = createDraftStorage(new IDBFactory());
  const first = createDraftSession(storage, 'repo#main');
  assert.equal(await first.read(), undefined);
  const state = fixture();
  const saved = await first.save(state);
  const reopened = createDraftSession(storage, 'repo#main');
  const persisted = await reopened.read();
  let urlId = 0;
  const restored = restoreDraft(persisted, () => `blob:restored-${++urlId}`);
  const { token: ignored, ...expectedFields } = state.fields;
  assert.deepEqual(restored.fields, expectedFields);
  assert.deepEqual(restored.originalMetadata, state.originalMetadata);
  assert.equal(restored.loadedSha, state.loadedSha);
  assert.equal(restored.revision, saved.revision);
  assert.equal(restored.dirty, true);
  for (let index = 0; index < state.assets.length; index++) {
    const before = state.assets[index];
    const after = restored.assets[index];
    assert.equal(after.file.name, before.file.name);
    assert.equal(after.file.type, before.file.type);
    assert.equal(after.file.lastModified, before.file.lastModified);
    assert.deepEqual(new Uint8Array(await after.file.arrayBuffer()), new Uint8Array(await before.file.arrayBuffer()));
    assert.equal(after.path, before.path);
    assert.equal(after.published, before.published);
    assert.equal(after.preview, `blob:restored-${index + 1}`);
  }
  assert.ok(!JSON.stringify(persisted).includes('secret-never-save'));
  assert.ok(!JSON.stringify(persisted).includes('blob:expired'));
  assert.ok(!JSON.stringify(persisted).includes('connection-only'));
});

test('queued saves and clear preserve ordering so published/discarded drafts do not return', async () => {
  const storage = createDraftStorage(new IDBFactory());
  const session = createDraftSession(storage, 'repo#main');
  await session.read();
  const state = fixture();
  const first = session.save(state);
  state.fields.body = '第二次编辑';
  const second = session.save(state);
  const clear = session.clear();
  await Promise.all([first, second, clear]);
  assert.equal(await storage.read('repo#main'), undefined);
  state.fields.body = '发布后的新修改';
  await session.save(state);
  assert.equal((await storage.read('repo#main')).fields.body, '发布后的新修改');
});

test('captured saves do not change when live fields or metadata are subsequently edited', async () => {
  const storage = createDraftStorage(new IDBFactory());
  const session = createDraftSession(storage, 'repo#main');
  const state = fixture();
  const pending = session.save(state);
  state.fields.body = '更晚的编辑';
  state.originalMetadata.custom.push('更晚的属性');
  await pending;
  const stored = await storage.read('repo#main');
  assert.notEqual(stored.fields.body, state.fields.body);
  assert.deepEqual(stored.originalMetadata.custom, ['保留原来的属性']);
});

test('another tab cannot overwrite or delete newer drafts, and repositories have separate drafts', async () => {
  const storage = createDraftStorage(new IDBFactory());
  const left = createDraftSession(storage, 'repo#main');
  const right = createDraftSession(storage, 'repo#main');
  await Promise.all([left.read(), right.read()]);
  await left.save(fixture());
  await assert.rejects(right.save(fixture()), /另一页写作台/);
  await assert.rejects(right.clear(), /另一页写作台/);
  assert.ok(await storage.read('repo#main'));
  assert.equal(await storage.read('other-repo#main'), undefined);
  await left.clear();
  assert.equal(await storage.read('repo#main'), undefined);
});

test('storage and quota failures reject without poisoning subsequent saves', async () => {
  const storage = createDraftStorage(new IDBFactory());
  let fail = true;
  const session = createDraftSession({
    ...storage,
    write: (...args) => {
      if (fail) { fail = false; throw new DOMException('空间不足', 'QuotaExceededError'); }
      return storage.write(...args);
    },
  }, 'repo#main');
  await assert.rejects(session.save(fixture()), /空间不足/);
  assert.equal(await storage.read('repo#main'), undefined);
  await session.save(fixture());
  assert.ok(await storage.read('repo#main'));
  await assert.rejects(createDraftStorage(null).read('key'), /无法保存本地草稿/);
});

test('corrupted drafts and invalid attachments fail without creating any preview URL', () => {
  let created = 0;
  const createURL = () => { created++; return 'blob:unexpected'; };
  assert.throws(() => restoreDraft({ version: 9, assets: [] }, createURL));
  const state = fixture();
  const record = serializeDraft(state);
  record.assets[1].blob = undefined;
  assert.throws(() => restoreDraft(record, createURL), /附件无法读取/);
  assert.equal(created, 0);
  state.assets[0].path = 'public/media/../../script.png';
  assert.throws(() => serializeDraft(state), /附件不完整/);
});
