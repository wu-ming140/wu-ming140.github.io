import type { APIRoute } from 'astro';
import { feedResponse } from '../../lib/feed-route';
export const GET: APIRoute = ({ site }) => feedResponse(site, 'guestbook');
