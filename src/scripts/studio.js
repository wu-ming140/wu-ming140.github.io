import { createDraftArchive } from '../lib/studio-archive.mjs';
import { getPostColumn } from '../lib/columns';
import { mediaType, mediaPath, mediaMarkdown, MAX_MEDIA_BYTES, MAX_TOTAL_MEDIA_BYTES } from '../lib/media.mjs';
import { buildDocument, parseDocument, renderMarkdown, contentKind, base64ToText } from '../lib/studio-content.mjs';
import { GitHubPublisher } from '../lib/studio-github.mjs';

const root = document.getElementById('studio');
const byId = (name) => document.getElementById(`studio-${name}`);
const body = byId('body');
const form = byId('form');
let publisher = null;
let snapshot = null;
let editPath = '';
let loadedSha = '';
let originalMetadata = {};
let assets = [];
let dirty = false;
let busy = false;
let planned = null;
let previewVersion = 0;
let previewTimer;
let mediaPending = false;

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(6))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function status(message) { byId('status').textContent = message; }
function errorMessage(error) { return error instanceof Error ? error.message : '暂时无法完成，请稍后重试。'; }
function activeAssets(source) { return assets.filter((asset) => source.includes(asset.url)); }

function showFields() {
  for (const label of root.querySelectorAll('[data-for]')) label.hidden = !label.dataset.for.split(' ').includes(byId('type').value);
  byId('type').disabled = Boolean(editPath) || busy;
  byId('name').readOnly = Boolean(editPath);
}

function setBusy(value) {
  busy = value;
  for (const element of root.querySelectorAll('input, select, textarea, button')) element.disabled = value;
  if (!value) {
    byId('existing').disabled = !publisher;
    byId('load').disabled = !publisher;
    byId('publish').disabled = !publisher;
    showFields();
  }
}

function releaseAssets() {
  for (const asset of assets) URL.revokeObjectURL(asset.preview);
  assets = [];
  byId('assets').replaceChildren();
}

function newDocument() {
  if (busy || (dirty && !confirm('当前编辑尚未发布。需要保留时，请先下载完整草稿。继续新建吗？'))) return;
  form.reset();
  releaseAssets();
  editPath = '';
  loadedSha = '';
  originalMetadata = {};
  byId('name').value = `${today()}-${randomId()}`;
  byId('date').value = today();
  byId('author').value = root.dataset.author;
  byId('source').value = '博主自留';
  body.value = '';
  byId('actions-link').hidden = true;
  dirty = false;
  showFields();
  status('');
  void preview();
}

function fields() {
  return {
    type: byId('type').value, name: byId('name').value, title: byId('title').value,
    date: byId('date').value, category: byId('category').value,
    description: byId('description').value, author: byId('author').value,
    source: byId('source').value, message: byId('message').value,
    draft: byId('draft').checked, body: body.value, editPath,
  };
}

async function preview() {
  const version = ++previewVersion;
  try {
    const html = await renderMarkdown(body.value, byId('type').value);
    if (version !== previewVersion) return;
    byId('preview-error').hidden = true;
    const target = byId('preview');
    target.innerHTML = html || '<p class="studio-empty">你的文字、图片和视频会显示在这里。</p>';
    for (const media of target.querySelectorAll('img, video')) {
      const path = media.getAttribute('src');
      const asset = assets.find((item) => item.url === path);
      if (asset) media.src = asset.preview;
      else if (path?.startsWith('/')) media.src = `${root.dataset.site}${path}`;
      if (media.tagName === 'IMG') media.loading = 'lazy';
    }
    for (const link of target.querySelectorAll('a')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const asset = assets.find((item) => item.url === link.getAttribute('href'));
      if (asset) link.href = asset.preview;
    }
  } catch (error) {
    if (version !== previewVersion) return;
    byId('preview-error').hidden = false;
    byId('preview-error').textContent = errorMessage(error);
    byId('preview').replaceChildren();
  }
}

function insert(text) {
  body.setRangeText(`\n\n${text}\n\n`, body.selectionStart, body.selectionEnd, 'end');
  body.focus();
  dirty = true;
  void preview();
}

