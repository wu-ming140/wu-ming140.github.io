const instances = new WeakMap();
const storageKey = 'wuming-home-motion';
const revealSelector = '.section-head, .column-card, .project-card, .content-link, .post-row, .message-card, .owner-reply, .home-quote';
const cardSelector = '.column-card, .project-card, .content-link, .post-row, .message-card';

export function initHomeMotion(document) {
  const root = document.querySelector('[data-site-motion], [data-home-motion]');
  if (!root) return;
  if (instances.has(root)) return instances.get(root);
  const window = document.defaultView;
  const button = root.querySelector('[data-motion-toggle]');
  const label = root.querySelector('[data-motion-label]');
  const status = root.querySelector('[data-motion-status]');
  const scene = root.querySelector('.scene-system');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const listeners = [];
  let paused = false;
  let observer;
  let frame;
  let currentCard;
  let pendingPointer;
  let destroyed = false;
  try { paused = window.localStorage.getItem(storageKey) === 'paused'; } catch { /* 页面仍可在不允许存储时使用。 */ }
  const targets = [...root.querySelectorAll(revealSelector)];
  const revealed = new WeakSet();
  function listen(target, event, callback, options) {
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  }
  function reveal(node) { node.removeAttribute('data-reveal-pending'); revealed.add(node); }
  function clearCard() {
    if (!currentCard) return;
    currentCard.removeAttribute('data-pointer-card');
    for (const name of ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y']) currentCard.style.removeProperty(name);
    currentCard = null;
  }
  function clearPointer() {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    pendingPointer = null;
    clearCard();
    scene?.style.removeProperty('--scene-x');
    scene?.style.removeProperty('--scene-y');
  }
  function active() { return !destroyed && !paused && !reduced?.matches && document.visibilityState !== 'hidden'; }
  function sync() {
    observer?.disconnect();
    observer = undefined;
    clearPointer();
    const enabled = !paused && !reduced?.matches;
    root.dataset.motion = enabled ? 'running' : 'paused';
    root.dataset.motionActive = String(active());
    button.hidden = false;
    button.disabled = Boolean(reduced?.matches);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', reduced?.matches ? '已跟随系统减少动态' : paused ? '开启页面动态效果' : '暂停页面动态效果');
    button.title = reduced?.matches ? '系统开启了减少动态，当前显示静态效果' : '控制全站动效，选择会保存在当前浏览器';
    label.textContent = reduced?.matches ? '已减少动态' : paused ? '开启动效' : '暂停动效';
    if (status) status.textContent = reduced?.matches ? '跟随系统 · 减少动态' : paused ? '动效已暂停' : '动效运行中';
    if (!enabled || !window.IntersectionObserver) { targets.forEach(reveal); return; }
    try {
      observer = new window.IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) { reveal(entry.target); observer?.unobserve(entry.target); }
      }, { threshold: 0, rootMargin: '0px 0px -28px 0px' });
      targets.forEach((node, index) => {
        node.dataset.homeReveal = '';
        if (revealed.has(node) || node.getBoundingClientRect().top < window.innerHeight - 28) { reveal(node); return; }
        node.dataset.revealPending = '';
        node.style.setProperty('--reveal-delay', `${(index % 3) * 55}ms`);
        observer.observe(node);
      });
    } catch { observer?.disconnect(); targets.forEach(reveal); }
  }
  listen(button, 'click', () => {
    if (reduced?.matches) return;
    paused = !paused;
    try { window.localStorage.setItem(storageKey, paused ? 'paused' : 'running'); } catch { /* 当前页面的开关仍然有效。 */ }
    sync();
  });
  listen(root, 'pointermove', (event) => {
    if (!active() || !pointer?.matches || event.pointerType === 'touch') return;
    pendingPointer = { x: event.clientX, y: event.clientY, target: event.target };
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      if (!pendingPointer || !active()) return;
      const { x, y, target } = pendingPointer;
      const card = target.closest?.(cardSelector);
      if (card !== currentCard) { clearCard(); currentCard = card; }
      if (card) {
        const rect = card.getBoundingClientRect();
        const dx = Math.max(-.5, Math.min(.5, (x - rect.left) / Math.max(1, rect.width) - .5));
        const dy = Math.max(-.5, Math.min(.5, (y - rect.top) / Math.max(1, rect.height) - .5));
        card.dataset.pointerCard = '';
        card.style.setProperty('--pointer-x', `${x - rect.left}px`);
        card.style.setProperty('--pointer-y', `${y - rect.top}px`);
        card.style.setProperty('--tilt-x', `${(-dy * 5).toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${(dx * 5).toFixed(2)}deg`);
      }
      if (scene && target.closest?.('.hero-grid')) {
        scene.style.setProperty('--scene-x', `${((x / Math.max(1, window.innerWidth) - .5) * 15).toFixed(2)}px`);
        scene.style.setProperty('--scene-y', `${((y / Math.max(1, window.innerHeight) - .5) * 12).toFixed(2)}px`);
      } else { scene?.style.removeProperty('--scene-x'); scene?.style.removeProperty('--scene-y'); }
    });
  }, { passive: true });
  listen(root, 'pointerleave', clearPointer);
  listen(window, 'blur', clearPointer);
  listen(window, 'scroll', clearPointer, { passive: true });
  listen(root, 'focusin', (event) => {
    const target = event.target.closest?.('[data-reveal-pending]');
    if (target) { reveal(target); observer?.unobserve(target); }
  });
  listen(document, 'visibilitychange', () => { root.dataset.motionActive = String(active()); if (!active()) clearPointer(); });
  if (reduced?.addEventListener) listen(reduced, 'change', sync);
  if (pointer?.addEventListener) listen(pointer, 'change', clearPointer);
  listen(window, 'pagehide', clearPointer);
  sync();
  const controller = {
    destroy() {
      destroyed = true;
      observer?.disconnect();
      clearPointer();
      listeners.forEach((remove) => remove());
      targets.forEach((node) => { reveal(node); node.removeAttribute('data-home-reveal'); node.style.removeProperty('--reveal-delay'); });
      delete root.dataset.motion;
      delete root.dataset.motionActive;
      button.hidden = true;
      instances.delete(root);
    },
  };
  instances.set(root, controller);
  return controller;
}
