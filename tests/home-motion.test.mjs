import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { initHomeMotion } from '../src/lib/home-motion.mjs';

function page({ reduced = false, fine = true, stored, observer = true, site = false } = {}) {
  const dom = new JSDOM('<main data-home-motion><div class="hero-grid"><div class="scene-system"></div></div><button data-motion-toggle hidden><span data-motion-label></span></button><a class="column-card" href="/posts/columns/life/">生活</a><article class="post-row"><a href="/posts/hello/">文章</a></article></main>', { url: 'https://blog.example/' });
  const { window } = dom;
  const document = window.document;
  document.querySelector('button').insertAdjacentHTML('beforebegin', '<span data-motion-status role="status"></span>');
  if (site) {
    document.querySelector('main').removeAttribute('data-home-motion');
    document.body.dataset.siteMotion = '';
  }
  const media = new Map();
  window.matchMedia = (query) => {
    const item = new window.EventTarget();
    item.matches = query.includes('reduced-motion') ? reduced : fine;
    media.set(query, item);
    return item;
  };
  const observers = [];
  if (observer) window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); observers.push(this); }
    observe(node) { this.nodes.add(node); }
    unobserve(node) { this.nodes.delete(node); }
    disconnect() { this.nodes.clear(); }
  };
  const pendingFrames = new Map();
  let next = 0;
  window.requestAnimationFrame = (callback) => { const id = next++; pendingFrames.set(id, callback); return id; };
  window.cancelAnimationFrame = (id) => pendingFrames.delete(id);
  if (stored) window.localStorage.setItem('wuming-home-motion', stored);
  const root = site ? document.body : document.querySelector('main');
  const card = document.querySelector('.column-card');
  const article = document.querySelector('.post-row');
  card.getBoundingClientRect = () => ({ top: 20, left: 0, width: 200, height: 200 });
  article.getBoundingClientRect = () => ({ top: 2000, left: 0, width: 600, height: 200 });
  function move(x, y, pointerType = 'mouse') {
    const event = new window.Event('pointermove', { bubbles: true });
    Object.assign(event, { clientX: x, clientY: y, pointerType });
    card.dispatchEvent(event);
  }
  function flush() { const callbacks = [...pendingFrames.values()]; pendingFrames.clear(); callbacks.forEach((callback) => callback()); }
  return { dom, window, document, root, card, article, media, observers, pendingFrames, move, flush, button: document.querySelector('button'), label: document.querySelector('[data-motion-label]') };
}

test('home motion can be paused and remembered, keeps all content readable, and initializes only once', () => {
  const p = page();
  const controller = initHomeMotion(p.document);
  assert.equal(initHomeMotion(p.document), controller);
  assert.equal(p.button.hidden, false);
  assert.equal(p.root.dataset.motion, 'running');
  assert.ok(p.article.hasAttribute('data-reveal-pending'));
  p.button.click();
  assert.equal(p.root.dataset.motion, 'paused');
  assert.equal(p.button.getAttribute('aria-pressed'), 'false');
  assert.equal(p.label.textContent, '开启动效');
  assert.equal(p.button.getAttribute('aria-label'), '开启页面动态效果');
  assert.equal(p.document.querySelector('[data-motion-status]').textContent, '动效已暂停');
  assert.equal(p.article.hasAttribute('data-reveal-pending'), false);
  assert.equal(p.window.localStorage.getItem('wuming-home-motion'), 'paused');
  const next = page({ stored: p.window.localStorage.getItem('wuming-home-motion') });
  initHomeMotion(next.document);
  assert.equal(next.root.dataset.motion, 'paused');
  p.button.click();
  assert.equal(p.root.dataset.motion, 'running');
  controller.destroy();
  assert.equal(p.article.hasAttribute('data-reveal-pending'), false);
  assert.equal(p.button.hidden, true);
  p.dom.window.close(); next.dom.window.close();
});

test('system motion preferences take effect immediately without changing the saved user preference', () => {
  const p = page({ reduced: true });
  initHomeMotion(p.document);
  assert.equal(p.root.dataset.motion, 'paused');
  assert.equal(p.button.disabled, true);
  assert.equal(p.label.textContent, '已减少动态');
  assert.equal(p.document.querySelector('[data-motion-status]').textContent, '跟随系统 · 减少动态');
  assert.equal(p.article.hasAttribute('data-reveal-pending'), false);
  assert.equal(p.window.localStorage.getItem('wuming-home-motion'), null);
  const preference = p.media.get('(prefers-reduced-motion: reduce)');
  preference.matches = false;
  preference.dispatchEvent(new p.window.Event('change'));
  assert.equal(p.root.dataset.motion, 'running');
  assert.equal(p.button.disabled, false);
  p.dom.window.close();
});

