import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initImageViewer } from '../src/lib/image-viewer.mjs';

async function fixture() {
  const component = (await readFile(new URL('../src/components/ImageViewer.astro', import.meta.url), 'utf8')).split('<script>')[0];
  const dom = new JSDOM(`<main id="main"><div class="prose"><p><img src="/media/photo.png" alt="作品截图"></p><a href="/about/"><img src="/media/link.png" alt="跳转图片"></a><video src="/media/demo.mp4" controls></video></div><img id="decoration" src="/brand.svg"></main>${component}`, { url: 'https://blog.example/' });
  const document = dom.window.document;
  const dialog = document.getElementById('image-viewer');
  // jsdom 未实现原生 dialog 的弹出与关闭；保留真实 DOM、事件、焦点和 MutationObserver。
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new dom.window.Event('close')); };
  initImageViewer(document);
  return { dom, document, dialog, photo: dialog.querySelector('img') };
}

test('content images get keyboard-operable buttons; links, videos and decorations retain their behavior', async () => {
  const { dom, document } = await fixture();
  try {
    assert.equal(document.querySelectorAll('.image-zoom').length, 1);
    const button = document.querySelector('.image-zoom');
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.type, 'button');
    assert.equal(button.getAttribute('aria-label'), '放大图片：作品截图');
    assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(document.querySelector('a img').parentElement.tagName, 'A');
    assert.equal(document.querySelector('video').parentElement.className, 'prose');
    assert.equal(document.getElementById('decoration').parentElement.id, 'main');
    initImageViewer(document);
    assert.equal(document.querySelectorAll('.image-zoom').length, 1);
  } finally { dom.window.close(); }
});

test('open uses the selected image and caption; close, Escape cancellation and blank backdrop restore focus', async () => {
  const { dom, document, dialog, photo } = await fixture();
  try {
    const button = document.querySelector('.image-zoom');
    for (const close of [
      () => dialog.querySelector('button').click(),
      () => dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true })),
      () => dialog.click(),
    ]) {
      button.focus();
      button.querySelector('img').click();
      assert.equal(dialog.open, true);
      assert.equal(photo.src, 'https://blog.example/media/photo.png');
      assert.equal(photo.alt, '作品截图');
      assert.equal(dialog.querySelector('figcaption').textContent, '作品截图');
      assert.ok(document.documentElement.classList.contains('image-viewer-open'));
      photo.click();
      assert.equal(dialog.open, true);
      close();
      assert.equal(dialog.open, false);
      assert.equal(photo.hasAttribute('src'), false);
      assert.equal(document.activeElement, button);
      assert.ok(!document.documentElement.classList.contains('image-viewer-open'));
    }
  } finally { dom.window.close(); }
});

test('replaced studio previews gain image controls and use current blob previews', async () => {
  const { dom, document, dialog, photo } = await fixture();
  try {
    const prose = document.querySelector('.prose');
    prose.innerHTML = '<p><img src="blob:https://blog.example/fresh-file" alt="新附件"></p>';
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.equal(prose.querySelectorAll('.image-zoom').length, 1);
    prose.querySelector('.image-zoom').click();
    assert.equal(dialog.open, true);
    assert.equal(photo.src, 'blob:https://blog.example/fresh-file');
    assert.equal(photo.alt, '新附件');
  } finally { dom.window.close(); }
});
