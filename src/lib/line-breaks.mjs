// 将普通正文中的 Enter 转成可见换行，预览与正式页面共用。
// 只处理文本节点，代码块、行内代码及 Markdown 的段落结构保持原样。
export default function remarkLineBreaks() {
  return (tree) => {
    function visit(node) {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text' || !/[\r\n]/.test(child.value)) { visit(child); return [child]; }
        return child.value.split(/\r\n|\r|\n/).flatMap((value, index) => [
          ...(index ? [{ type: 'break' }] : []),
          ...(value ? [{ type: 'text', value }] : []),
        ]);
      });
    }
    visit(tree);
  };
}