test('scroll reveals and keyboard focus expose content; older browsers and blocked storage retain usable links', () => {
  const p = page();
  initHomeMotion(p.document);
  p.observers[0].callback([{ target: p.article, isIntersecting: true }]);
  assert.equal(p.article.hasAttribute('data-reveal-pending'), false);
  p.article.setAttribute('data-reveal-pending', '');
  p.article.querySelector('a').dispatchEvent(new p.window.FocusEvent('focusin', { bubbles: true }));
  assert.equal(p.article.hasAttribute('data-reveal-pending'), false);
  const fallback = page({ observer: false });
  Object.defineProperty(fallback.window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
  initHomeMotion(fallback.document);
  assert.equal(fallback.article.hasAttribute('data-reveal-pending'), false);
  fallback.button.click();
  assert.equal(fallback.root.dataset.motion, 'paused');
  assert.equal(fallback.article.querySelector('a').getAttribute('href'), '/posts/hello/');
  p.dom.window.close(); fallback.dom.window.close();
});

test('pointer effects are limited to one update per frame and reset when scrolling, paused, hidden or touched', () => {
  const p = page();
  initHomeMotion(p.document);
  p.move(0, 20); p.move(200, 220);
  assert.equal(p.pendingFrames.size, 1);
  p.flush();
  assert.equal(p.card.style.getPropertyValue('--pointer-x'), '200px');
  assert.equal(p.card.style.getPropertyValue('--tilt-y'), '2.50deg');
  p.window.dispatchEvent(new p.window.Event('scroll'));
  assert.equal(p.card.hasAttribute('data-pointer-card'), false);
  p.move(100, 100); p.button.click();
  assert.equal(p.pendingFrames.size, 0);
  p.move(100, 100);
  assert.equal(p.pendingFrames.size, 0);
  p.button.click();
  p.move(100, 100, 'touch');
  assert.equal(p.pendingFrames.size, 0);
  Object.defineProperty(p.document, 'visibilityState', { value: 'hidden', configurable: true });
  p.document.dispatchEvent(new p.window.Event('visibilitychange'));
  assert.equal(p.root.dataset.motionActive, 'false');
  p.move(100, 100);
  assert.equal(p.pendingFrames.size, 0);
  p.dom.window.close();
  const touch = page({ fine: false });
  initHomeMotion(touch.document); touch.move(100, 100);
  assert.equal(touch.pendingFrames.size, 0);
  touch.dom.window.close();
});

test('the shared layout enables motion without the homepage and exposes the current state', () => {
  const p = page({ site: true });
  const controller = initHomeMotion(p.document);
  assert.equal(p.document.querySelector('[data-home-motion]'), null);
  assert.equal(p.root.dataset.motion, 'running');
  assert.equal(p.root.dataset.motionActive, 'true');
  assert.equal(p.document.querySelector('[data-motion-status]').textContent, '动效运行中');
  assert.equal(p.button.getAttribute('aria-label'), '暂停页面动态效果');
  p.button.click();
  assert.equal(p.root.dataset.motionActive, 'false');
  p.button.click();
  assert.equal(p.root.dataset.motionActive, 'true');
  controller.destroy();
  p.dom.window.close();
});

test('resuming motion never hides cards already revealed by scrolling or by pausing', () => {
  const p = page({ site: true });
  initHomeMotion(p.document);
  assert.equal(p.article.hasAttribute('data-reveal-pending'), true);
  p.observers[0].callback([{ target: p.article, isIntersecting: true }]);
  p.button.click();
  p.button.click();
  assert.equal(p.article.hasAttribute('data-reveal-pending'), false);
  assert.equal(p.observers.at(-1).nodes.has(p.article), false);
  p.dom.window.close();
});

test('a saved pause keeps titles readable while continuous animations retain their position', () => {
  const p = page({ site: true, stored: 'paused' });
  p.root.className = 'site-motion';
  const style = p.document.createElement('style');
  style.textContent = readFileSync(new URL('../src/styles/home-motion.css', import.meta.url), 'utf8');
  p.document.head.append(style);
  p.root.insertAdjacentHTML('beforeend', '<div class="ambient-light-one"></div><h1 class="hero-letter">标题</h1>');
  initHomeMotion(p.document);
  const title = p.document.querySelector('.hero-letter');
  const ambient = p.document.querySelector('.ambient-light-one');
  const pausedAnimation = p.window.getComputedStyle(ambient).animation;
  assert.equal(p.window.getComputedStyle(title).animation, '');
  assert.equal(p.window.getComputedStyle(ambient).animationPlayState, 'paused');
  p.button.click();
  assert.match(p.window.getComputedStyle(title).animation, /home-letter-in/);
  assert.equal(p.window.getComputedStyle(ambient).animation, pausedAnimation);
  p.button.click();
  assert.equal(p.window.getComputedStyle(title).animation, '');
  p.dom.window.close();
});
