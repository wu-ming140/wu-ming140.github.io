// 修改站名、首页介绍和关于页内容，可以从这里开始。
export const site = {
  name: '无暝-小暝宝基地',
  shortName: '无暝',
  subtitle: '小暝宝基地',
  description: '把日子写成文字，把喜欢留在这里。',
  headline: ['把平凡的日子，', '写成自己的故事。'],
  intro: '一个安放文字和日常的小角落。慢慢记录，也慢慢发现。',
};

export function localPath(path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
