import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkGuestbook from '../src/lib/guestbook-rules.mjs';
import remarkMedia, { mediaMarkdown, mediaPath, mediaType, safeMediaUrl } from '../src/lib/media.mjs';
import { renderMarkdown } from '../src/lib/studio-content.mjs';

test('the actual Astro renderer renders image and video syntax for posts, messages and replies', async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkGuestbook, remarkMedia] });
  for (const directory of ['pages/posts', 'content/guestbook', 'content/replies']) {
    const result = await processor.render('![作品截图](/media/photo.png)\n\n![作品演示](/media/demo.mp4)', { fileURL: new URL(`../src/${directory}/media-test.md`, import.meta.url) });
    assert.match(result.code, /<img[^>]+src="\/media\/photo.png"/);
    assert.match(result.code, /<figure class="media-figure"><video/);
    assert.match(result.code, /src="\/media\/demo.mp4" controls preload="metadata" playsinline/);
    assert.match(result.code, /<figcaption>作品演示<\/figcaption>/);
    assert.doesNotMatch(result.code, /autoplay/);
  }
});

test('video URLs, captions and inline media stay safe while preserving signed URLs', async () => {
  const markdown = mediaMarkdown('视频 [1] "<script>"', 'https://example.com/movie(test).MP4?signature=a&expires=1');
  const html = await renderMarkdown(markdown, 'message');
  assert.match(html, /src="https:\/\/example.com\/movie\(test\).MP4\?signature=a(?:&amp;|&#x26;)expires=1"/);
  assert.match(html, /<figcaption>[^<]*(?:&lt;|&#x3C;)script>/);
  assert.match(html, /aria-label="[^"\n]*&#x22;[^"\n]*"/);
  assert.match(await renderMarkdown('前面 ![演示](/media/a.webm) 后面'), /<p>前面 <video/);
});

test('video support does not permit executable URLs or raw HTML in messages', async () => {
  for (const url of ['javascript:alert(1).mp4', '//evil.example/demo.mp4', 'data:text/html,test.mp4', '/\\evil/demo.mp4']) {
    assert.equal(safeMediaUrl(url), false, url);
    assert.throws(() => mediaMarkdown('视频', url));
  }
  await assert.rejects(renderMarkdown('<iframe src="https://example.com"></iframe>', 'message'), /HTML/);
  await assert.rejects(renderMarkdown('![bad](javascript:alert.mp4)', 'message'), /链接/);
  await assert.rejects(renderMarkdown('[bad](javascript:alert(1))'), /链接/);
  const preview = await renderMarkdown('<script>alert(1)</script>');
  assert.doesNotMatch(preview, /<script/);
});

test('media filenames use supported extensions and cannot escape the media folder', () => {
  assert.equal(mediaPath('../演示视频.MP4', 'abc123', '2026-11-01'), 'public/media/2026-11-01/abc123-media.mp4');
  assert.equal(mediaType('/media/demo.webm?download=1#start'), 'video');
  assert.equal(mediaType('https://example.com/a.png'), 'image');
  for (const name of ['payload.html', 'vector.svg', 'archive.exe', 'clip.mov']) assert.throws(() => mediaPath(name, 'abc', '2026-11-01'));
  assert.throws(() => mediaPath('ok.png', '../escape', '2026-11-01'));
});
