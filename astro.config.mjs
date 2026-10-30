import { defineConfig } from 'astro/config';

export default defineConfig({
  // 账号对应的域名。
  site: 'https://wu-ming140.github.io',
  // 目前远程仓库名与账号不同，因此属于带子路径的项目站点。
  base: '/wuming140.github.io',
  trailingSlash: 'always',
});
