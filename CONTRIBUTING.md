# 给小暝宝基地写留言

欢迎留言、分享近况，或者问一个问题。每条留言是一份 Markdown 文件，
由博主审核合并后公开展示在网站的「留言」页。

## 博主手动添加其他渠道的问题和回答

如果问题来自 QQ、微信、邮件或线下交流，对方无需使用 GitHub。
你在本地手动整理内容，再按平时写博客的方式提交、推送即可。
网站的「留言 → 其他渠道来信」专栏会自动收录这些内容。

### 第一步：写问题

复制 `templates/external-question.md` 到 `src/content/guestbook/`，
例如命名为 `2026-11-01-wechat-01.md`，修改为：

```markdown
---
title: "对方问你的问题标题"
author: "对方的昵称，或者匿名来信"
date: "2026-11-01"
kind: "question"
channel: "other"
source: "微信"
---

这里写你手动整理的问题正文。
```

`channel: "other"` 表示收入「其他渠道来信」专栏；
`source` 可以写 QQ、微信、邮件、线下交流等，不必填写对方的账号或联系方式。
这些来信也会出现在全部留言列表里，显示来源和「博主整理」。

### 第二步：写回答

复制 `templates/reply.md` 到 `src/content/replies/`，
例如命名为 `2026-11-01-reply-wechat-01.md`，修改为：

```markdown
---
message: "2026-11-01-wechat-01"
date: "2026-11-01"
---

这里写你的回答。支持分段、标题、列表、引用和代码块。
```

`message` 必须与问题的文件名一致，但不带 `.md`。
问题和回答可以一起提交发布；也可以先发布问题，以后再添加回答。
有回答后自动显示「已回答」。以后修改回答，直接编辑对应的回复文件。

### 第三步：保存并发布

保存文件 → 本地预览 → GitHub Desktop 中 Commit → Push。
这是博主直接维护自己的博客，无需给自己发起合并请求。

### 想给自己留一句话

复制 `templates/my-message.md` 到 `src/content/guestbook/`，改成唯一的文件名，
修改标题、日期和正文，保存并发布即可。不需要再新建回复。
模板使用 `kind: "message"`、`channel: "other"`、`source: "博主自留"`，
会同时显示在留言页和「其他渠道来信」专栏。

## 方法一：直接在 GitHub 写

1. 在博客打开「留言 → 写留言 / 提问 → 在 GitHub 打开留言模板」。
2. 登录 GitHub；如果提示没有写入权限，按提示 Fork 到自己的账号。
3. 保留 `src/content/guestbook/` 路径，把文件名改成例如 `2026-11-01-yourname.md`。
4. 修改模板的标题、昵称、日期和正文。需要提问时，把 `kind` 改成 `question`。
5. 保存到自己的 Fork，点击 Contribute → Open pull request，向原仓库的 `main` 分支提交。
6. 等待检查与博主审核。合并并成功发布后，网站就会展示你的来信。

## 方法二：Fork 后克隆到电脑

先在 GitHub Fork 本仓库，然后克隆**自己账号下的 Fork**。
复制 `templates/message.md` 或 `templates/question.md` 到 `src/content/guestbook/`，
改名、填写、提交并推送到自己的 Fork，再在 GitHub 发起 Pull Request。

```sh
git clone https://github.com/YOUR-USERNAME/wu-ming140.github.io.git
cd wu-ming140.github.io
git switch -c add-my-message
# 将模板复制到 src/content/guestbook/，改名并编辑
npm ci
npm test
npm run build
git add src/content/guestbook/2026-11-01-yourname.md
git commit -m "新增我的留言"
git push -u origin add-my-message
```

将 `YOUR-USERNAME`、分支名和文件名替换成自己的信息。Fork 后仍需发起合并请求，
仅克隆和推送到自己的仓库不会更新博主的网站。

## 留言格式

```markdown
---
title: "你好，很高兴来到这里"
author: "你的昵称"
date: "2026-11-01"
kind: "message"
github: "your-github-name"
---

这里是正文。可以写段落、列表、引用和代码块，也可以放 Markdown 链接。
```

| 字段 | 说明 |
| --- | --- |
| `title` | 必填，1–80 个字符 |
| `author` | 必填，公开昵称，1–40 个字符 |
| `date` | 必填，真实日期，使用带引号的 `YYYY-MM-DD` |
| `kind` | `message` 表示留言，`question` 表示提问；不填时默认为留言 |
| `channel` | 博主整理的其他渠道来信用 `other`；不填时默认为 `github` |
| `source` | 可选，其他渠道的具体来源，如 QQ、微信、邮件、博主自留 |
| `github` | 可选，仅填用户名，不填网址；不代表身份验证 |
| `draft` | 可选，`true` 表示暂不在网站展示；文件仍能在公开仓库中看到 |

文件名只能使用小写英文字母、数字和单个连字符，不使用空格、中文或下划线。
例如 `2026-11-01-alice.md`。文件名应唯一，每条留言单独一个文件。
正文不能为空；不填写 `layout`，也不在文件夹中放 `index.md` 或其他说明文档。

支持纯 Markdown，不支持 HTML、脚本、iframe。链接和图片地址使用完整的
`https://`、`http://` 地址，链接也可使用 `mailto:`、以 `/` 开头的站内地址或 `#` 锚点。
图片可先放到 `public/images/`，再使用 `/images/文件名`；图片也需要博主审核。

请仅新增自己的留言文件，不修改他人的留言、博主回复、页面代码或自动发布设置。
不愿公开的联系方式、账号凭据或私人内容请不要放在来信中。

## 博主怎样回答

1. 复制 `templates/reply.md` 到 `src/content/replies/`。
2. 改成唯一文件名，如 `2026-11-02-reply-to-alice.md`。
3. 将 `message` 改成对应留言的文件名，去掉 `.md`。
4. 修改回复日期和正文；日期不能早于留言日期。
5. 本地预览后提交、推送，网站发布后自动展示回复。

```markdown
---
message: "2026-11-01-alice"
date: "2026-11-02"
---

谢谢你的问题！这是我的回答……
```

同一留言可以有多份回复，按日期从早到晚展示；同一天按回复文件名排序。
提问有至少一条已发布的回复，就会标记为「已回答」；普通留言显示「已回复」。
不需要手动维护回答状态。博主可以编辑已有回复，或再添加一份回复。
回复也支持 `draft: true`。对草稿留言的回复会随留言一起隐藏。

## 博主怎样审核合并

- 查看 PR 的 Files changed，确认普通访客仅新增自己的留言文件。
- 检查昵称、正文、链接和图片；文件里的昵称和 GitHub 用户名是自行填写的。
- 查看 `Check contributions` 是否通过；通过只代表格式和构建正常，内容仍需人工审核。
- 确认后合并；原有发布流程会在 `main` 更新后自动发布。

`.github/CODEOWNERS` 会将改动标记给博主审阅。
如需强制审核，请在 GitHub 的分支保护或规则集中启用 Code Owner review。
CODEOWNERS 本身不会禁止访客在 PR 中提出其他改动，合并前仍要检查差异。

只删除留言会导致关联回复找不到目标；删除留言时请同时删除对应回复。
改名时也要更新关联回复的 `message` 字段。构建会检查这些引用，避免回复丢失。
