export function initImageViewer(document) {
  const dialog = document.getElementById('image-viewer');
  const content = document.getElementById('main');
  if (!dialog || !content || !dialog.showModal || dialog.dataset.ready) return;
  dialog.dataset.ready = 'true';
  const photo = dialog.querySelector('.image-viewer-photo');
  const caption = dialog.querySelector('.image-viewer-caption');
  let trigger;

  function enhance(node) {
    const images = [...(node.matches?.('.prose img') ? [node] : []), ...(node.querySelectorAll?.('.prose img') || [])];
    for (const image of images) {
      // 图片已有链接时继续使用作者指定的去向。
      if (image.closest('a, button, summary, [role="button"]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'image-zoom';
      button.setAttribute('aria-label', image.alt ? `放大图片：${image.alt}` : '放大图片');
      button.setAttribute('aria-haspopup', 'dialog');
      button.title = '点击放大图片';
      image.replaceWith(button);
      button.append(image);
    }
  }
  enhance(content);
  const observer = new document.defaultView.MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) enhance(node);
  });
  observer.observe(content, { childList: true, subtree: true });

  content.addEventListener('click', (event) => {
    const button = event.target.closest?.('.image-zoom');
    const image = button?.querySelector('img');
    if (!image || dialog.open) return;
    trigger = button;
    photo.src = image.currentSrc || image.src;
    photo.alt = image.alt;
    caption.textContent = image.alt;
    dialog.showModal();
    document.documentElement.classList.add('image-viewer-open');
  });
  dialog.querySelector('.image-viewer-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('image-viewer-open');
    photo.removeAttribute('src');
    caption.textContent = '';
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  });
}
