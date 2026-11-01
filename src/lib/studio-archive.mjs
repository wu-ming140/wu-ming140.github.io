import { zipSync, strToU8 } from 'fflate';
import { contentKind } from './studio-content.mjs';

export function createDraftArchive(document, assets) {
  if (!contentKind(document.path)) throw new Error('草稿文件位置无效。');
  const entries = { [document.path]: strToU8(document.source) };
  for (const asset of assets) {
    if (!/^public\/media\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.[a-z0-9]+$/.test(asset.path)) throw new Error('附件文件位置无效。');
    entries[asset.path] = asset.bytes;
  }
  return zipSync(entries, { level: 0 });
}
