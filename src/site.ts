// 修改站名、首页介绍和关于页内容，可以从这里开始。
export const site = {
  name: '无暝-小暝宝基地',
  shortName: '无暝',
  subtitle: '小暝宝基地',
  description: '把日子写成文字，把喜欢留在这里。',
  headline: ['把平凡的日子，', '写成自己的故事。'],
  intro: '一个安放文字和日常的小角落。慢慢记录，也慢慢发现。',
  repository: 'https://github.com/wu-ming140/wu-ming140.github.io',
  branch: 'main',
  viewCounts: true,
};

export const about = {
  intro: '这里会记录一些想法、一些日常，和一些值得收藏的喜欢。希望它可以成为一个安静的角落，让文字有归处，也让时间留下痕迹。',
  sections: [
    { title: '关于这个名字', text: `${site.name}，是这个小站的名字。关于它更多的故事，留待以后慢慢写。` },
    { title: '关于这里的文字', text: '不赶进度，也不规定主题。认真生活，偶尔写字，慢慢把这里变成自己喜欢的样子。' },
  ],
  thanks: '谢谢你来，希望这里有让你愿意停留片刻的文字。',
};

export function localPath(path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
