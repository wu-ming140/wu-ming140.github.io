export function groupMonths(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const items = groups.get(month) || [];
    items.push(entry);
    groups.set(month, items);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => ({ month, items: items.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)) }));
}
export function initBrowseLists(document) {
  for (const root of document.querySelectorAll('[data-browse-list]')) {
    const controls = root.querySelector('[data-browse-controls]');
    const select = controls.querySelector('select');
    const list = root.querySelector('[data-browse-items]');
    const entries = [...list.children].map((node, index) => ({ node, date: node.dataset.entryDate || '', id: node.dataset.entryId || String(index) }));
    const window = document.defaultView;
    const preferred = new URL(window.location.href).searchParams.get('sort');
    if (['newest', 'oldest', 'months'].includes(preferred)) select.value = preferred;
    controls.hidden = false;
    function updateGroups() {
      for (const group of list.querySelectorAll('[data-browse-month]')) {
        const count = [...group.querySelectorAll('[data-entry-date]')].filter((node) => !node.hidden).length;
        group.hidden = count === 0;
        group.querySelector('h3').textContent = `${group.dataset.browseMonth.replace('-', ' 年 ')} 月 · ${count} 份记录`;
      }
    }
    function render() {
      list.replaceChildren();
      list.classList.toggle('project-grid', root.dataset.layout === 'projects' && select.value !== 'months');
      if (select.value === 'months') {
        for (const { month, items } of groupMonths(entries)) {
          const section = document.createElement('section');
          section.className = 'browse-month';
          section.dataset.browseMonth = month;
          const heading = document.createElement('h3');
          const content = document.createElement('div');
          if (root.dataset.layout === 'projects') content.className = 'project-grid';
          content.append(...items.map((entry) => entry.node));
          section.append(heading, content);
          list.append(section);
        }
        updateGroups();
      } else {
        const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
        if (select.value === 'newest') ordered.reverse();
        list.append(...ordered.map((entry) => entry.node));
      }
    }
    select.addEventListener('change', () => {
      render();
      const url = new URL(window.location.href);
      if (select.value === 'newest') url.searchParams.delete('sort'); else url.searchParams.set('sort', select.value);
      window.history.replaceState(null, '', url);
    });
    root.addEventListener('browse:filter', updateGroups);
    render();
  }
}
