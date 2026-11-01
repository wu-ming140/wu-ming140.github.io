export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_MEDIA_BYTES = 50 * 1024 * 1024;
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'];
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv'];

export function mediaType(url) {
  let path;
  try { path = new URL(url, 'https://media.invalid').pathname; } catch { return null; }
  const extension = path.split('.').pop()?.toLowerCase();
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  return null;
}

export function safeMediaUrl(value) {
  return typeof value === 'string'
    && !/[\u0000-\u0020\u007f\\]/.test(value)
    && /^(https?:\/\/|\/(?!\/))/i.test(value);
}

export function mediaPath(name, id, date) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (![...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].includes(extension)) {
    throw new Error('请选择 PNG、JPG、GIF、WebP、AVIF 图片，或 MP4、WebM、OGV 视频。');
  }
  if (!/^[a-z0-9-]+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('媒体文件名无效。');
  const stem = name.slice(0, -(extension.length + 1)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'media';
  return `public/media/${date}/${id}-${stem}.${extension}`;
}

export function mediaMarkdown(label, url) {
  if (!safeMediaUrl(url) || !mediaType(url)) throw new Error('请填写图片或视频文件的完整网址，或 /media/ 开头的站内路径。');
  const description = String(label || (mediaType(url) === 'video' ? '视频' : '图片')).replace(/[\r\n]/g, ' ').replace(/[\\\[\]]/g, '\\$&');
  // 尖括号形式保留 URL 中的括号；转义尖括号防止退出 Markdown 地址。
  const destination = url.replaceAll('<', '%3C').replaceAll('>', '%3E');
  return `![${description}](<${destination}>)`;
}

export default function remarkMedia() {
  return (tree, file) => {
    function visit(node) {
      if (node.type === 'image' && mediaType(node.url) === 'video') {
        if (!safeMediaUrl(node.url)) file.fail('视频地址请使用完整的 https://、http:// 或以 / 开头的站内路径。', node.position);
        const caption = node.alt || '视频';
        const url = node.url;
        Object.assign(node, {
          type: 'mediaVideo',
          data: { hName: 'video', hProperties: { src: url, controls: true, preload: 'metadata', playsInline: true, 'aria-label': caption } },
          children: [{ type: 'link', url, children: [{ type: 'text', value: '无法播放时，打开视频文件' }] }],
        });
      }
      for (const child of node.children ?? []) visit(child);
      if (node.type === 'paragraph' && node.children?.length === 1 && node.children[0].type === 'mediaVideo') {
        const video = node.children[0];
        Object.assign(node, {
          type: 'mediaFigure',
          data: { hName: 'figure', hProperties: { className: ['media-figure'] } },
          children: [video, { type: 'mediaCaption', data: { hName: 'figcaption' }, children: [{ type: 'text', value: video.alt || '视频' }] }],
        });
      }
    }
    visit(tree);
  };
}
