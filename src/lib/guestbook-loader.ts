import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob, type Loader } from 'astro/loaders';

// 每次同步都重新验证内容，确保最后一条留言删除后不会残留在缓存中。
export function guestbookLoader(directory: string): Loader {
  const base = `./src/content/${directory}/`;
  const delegate = glob({
    base,
    pattern: '*.md',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  });
  return {
    name: `validated-${directory}`,
    async load(context) {
      const directoryPath = fileURLToPath(new URL(base, context.config.root));
      async function sync() {
        context.store.clear();
        const files = await readdir(directoryPath);
        if (!files.some((file) => file.endsWith('.md'))) return;
        await delegate.load({ ...context, watcher: undefined });
        // Astro 的 glob loader 会记录渲染错误但继续运行；留言必须渲染成功才能发布。
        for (const entry of context.store.values()) {
          if (!entry.rendered) throw new Error(`留言或回复渲染失败，请修正上面的 Markdown 错误：${entry.id}`);
        }
      }
      await sync();
      if (context.watcher) {
        context.watcher.add(directoryPath);
        let pending = Promise.resolve();
        const update = (changed: string) => {
          if (dirname(resolve(changed)) !== resolve(directoryPath) || !changed.endsWith('.md')) return;
          pending = pending.then(sync).catch((error) => context.logger.error(String(error)));
        };
        context.watcher.on('add', update);
        context.watcher.on('change', update);
        context.watcher.on('unlink', update);
      }
    },
  };
}
