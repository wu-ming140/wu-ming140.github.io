import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import config from '../astro.config.mjs';
import { renderMarkdown } from '../src/lib/studio-content.mjs';

function markup(html) { return new JSDOM(`<main>${html}</main>`); }

test('one Enter creates a visible break and a blank line starts a paragraph for every studio content type', async () => {
  for (const type of ['article', 'question', 'message', 'reply']) {
    const dom = markup(await renderMarkdown('第一行\r\n第二行\r\n第三行\r\n\r\n另起一段', type));
    const paragraphs = dom.window.document.querySelectorAll('main > p');
    assert.equal(paragraphs.length, 2, type);
    assert.equal(paragraphs[0].querySelectorAll('br').length, 2, type);
    assert.equal(paragraphs[1].textContent, '另起一段', type);
    dom.window.close();
  }
});

test('actual site Markdown settings preserve the same breaks and text-image-text order as the studio preview', async () => {
  const processor = await createMarkdownProcessor(config.markdown);
  const markdown = '图片前第一行\n图片前第二行\n\n![图中说明](/media/photo.png)\n\n图片后的文字\n还可以继续换行\n\n![演示](/media/demo.mp4)\n\n视频后继续写字';
  for (const [directory, type] of [['pages/posts', 'article'], ['content/guestbook', 'question'], ['content/replies', 'reply']]) {
    const published = await processor.render(markdown, { fileURL: new URL(`../src/${directory}/writing-test.md`, import.meta.url) });
    const actual = markup(published.code);
    const preview = markup(await renderMarkdown(markdown, type));
    for (const dom of [actual, preview]) {
      const main = dom.window.document.querySelector('main');
      assert.equal(main.querySelectorAll('br').length, 2, directory);
      assert.equal(main.querySelectorAll('img').length, 1, directory);
      assert.equal(main.querySelectorAll('video').length, 1, directory);
      assert.deepEqual([...main.children].map((node) => node.tagName), ['P', 'P', 'P', 'FIGURE', 'P']);
      assert.equal(main.querySelector('img').getAttribute('src'), '/media/photo.png');
      assert.equal(main.lastElementChild.textContent, '视频后继续写字');
    }
    actual.window.close(); preview.window.close();
  }
});

test('line breaks retain Markdown formatting, explicit breaks, code indentation and paragraph structure', async () => {
  const markdown = '## 标题\n\n**重点第一行\n重点第二行**\n\n原有两个空格  \n换行\n\n- 第一项\n  继续说明\n- 第二项\n\n> 引用第一行\n> 引用第二行\n\n`行内\n代码`\n\n```text\n第一行\n  第二行\n```';
  const processor = await createMarkdownProcessor(config.markdown);
  const published = await processor.render(markdown, { fileURL: new URL('../src/pages/posts/writing-test.md', import.meta.url) });
  for (const html of [await renderMarkdown(markdown), published.code]) {
    const dom = markup(html);
    const doc = dom.window.document;
    assert.equal(doc.querySelector('h2').textContent, '标题');
    assert.equal(doc.querySelectorAll('strong br').length, 1);
    assert.equal(doc.querySelectorAll('ul > li').length, 2);
    assert.equal(doc.querySelectorAll('li br').length, 1);
    assert.equal(doc.querySelectorAll('blockquote br').length, 1);
    assert.equal(doc.querySelector('pre code').textContent.trimEnd(), '第一行\n  第二行');
    assert.equal(doc.querySelectorAll('code br').length, 0);
    assert.equal([...doc.querySelectorAll('main > p')].find((node) => node.textContent.includes('原有两个空格')).querySelectorAll('br').length, 1);
    dom.window.close();
  }
});
