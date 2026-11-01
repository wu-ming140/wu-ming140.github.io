import { defineCollection, z } from 'astro:content';
import { guestbookLoader } from './lib/guestbook-loader';
import { validDate } from './lib/guestbook-rules.mjs';
import { normalizePlacements, normalizeCollections } from './lib/editorial.mjs';

const date = z.string().refine(validDate, '请填写真实日期并加引号，例如 "2026-11-01"');
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '请使用留言文件名，不含 .md');

const guestbook = defineCollection({
  loader: guestbookLoader('guestbook'),
  schema: z.object({
    title: z.string().trim().min(1).max(80),
    author: z.string().trim().min(1).max(40),
    date,
    kind: z.enum(['message', 'question']).default('message'),
    channel: z.enum(['github', 'other']).default('github'),
    source: z.string().trim().min(1).max(40).optional(),
    github: z.string().regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i).optional(),
    draft: z.boolean().default(false),
    placements: z.record(z.object({ pinned: z.boolean().optional(), featured: z.boolean().optional() }).strict()).optional().transform((value, ctx) => {
      try { return normalizePlacements(value); } catch (error) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: String(error) }); return z.NEVER; }
    }),
    collections: z.array(z.object({ name: z.string(), order: z.number().int().min(1).max(99999).optional() }).strict()).max(12).optional().transform((value, ctx) => {
      try { return normalizeCollections(value); } catch (error) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: String(error) }); return z.NEVER; }
    }),
  }).strict(),
});

// 博主回复独立保存，访客只需新增 guestbook 中的文件。
const replies = defineCollection({
  loader: guestbookLoader('replies'),
  schema: z.object({ message: id, date, draft: z.boolean().default(false) }).strict(),
});

export const collections = { guestbook, replies };
