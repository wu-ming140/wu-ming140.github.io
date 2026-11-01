export interface PostColumn {
  slug: string;
  title: string;
  description: string;
  aliases: string[];
}

export const postColumns: PostColumn[] = [
  {
    slug: 'life', title: '生活随笔 / 心得分享',
    description: '日常的片段，偶尔的感想，还有慢慢想明白的事。',
    aliases: ['生活随笔/心得分享', '生活随笔', '心得分享', '随笔', '生活'],
  },
  {
    slug: 'learning', title: '学习记录 / 学习心得',
    description: '记录学过的知识、遇到的问题，以及一点点进步。',
    aliases: ['学习记录/学习心得', '学习记录', '学习心得', '学习', '笔记'],
  },
  {
    slug: 'portfolio', title: '作品集',
    description: '做过的作品、试过的想法，和它们从零开始的过程。',
    aliases: ['作品集', '作品', '项目'],
  },
  {
    slug: 'interests', title: '爱好',
    description: '游戏、音乐、书影音，和那些让我愿意花时间的喜欢。',
    aliases: ['爱好', '兴趣'],
  },
  {
    slug: 'site-log', title: '小站日志',
    description: '关于这个小站的搭建、更新，以及一路留下的变化。',
    aliases: ['小站日志', '建站日志', '站点日志'],
  },
];

export function getPostColumn(category?: string): PostColumn {
  const value = String(category ?? '').replace(/\s+/g, '').toLowerCase();
  if (!value) return postColumns[0];
  const column = postColumns.find((item) => item.slug === value || item.aliases.includes(value));
  if (!column) {
    throw new Error(`未知专栏「${category}」。请将文章的 category 设为：${postColumns.map((item) => item.title).join('、')}。`);
  }
  return column;
}

export function columnPath(column: PostColumn) {
  return `posts/columns/${column.slug}/`;
}
