// 不蒜子公开脚本所使用的 JSONP 接口；一次请求同时返回全站和当前页浏览量。
// https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js
const initialized = new WeakSet();

export function initViewCounts(doc = document, win = window) {
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

  const callback = `BusuanziCallback_${win.crypto.randomUUID().replaceAll('-', '')}`;
  const script = doc.createElement('script');
  let finished = false;
  let timeout;

  function finish(data) {
    if (finished) return;
    finished = true;
    win.clearTimeout(timeout);
    script.remove();
    // 保留空回调，以便已经开始执行的迟到响应不会抛错或覆盖超时状态。
    win[callback] = () => {};
    for (const counter of counters) {
      const value = data?.[counter.dataset.viewCount];
      const valid = Number.isSafeInteger(value) && value >= 0;
      counter.querySelector('[data-count-value]').textContent = valid
        ? `${value.toLocaleString('zh-CN')} 次` : '暂不可用';
      counter.title = valid ? '浏览量由不蒜子提供，按页面访问次数统计' : '浏览量服务暂不可用，请稍后再试';
    }
  }

  win[callback] = finish;
  script.async = true;
  // 与官方脚本相同，仅此请求携带页面路径，用来区分文章；不修改全站策略。
  script.referrerPolicy = 'no-referrer-when-downgrade';
  script.src = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=${callback}`;
  script.onerror = () => finish();
  script.onload = () => { if (!finished) finish(); };
  timeout = win.setTimeout(() => finish(), 10000);
  doc.head.appendChild(script);
}
