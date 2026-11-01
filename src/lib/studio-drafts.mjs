import { MAX_MEDIA_BYTES, MAX_TOTAL_MEDIA_BYTES, mediaType } from './media.mjs';

const fieldNames = ['type', 'name', 'title', 'date', 'category', 'description', 'author', 'source', 'message', 'body', 'editPath'];
const conflictMessage = '另一页写作台已更新本地草稿，本页已停止自动保存。请先下载本页的完整草稿，再刷新或关闭其他写作台。';

// 只保存编辑内容；连接凭证、GitHub 客户端及临时预览地址不进入存储。
export function serializeDraft(state) {
  const fields = Object.fromEntries(fieldNames.map((name) => [name, String(state.fields[name] ?? '')]));
  fields.draft = Boolean(state.fields.draft);
  if (!['article', 'message', 'question', 'reply'].includes(fields.type)) throw new Error('草稿的内容类型无法识别。');
  let total = 0;
  const assets = state.assets.map((asset) => {
    const blob = asset.file;
    if (!(blob instanceof Blob) || !blob.size || blob.size > MAX_MEDIA_BYTES
      || !/^public\/media\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(asset.path)
      || !mediaType(asset.path) || asset.url !== `/${asset.path.slice(7)}`) {
      throw new Error('草稿附件不完整，请下载完整草稿保留当前内容。');
    }
    total += blob.size;
    return {
      blob: blob.slice(0, blob.size, blob.type), name: blob.name || 'media',
      lastModified: blob.lastModified || 0, path: asset.path, url: asset.url,
      markdown: String(asset.markdown), published: Boolean(asset.published),
    };
  });
  if (total > MAX_TOTAL_MEDIA_BYTES) throw new Error('草稿附件总计超过 50 MB。');
  return {
    version: 1, revision: crypto.randomUUID(), savedAt: Date.now(), fields,
    loadedSha: String(state.loadedSha || ''), originalMetadata: structuredClone(state.originalMetadata || {}),
    dirty: Boolean(state.dirty), assets,
  };
}

export function restoreDraft(record, createURL = (file) => URL.createObjectURL(file)) {
  if (record?.version !== 1 || !Array.isArray(record.assets)) throw new Error('这份本地草稿无法恢复，请保留当前页面并使用下载功能备份。');
  const files = record.assets.map((asset) => {
    if (!(asset.blob instanceof Blob)) throw new Error('本地草稿附件无法读取。');
    return { ...asset, file: new File([asset.blob], asset.name, { type: asset.blob.type, lastModified: asset.lastModified }) };
  });
  const checked = serializeDraft({ ...record, assets: files });
  return {
    ...checked, revision: record.revision, savedAt: record.savedAt,
    assets: files.map((asset, index) => ({ ...checked.assets[index], file: asset.file, preview: createURL(asset.file) })),
  };
}

export function createDraftStorage(indexedDB = globalThis.indexedDB) {
  let connection;
  function open() {
    if (!indexedDB) return Promise.reject(new Error('当前浏览器无法保存本地草稿，请使用「下载完整草稿」。'));
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      let finished = false;
      const request = indexedDB.open('wuming-writing-drafts', 1);
      const timer = setTimeout(() => fail(new Error('本地草稿存储暂时无法打开，请关闭其他写作台后刷新重试。')), 5000);
      function fail(error) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        connection = null;
        reject(error);
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('drafts')) request.result.createObjectStore('drafts');
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('本地草稿存储被其他页面占用，请关闭其他写作台后刷新重试。'));
      request.onsuccess = () => {
        if (finished) { request.result.close(); return; }
        finished = true;
        clearTimeout(timer);
        request.result.onversionchange = () => { request.result.close(); connection = null; };
        resolve(request.result);
      };
    });
    return connection;
  }
  async function transaction(key, mode, change) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const store = tx.objectStore('drafts');
      const request = store.get(key);
      let result;
      let failure;
      request.onsuccess = () => {
        try { result = change ? change(request.result, store) : request.result; }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('本地草稿保存失败。'));
    });
  }
  return {
    read: (key) => transaction(key, 'readonly'),
    write: (key, record, revision) => transaction(key, 'readwrite', (current, store) => {
      if ((current?.revision || null) !== revision) throw new Error(conflictMessage);
      store.put(record, key);
    }),
    remove: (key, revision) => transaction(key, 'readwrite', (current, store) => {
      if ((current?.revision || null) !== revision) throw new Error(conflictMessage);
      store.delete(key);
    }),
  };
}

// 按触发顺序执行保存与清除，防止较慢的旧保存覆盖新内容或复活已发布草稿。
export function createDraftSession(storage, key) {
  let revision = null;
  let tail = Promise.resolve();
  function enqueue(operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }
  return {
    read: () => enqueue(async () => {
      const record = await storage.read(key);
      revision = record?.revision || null;
      return record;
    }),
    save: (state) => {
      const record = serializeDraft(state);
      return enqueue(async () => {
        await storage.write(key, record, revision);
        revision = record.revision;
        return record;
      });
    },
    clear: () => enqueue(async () => { await storage.remove(key, revision); revision = null; }),
  };
}
