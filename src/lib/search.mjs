export function normalizeQuery(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function searchEntries(entries, query, type = '') {
  const terms = [...new Set(normalizeQuery(query).split(' ').filter(Boolean))].slice(0, 12);
  if (!terms.length) return [];
  return entries.filter((entry) => !type || entry.type === type).map((entry) => {
    const title = normalizeQuery(entry.title);
    const labels = normalizeQuery(`${entry.category} ${(entry.tags || []).join(' ')}`);
    const description = normalizeQuery(entry.description);
    const body = normalizeQuery(entry.body);
    const all = `${title} ${labels} ${description} ${body}`;
    if (!terms.every((term) => all.includes(term))) return null;
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (labels.includes(term) ? 5 : 0) + (description.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0);
    return { ...entry, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
}

export function excerptFor(entry, query, length = 150) {
  const text = entry.body || entry.description || '';
  const normalized = normalizeQuery(text);
  const term = normalizeQuery(query).split(' ').find((word) => word && normalized.includes(word));
  const start = term ? Math.max(0, normalized.indexOf(term) - 35) : 0;
  return `${start ? '…' : ''}${text.slice(start, start + length)}${text.length > start + length ? '…' : ''}`;
}

export function initSearch(document, fetchImpl = globalThis.fetch) {
  const root = document.getElementById('site-search');
  if (!root) return;
  const input = root.querySelector('input');
  const filter = root.querySelector('select');
  const status = root.querySelector('[data-search-status]');
  const results = root.querySelector('[data-search-results]');
  const more = root.querySelector('[data-search-more]');
  let index;
  let pending;
  let version = 0;
  let limit = 20;
  let timer;
  const window = document.defaultView;
  const url = new URL(window.location.href);
  input.value = url.searchParams.get('q') || '';
  filter.value = ['文章', '作品', '留言与问答', '页面'].includes(url.searchParams.get('type')) ? url.searchParams.get('type') : '';

  async function getIndex() {
    if (index) return index;
    if (!pending) pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetchImpl(root.dataset.index, { signal: controller.signal });
        if (!response.ok) throw new Error('搜索索引未能载入');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('搜索索引格式有误');
        index = data;
        return index;
      } finally { clearTimeout(timeout); pending = null; }
    })();
    return pending;
  }
  async function render() {
    const current = ++version;
    const query = input.value.trim().slice(0, 120);
    results.replaceChildren();
    more.hidden = true;
    const next = new URL(window.location.href);
    if (query) next.searchParams.set('q', query); else next.searchParams.delete('q');
    if (filter.value) next.searchParams.set('type', filter.value); else next.searchParams.delete('type');
    window.history.replaceState(null, '', next);
    if (!query) { status.textContent = '输入关键词，找一篇文字或一段回答。'; return; }
    status.textContent = '正在查找…';
    try {
      const entries = await getIndex();
      if (current !== version) return;
      const found = searchEntries(entries, query, filter.value);
      status.textContent = found.length ? `找到 ${found.length} 条结果${found.length > limit ? `，先展示 ${limit} 条` : ''}` : '暂时没有找到，试试更短的关键词或其他内容类型。';
      for (const entry of found.slice(0, limit)) {
        if (typeof entry.url !== 'string' || !/^\/(?!\/)/.test(entry.url) || /[\\\u0000-\u0020]/.test(entry.url)) continue;
        const item = document.createElement('li');
        const meta = document.createElement('p');
        meta.className = 'search-result-meta';
        meta.textContent = `${entry.type} · ${entry.category} · ${entry.date}`;
        const heading = document.createElement('h2');
        const link = document.createElement('a');
        link.href = entry.url;
        link.textContent = entry.title;
        heading.append(link);
        const summary = document.createElement('p');
        summary.textContent = excerptFor(entry, query);
        item.append(meta, heading, summary);
        if (entry.tags?.length) {
          const tags = document.createElement('p');
          tags.className = 'search-result-tags';
          tags.textContent = entry.tags.map((tag) => `# ${tag}`).join('  ');
          item.append(tags);
        }
        results.append(item);
      }
      more.hidden = found.length <= limit;
    } catch {
      if (current === version) status.textContent = '搜索内容暂时未能载入，请检查网络后再点「搜索」重试。';
    }
  }
  root.addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(timer); limit = 20; void render(); });
  input.addEventListener('input', () => {
    version++;
    clearTimeout(timer);
    limit = 20;
    timer = setTimeout(() => void render(), 180);
  });
  filter.addEventListener('change', () => { clearTimeout(timer); limit = 20; void render(); });
  more.addEventListener('click', () => { limit += 20; void render(); });
  void render();
}
