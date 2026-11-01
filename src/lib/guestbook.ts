import { getCollection } from 'astro:content';
import { validateEntries } from './guestbook-rules.mjs';

export async function getGuestbook() {
  const [messages, replies] = await Promise.all([
    getCollection('guestbook'), getCollection('replies'),
  ]);
  validateEntries(messages, replies);
  return messages
    .filter((message) => !message.data.draft)
    .sort((a, b) => b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id))
    .map((message) => ({
      ...message,
      replies: replies
        .filter((reply) => reply.data.message === message.id && !reply.data.draft)
        .sort((a, b) => a.data.date.localeCompare(b.data.date) || a.id.localeCompare(b.id)),
    }));
}

export function messageStatus(message: Awaited<ReturnType<typeof getGuestbook>>[number]) {
  if (message.data.kind === 'question') return message.replies.length ? '已回答' : '待回答';
  return message.replies.length ? '已回复' : '留言';
}
