import { contentKind, bytesToBase64 } from './studio-content.mjs';
import { MAX_MEDIA_BYTES, MAX_TOTAL_MEDIA_BYTES } from './media.mjs';

export class GitHubPublisher {
  #token;
  #fetch;
  #repo;
  #branch;
  constructor({ repository, branch, token, fetchImpl = fetch }) {
    const match = repository.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/);
    if (!match || !branch || !token.trim()) throw new Error('请先填写 GitHub 发布凭证。');
    this.#repo = `/repos/${match[1]}/${match[2]}`;
    this.#branch = encodeURIComponent(branch);
    this.#token = token.trim();
    this.#fetch = fetchImpl;
  }

  async #request(path, method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await this.#fetch(`https://api.github.com${path}`, {
        method,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.#token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('GitHub 凭证无效或已过期，请重新连接。');
        if (response.status === 403 || response.status === 404) throw new Error('无法访问或写入仓库，请检查凭证选择的仓库，以及 Contents（内容）的读写权限。');
        if (response.status === 409 || response.status === 422) throw new Error('仓库已有更新或不允许直接发布。你的编辑仍在，请下载草稿，重新载入仓库后再试。');
        throw new Error(`GitHub 暂时无法完成请求（${response.status}），你的编辑仍在，请稍后重试。`);
      }
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError' || error instanceof TypeError) throw new Error('连接 GitHub 超时或网络不可用，编辑仍保留在本页，请稍后再试。');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async connect() {
    const [user, repo] = await Promise.all([this.#request('/user'), this.#request(this.#repo)]);
    if (!repo.permissions?.push) throw new Error('当前账号没有这个博客仓库的发布权限。');
    return user.login;
  }

  async snapshot() {
    const ref = await this.#request(`${this.#repo}/git/ref/heads/${this.#branch}`);
    const commit = await this.#request(`${this.#repo}/git/commits/${ref.object.sha}`);
    const tree = await this.#request(`${this.#repo}/git/trees/${commit.tree.sha}?recursive=1`);
    if (tree.truncated) throw new Error('仓库文件过多，暂时无法完整载入。请使用本地方式编辑发布。');
    return { head: ref.object.sha, tree: commit.tree.sha, entries: new Map(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.sha])) };
  }

  async read(sha) {
    const blob = await this.#request(`${this.#repo}/git/blobs/${encodeURIComponent(sha)}`);
    if (blob.encoding !== 'base64') throw new Error('这份文件暂时无法在网页中读取。');
    return blob.content;
  }

  async publish({ snapshot, document, assets = [], existing = false, expectedSha, onProgress = () => {} }) {
    if (!contentKind(document.path)) throw new Error('只能发布文章、留言和回复文件。');
    if (snapshot.entries.has(document.path) !== existing) throw new Error('文件名已存在或原文件已变化，请重新载入后再试。');
    if (existing && snapshot.entries.get(document.path) !== expectedSha) throw new Error('这份内容已被其他提交修改，请先下载草稿，再重新载入，避免覆盖更新。');
    if (new Set(assets.map((asset) => asset.path)).size !== assets.length) throw new Error('媒体文件名重复，请重新选择文件。');
    if (assets.some((asset) => !asset.bytes?.length || asset.bytes.length > MAX_MEDIA_BYTES) || assets.reduce((sum, asset) => sum + asset.bytes.length, 0) > MAX_TOTAL_MEDIA_BYTES) throw new Error('媒体文件超过限制：单个 20 MB，总计 50 MB。');
    if (assets.some((asset) => !/^public\/media\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.(png|jpg|jpeg|gif|webp|avif|mp4|webm|ogv)$/.test(asset.path) || snapshot.entries.has(asset.path))) throw new Error('媒体文件名无效或已存在，请重新选择文件。');
    const current = await this.#request(`${this.#repo}/git/ref/heads/${this.#branch}`);
    if (current.object.sha !== snapshot.head) throw new Error('仓库已有新提交。你的编辑仍在，请先下载草稿，再重新载入仓库。');
    const files = [];
    for (const [index, asset] of assets.entries()) {
      onProgress(`正在上传第 ${index + 1} / ${assets.length} 个媒体文件…`);
      const blob = await this.#request(`${this.#repo}/git/blobs`, 'POST', { content: bytesToBase64(asset.bytes), encoding: 'base64' });
      files.push({ path: asset.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    onProgress('正在保存正文…');
    const text = await this.#request(`${this.#repo}/git/blobs`, 'POST', { content: document.source, encoding: 'utf-8' });
    files.push({ path: document.path, mode: '100644', type: 'blob', sha: text.sha });
    const tree = await this.#request(`${this.#repo}/git/trees`, 'POST', { base_tree: snapshot.tree, tree: files });
    const commit = await this.#request(`${this.#repo}/git/commits`, 'POST', { message: `${existing ? '更新' : '发布'}：${document.metadata.title || '博主回复'}`, tree: tree.sha, parents: [snapshot.head] });
    // 正文和附件一次更新分支；若有人同时提交，拒绝覆盖对方的更新。
    await this.#request(`${this.#repo}/git/refs/heads/${this.#branch}`, 'PATCH', { sha: commit.sha, force: false });
    return { sha: commit.sha, documentSha: text.sha };
  }
}
