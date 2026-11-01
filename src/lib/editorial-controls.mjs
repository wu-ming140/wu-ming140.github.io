import { availableBoards, boardLabels, normalizePlacements } from './editorial.mjs';

export function createEditorialControls({ document, placementsRoot, collectionsRoot, getContext, onChange }) {
  let placements = {};
  function renderPlacements() {
    const context = getContext();
    placementsRoot.replaceChildren();
    for (const board of availableBoards(context.type, context.column, context.channel)) {
      const row = document.createElement('div');
      row.className = 'studio-placement-row';
      const name = document.createElement('strong');
      name.textContent = boardLabels[board];
      row.append(name);
      for (const [flag, title] of [['pinned', '置顶'], ['featured', '精选']]) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(placements[board]?.[flag]);
        input.disabled = context.busy;
        input.dataset.board = board;
        input.dataset.placement = flag;
        input.addEventListener('change', () => { placements[board] = { ...(placements[board] || {}), [flag]: input.checked }; });
        label.append(input, title);
        row.append(label);
      }
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.textContent = '清除此板块标记';
      clear.disabled = context.busy;
      clear.addEventListener('click', () => { if (getContext().busy) return; delete placements[board]; renderPlacements(); onChange(); });
      row.append(clear);
      placementsRoot.append(row);
    }
  }
  function addCollection(item = { name: '', order: 1 }) {
    const row = document.createElement('div');
    row.className = 'studio-collection-row';
    const nameLabel = document.createElement('label');
    nameLabel.append('合集名称');
    const name = document.createElement('input');
    name.value = item.name;
    name.maxLength = 60;
    name.placeholder = '输入新合集名称，或选择已有合集';
    name.setAttribute('list', 'studio-collection-names');
    name.dataset.collectionName = '';
    nameLabel.append(name);
    const orderLabel = document.createElement('label');
    orderLabel.append('顺序号');
    const order = document.createElement('input');
    order.type = 'number'; order.min = '1'; order.max = '99999'; order.step = '1';
    order.value = String(item.order ?? 1);
    order.dataset.collectionOrder = '';
    orderLabel.append(order);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '移出合集';
    remove.addEventListener('click', () => { if (getContext().busy) return; row.remove(); onChange(); });
    for (const element of [name, order, remove]) element.disabled = getContext().busy;
    row.append(nameLabel, orderLabel, remove);
    collectionsRoot.append(row);
  }
  function set(value = {}) {
    placements = normalizePlacements(value.placements);
    collectionsRoot.replaceChildren();
    for (const item of value.collections?.length ? value.collections : [{ name: '', order: 1 }]) addCollection(item);
    renderPlacements();
  }
  return {
    set, renderPlacements,
    add: () => { if (!getContext().busy) { addCollection(); onChange(); } },
    fields: () => {
      const context = getContext();
      const allowed = availableBoards(context.type, context.column, context.channel);
      return {
        placements: Object.fromEntries(Object.entries(normalizePlacements(placements)).filter(([board]) => allowed.includes(board))),
        collections: [...collectionsRoot.children].map((row) => ({ name: row.querySelector('[data-collection-name]').value, order: row.querySelector('[data-collection-order]').value })),
      };
    },
  };
}

export function renderFindings(document, target, findings) {
  const labels = { error: '需要修改', warning: '建议检查', info: '提示', success: '通过' };
  target.replaceChildren();
  for (const finding of findings) {
    const item = document.createElement('li');
    item.dataset.level = finding.level;
    item.textContent = `${labels[finding.level]} · ${finding.message}`;
    target.append(item);
  }
}
