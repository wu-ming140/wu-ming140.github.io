// 留言采用纯 Markdown；文章原有的 Markdown 设置不受影响。
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function safeMarkdownUrl(value) {
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return false;
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(value);
}

export function validateEntries(messages, replies) {
  const ids = new Set(messages.map((message) => message.id));
  for (const message of messages) {
    if (['index', 'contribute'].includes(message.id)) {
      throw new Error(`留言文件名与页面地址冲突，请换一个文件名：${message.id}`);
    }
  }
  for (const entry of [...messages, ...replies]) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) {
      throw new Error(`留言或回复文件名只能使用小写字母、数字和连字符：${entry.id}`);
    }
    if (!entry.body?.trim()) throw new Error(`留言或回复正文不能为空：${entry.id}`);
  }
  for (const reply of replies) {
    if (!ids.has(reply.data.message)) {
      throw new Error(`回复 ${reply.id} 对应的留言不存在：${reply.data.message}`);
    }
    const message = messages.find((entry) => entry.id === reply.data.message);
    if (reply.data.date < message.data.date) {
      throw new Error(`回复日期不能早于留言日期：${reply.id}`);
    }
  }
}

export default function remarkGuestbook() {
  return (tree, file) => {
    const path = String(file.path ?? '').replaceAll('\\', '/');
    if (!/\/src\/content\/(guestbook|replies)\//.test(path)) return;
    function visit(node) {
      if (node.type === 'html') {
        file.fail('留言和回复只支持纯 Markdown，请移除 HTML 标签。', node.position);
      }
      if (typeof node.url === 'string' && !safeMarkdownUrl(node.url)) {
        file.fail('链接请使用完整的 https://、http://、mailto: 地址，或以 /、# 开头的站内地址。', node.position);
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
