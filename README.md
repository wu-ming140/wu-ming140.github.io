# 无暝 · 小暝宝基地

使用 Astro 构建的个人博客，包含大厅（首页）、关于，以及通过 Markdown 与 Pull Request 管理的留言与问答。

首页就是大厅，依次展示小站介绍、五个专栏和全部内容。
五个专栏分别为：生活随笔 / 心得分享、学习记录 / 学习心得、作品集、爱好、小站日志。
写作与专栏归类步骤见 [POSTING.md](POSTING.md)。

## 本地使用

需要 Node.js 22.12+（推荐 Node.js 22 LTS）。

```sh
npm ci
npm run dev
```

打开终端显示的本地网址。发布前执行 `npm test` 和 `npm run build`。
提交并推送到 `main` 后，已有 GitHub Actions 流程会自动部署 GitHub Pages。

## 浏览量

页脚显示全站浏览量，文章标题下显示该篇阅读次数，使用不蒜子共享统计，无需配置账号或数据库。
按页面访问次数（PV）计数，同一个人刷新或重新打开页面也可能增加次数，不代表独立访客人数。
接入前未被服务记录的历史访问无法追溯。

只有 `astro.config.mjs` 中 `site` 对应的正式网站会请求统计；本地与其他预览地址显示「预览不计数」。
服务加载中显示「—」，超时或失败显示「暂不可用」，不会用虚构的数字替代。
统计依赖第三方服务及访客网络；广告拦截、禁用 JavaScript 或服务故障可能导致漏计。
统计请求沿用官方脚本的单请求 Referrer 策略，向不蒜子提供页面来源（含路径及可能的查询参数），用以区分文章。
切换域名或文章路径后，计数由服务按新地址记录。

在 `src/site.ts` 将 `viewCounts` 设为 `false` 即可关闭显示与统计请求。
服务说明：https://ibruce.info/2015/04/04/busuanzi/

## 常用修改位置

| 内容 | 位置 |
| --- | --- |
| 站名、介绍、GitHub 仓库链接 | `src/site.ts` |
| 首页 | `src/pages/index.astro` |
| 文章 | `src/pages/posts/*.md` |
| 大厅与专栏设置 | `src/lib/columns.ts` |
| 大厅样式 | `src/styles/hall.css` |
| 新文章模板 | `templates/post.md` |
| 导航与全站样式 | `src/layouts/SiteLayout.astro` |
| 留言与提问 | `src/content/guestbook/*.md` |
| 博主回复 | `src/content/replies/*.md` |
| 留言页样式 | `src/styles/guestbook.css` |
| 留言 / 提问 / 回复模板 | `templates/` |
| 手动整理的站外提问模板 | `templates/external-question.md` |
| 博主自己的留言模板 | `templates/my-message.md` |

**访客提交与博主回复的完整步骤见 [CONTRIBUTING.md](CONTRIBUTING.md)。**

从 QQ、微信、邮件等渠道收到的问题，可以由博主手动录入，设置 `channel: "other"`，
就会自动显示在「留言 → 其他渠道来信」专栏。问题与回答仍分别保存为 Markdown 文件。

访客 Fork → 新增 Markdown → 提交 PR → 博主审核合并 → 自动发布。
博主在单独的回复文件中回答，网站自动关联并显示「待回答 / 已回答」。
留言不需要数据库、服务端密钥或第三方评论账号；提交入口需要 GitHub 账号。

仓库暂不附带公开的虚构来信，第一份留言合并前会显示空状态。
模板位于内容目录之外，不会被误当成真实留言发布。
