// 与 Vercount 公开脚本使用同一个 API；一次请求同时返回全站和当前页浏览量。
// https://events.vercount.one/js
const initialized = new WeakSet();

export async function initViewCounts(doc = document, win = window) {
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => initViewCounts(doc, win), { once: true });
    return;
  }
  const counters = [...doc.querySelectorAll('[data-view-count]')];
  if (!counters.length || initialized.has(doc)) return;
  initialized.add(doc);

  function showState(text, title) {
    for (const counter of counters) {
      counter.querySelector('[data-count-value]').textContent = text;
      counter.title = title;
    }
  }

  // 使用构建时的正式站点地址，防止 localhost、预览站和镜像污染正式统计。
  if (win.location.origin !== counters[0].dataset.countOrigin) {
    showState('预览不计数', '正式网站发布后显示浏览量，本地与其他预览地址不计数');
    return;
  }

  showState('加载中…', '正在获取浏览量');
  let expired = false;
  let timeout;
  try {
    const controller = new win.AbortController();
    timeout = win.setTimeout(() => {
      expired = true;
      controller.abort();
      showState('暂不可用', '浏览量加载超时，请稍后刷新重试');
    }, 10000);
    // 明确传入正式页面地址，避免跨站 Referrer 策略丢失文章路径。
    // 忽略查询参数和锚点，确保同一篇文章的分享链接共用计数。
    const url = new URL(win.location.pathname, counters[0].dataset.countOrigin);
    const response = await win.fetch('https://events.vercount.one/api/v2/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.href, isNewUv: false }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('View count request failed');
    const result = await response.json();
    if (expired) return;
    if (result?.status !== 'success' || !result.data) throw new Error('Invalid view count response');
    for (const counter of counters) {
      const value = result.data[counter.dataset.viewCount];
      const valid = Number.isSafeInteger(value) && value >= 0;
      counter.querySelector('[data-count-value]').textContent = valid
        ? `${value.toLocaleString('zh-CN')} 次` : '暂不可用';
      counter.title = valid ? '浏览量由 Vercount 提供，按页面访问次数统计' : '浏览量服务暂不可用，请稍后再试';
    }
  } catch {
    if (!expired) showState('暂不可用', '浏览量服务暂不可用，请稍后刷新重试');
  } finally {
    win.clearTimeout(timeout);
  }
}
