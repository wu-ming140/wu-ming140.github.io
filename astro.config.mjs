import { defineConfig } from 'astro/config';
import remarkGuestbook from './src/lib/guestbook-rules.mjs';
import remarkMedia from './src/lib/media.mjs';
import remarkLineBreaks from './src/lib/line-breaks.mjs';

export default defineConfig({
  // 账号对应的域名。
  site: 'https://wu-ming140.github.io',
  markdown: { remarkPlugins: [remarkGuestbook, remarkLineBreaks, remarkMedia] },
  trailingSlash: 'always',
});
