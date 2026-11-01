import { columnDefinitions, resolveColumn } from './column-data.mjs';
export interface PostColumn {
  slug: string;
  title: string;
  description: string;
  aliases: string[];
}

export const postColumns: PostColumn[] = columnDefinitions;

export function getPostColumn(category?: string): PostColumn {
  return resolveColumn(category);
}

export function columnPath(column: PostColumn) {
  return `posts/columns/${column.slug}/`;
}