function renderAssets() {
  const list = byId('assets');
  list.replaceChildren();
  for (const asset of assets) {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${mediaType(asset.url) === 'video' ? '视频' : '图片'} · ${asset.file.name} · ${(asset.file.size / 1024 / 1024).toFixed(2)} MB`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '移除';
    remove.disabled = busy;
    remove.addEventListener('click', () => {
      if (busy) return;
      body.value = body.value.replaceAll(asset.markdown, '');
      URL.revokeObjectURL(asset.preview);
      assets = assets.filter((item) => item !== asset);
      dirty = true;
      renderAssets();
      void preview();
    });
    row.append(label, remove);
    list.append(row);
  }
}

async function addFiles(files) {
  if (busy || mediaPending) return;
  mediaPending = true;
  try {
    const selected = [...files];
    if (!selected.length) return;
    if (selected.some((file) => file.size === 0 || file.size > MAX_MEDIA_BYTES)) throw new Error('请选择非空文件，且每个文件不超过 20 MB。较长的视频可以改用媒体网址。');
    if (selected.reduce((sum, file) => sum + file.size, 0) + assets.reduce((sum, asset) => sum + asset.file.size, 0) > MAX_TOTAL_MEDIA_BYTES) throw new Error('本次附件总计不能超过 50 MB，可以减少文件或使用视频直链。');
    // 先检查整组文件，避免某个文件不支持时只插入了一部分。
    const prepared = selected.map((file) => {
      const path = mediaPath(file.name, randomId(), today());
      const url = `/${path.slice('public/'.length)}`;
      return { file, path, url, markdown: mediaMarkdown(file.name, url) };
    });
    for (const asset of prepared) {
      asset.preview = URL.createObjectURL(asset.file);
      assets.push(asset);
    }
    insert(prepared.map((asset) => asset.markdown).join('\n\n'));
    renderAssets();
    status(`已插入 ${prepared.length} 个文件。现在可以预览、下载草稿或发布。`);
  } catch (error) { status(errorMessage(error)); }
  finally { mediaPending = false; byId('files').value = ''; }
}

function updateExistingList() {
  const select = byId('existing');
  select.replaceChildren(new Option('选择一份内容', ''));
  byId('messages').replaceChildren();
  for (const path of [...snapshot.entries.keys()].filter(contentKind).sort()) {
    const kind = contentKind(path);
    select.add(new Option(`${kind === 'article' ? '文章' : kind === 'reply' ? '回复' : '留言 / 提问'} · ${path.split('/').pop()}`, path));
    if (kind === 'message') byId('messages').append(new Option(path.split('/').pop().slice(0, -3)));
  }
}

byId('connect').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  byId('connection-status').textContent = '正在连接你的博客仓库…';
  try {
    const client = new GitHubPublisher({ repository: root.dataset.repository, branch: root.dataset.branch, token: byId('token').value });
    const name = await client.connect();
    const current = await client.snapshot();
    publisher = client;
    snapshot = current;
    byId('token').value = '';
    byId('disconnect').hidden = false;
    byId('connection-status').textContent = `已连接 ${name}，可以载入内容或发布到博客。`;
    updateExistingList();
  } catch (error) {
    publisher = null;
    snapshot = null;
    byId('connection-status').textContent = errorMessage(error);
  } finally { setBusy(false); }
});

byId('disconnect').addEventListener('click', () => {
  if (busy) return;
  publisher = null;
  snapshot = null;
  byId('token').value = '';
  byId('disconnect').hidden = true;
  byId('connection-status').textContent = '已断开连接，编辑内容仍保留在本页。';
  byId('existing').replaceChildren(new Option('连接仓库后可以载入已发布的内容', ''));
  setBusy(false);
});

byId('load').addEventListener('click', async () => {
  const path = byId('existing').value;
  if (!publisher || !path || busy || (dirty && !confirm('载入内容会替换当前编辑。需要保留时，请先下载完整草稿。继续载入吗？'))) return;
  setBusy(true);
  try {
    const sha = snapshot.entries.get(path);
    const { metadata, body: text } = parseDocument(base64ToText(await publisher.read(sha)));
    const kind = contentKind(path);
    const category = kind === 'article' ? getPostColumn(metadata.category).aliases[0] : '';
    releaseAssets();
    editPath = path;
    loadedSha = sha;
    originalMetadata = metadata;
    byId('type').value = kind === 'message' ? (metadata.kind || 'message') : kind;
    byId('name').value = path.split('/').pop().slice(0, -3);
    byId('title').value = metadata.title || '';
    byId('date').value = String(metadata.pubDate || metadata.date || today()).slice(0, 10);
    if (kind === 'article') byId('category').value = category;
    byId('description').value = metadata.description || '';
    byId('author').value = metadata.author || root.dataset.author;
    byId('source').value = metadata.source || '';
    byId('message').value = metadata.message || '';
    byId('draft').checked = Boolean(metadata.draft);
    body.value = text;
    dirty = false;
    status('已载入。可以修改正文、插入图片或视频，再预览发布。');
    void preview();
  } catch (error) { status(errorMessage(error)); }
  finally { setBusy(false); }
});

async function prepareDocument() {
  const document = buildDocument(fields(), originalMetadata);
  await renderMarkdown(document.body, byId('type').value);
  return document;
}

byId('download').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    const document = await prepareDocument();
    const attachments = [];
    for (const asset of activeAssets(document.source)) attachments.push({ path: asset.path, bytes: new Uint8Array(await asset.file.arrayBuffer()) });
    const archive = createDraftArchive(document, attachments);
    const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${byId('name').value}-draft.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status('完整草稿已生成。将压缩包解压到博客文件夹，确认内容后即可提交并推送。');
  } catch (error) { status(errorMessage(error)); }
  finally { setBusy(false); }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !publisher) return;
  setBusy(true);
  try {
    const document = await prepareDocument();
    if (document.metadata.message) {
      const parentPath = `src/content/guestbook/${document.metadata.message}.md`;
      const sha = snapshot.entries.get(parentPath);
      if (!sha) throw new Error('仓库里还没有这条留言，请先发布留言，再发布回复。');
      const parent = parseDocument(base64ToText(await publisher.read(sha)));
      if (document.metadata.date < parent.metadata.date) throw new Error('回复日期不能早于对应留言的日期。');
    }
    planned = { document, assets: activeAssets(document.source).filter((asset) => !asset.published) };
    byId('publish-summary').textContent = `${editPath ? '更新' : '新增'}「${document.metadata.title || '博主回复'}」，附带 ${planned.assets.length} 个媒体文件。${document.metadata.draft ? '这份内容设为草稿，暂不出现在公开列表中。' : ''}`;
    byId('publish-dialog').showModal();
  } catch (error) { status(errorMessage(error)); }
  finally { setBusy(false); }
});

byId('confirm-publish').addEventListener('click', async () => {
  if (!publisher || !planned || busy) return;
  byId('publish-dialog').close();
  setBusy(true);
  status('正在准备发布…');
  try {
    const uploads = [];
    for (const asset of planned.assets) uploads.push({ path: asset.path, bytes: new Uint8Array(await asset.file.arrayBuffer()) });
    const saved = await publisher.publish({ snapshot, document: planned.document, assets: uploads, existing: Boolean(editPath), expectedSha: loadedSha, onProgress: status });
    editPath = planned.document.path;
    originalMetadata = planned.document.metadata;
    loadedSha = saved.documentSha;
    for (const asset of planned.assets) asset.published = true;
    dirty = false;
    byId('actions-link').hidden = false;
    status('已保存到博客仓库，网站正在自动更新。可以通过下方链接查看发布进度。');
    // 同步最新版本，后续编辑继续保护并发更新。
    try {
      snapshot = await publisher.snapshot();
      updateExistingList();
    } catch {
      publisher = null;
      status('已保存到博客仓库，网站正在更新。暂时未能重新载入仓库，再次编辑前请重新连接。');
    }
  } catch (error) { status(errorMessage(error)); }
  finally { planned = null; setBusy(false); }
});

byId('new').addEventListener('click', newDocument);
byId('files').addEventListener('change', () => void addFiles(byId('files').files));
body.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
body.addEventListener('drop', (event) => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  void addFiles(event.dataTransfer.files);
});
body.addEventListener('paste', (event) => {
  if (!event.clipboardData.files.length) return;
  event.preventDefault();
  void addFiles(event.clipboardData.files);
});
form.addEventListener('input', () => {
  dirty = true;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => void preview(), 200);
});
byId('type').addEventListener('change', () => {
  if (!editPath) byId('source').value = byId('type').value === 'question' ? '其他渠道' : '博主自留';
  showFields();
  void preview();
});
byId('insert-url').addEventListener('click', () => byId('url-dialog').showModal());
byId('url-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    insert(mediaMarkdown(byId('url-label').value, byId('url-value').value.trim()));
    byId('url-dialog').close();
    byId('url-form').reset();
  } catch (error) { status(errorMessage(error)); byId('url-dialog').close(); }
});
for (const button of root.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
window.addEventListener('beforeunload', (event) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
newDocument();
