# 无暝 · 小暝宝基地

使用 Astro 构建的个人博客，包含首页、文章、关于，以及通过 Markdown 与 Pull Request 管理的留言与问答。

## 本地使用

需要 Node.js 22.12+（推荐 Node.js 22 LTS）。

```sh
npm ci
npm run dev
```

打开终端显示的本地网址。发布前执行 `npm test` 和 `npm run build`。
提交并推送到 `main` 后，已有 GitHub Actions 流程会自动部署 GitHub Pages。

## 常用修改位置

| 内容 | 位置 |
| --- | --- |
| 站名、介绍、GitHub 仓库链接 | `src/site.ts` |
| 首页 | `src/pages/index.astro` |
| 文章 | `src/pages/posts/*.md` |
| 导航与全站样式 | `src/layouts/SiteLayout.astro` |
| 留言与提问 | `src/content/guestbook/*.md` |
| 博主回复 | `src/content/replies/*.md` |
| 留言页样式 | `src/styles/guestbook.css` |
| 留言 / 提问 / 回复模板 | `templates/` |

**访客提交与博主回复的完整步骤见 [CONTRIBUTING.md](CONTRIBUTING.md)。**

访客 Fork → 新增 Markdown → 提交 PR → 博主审核合并 → 自动发布。
博主在单独的回复文件中回答，网站自动关联并显示「待回答 / 已回答」。
留言不需要数据库、服务端密钥或第三方评论账号；提交入口需要 GitHub 账号。

仓库暂不附带公开的虚构来信，第一份留言合并前会显示空状态。
模板位于内容目录之外，不会被误当成真实留言发布。
