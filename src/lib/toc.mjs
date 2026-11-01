export function initToc(document) {
  const details = document.querySelector('[data-article-toc]');
  if (!details) return;
  const window = document.defaultView;
  if (window.matchMedia('(max-width: 1050px)').matches) details.open = false;
  const entries = [...details.querySelectorAll('a')].map((link) => ({ link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1))) })).filter((entry) => entry.heading);
  let scheduled = false;
  function update() {
    scheduled = false;
    let current = entries[0];
    for (const entry of entries) if (entry.heading.getBoundingClientRect().top <= 160) current = entry;
    for (const entry of entries) {
      if (entry === current) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}
