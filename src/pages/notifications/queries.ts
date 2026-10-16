import { infiniteQueryOptions } from '@tanstack/react-query';
import { rest } from '@/github/client';
import { persisted } from '@/lib/persist';

/** One thread from GET /notifications. */
export type Notification = {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: { title: string; url: string | null; type: string };
  repository: { full_name: string; html_url: string; owner: { avatar_url: string } };
};

export type View = 'inbox' | 'unread' | 'participating';

const PARAMS: Record<View, string> = { inbox: 'all=true', unread: 'all=false', participating: 'all=true&participating=true' };
const PAGE_SIZE = 50;

/** Which view a notifications URL asks for, from GitHub's own `?query=` values. */
export function viewOf(url: URL): View {
  const query = url.searchParams.get('query') ?? '';
  return query.includes('is:unread') ? 'unread' : query.includes('reason:participating') ? 'participating' : 'inbox';
}

export const notificationsQuery = (view: View) =>
  infiniteQueryOptions({
    queryKey: ['notifications', view],
    queryFn: ({ pageParam }) => rest<Notification[]>(`/notifications?${PARAMS[view]}&per_page=${PAGE_SIZE}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length + 1 : null),
    refetchInterval: 60_000,
    // Infinite queries infer their data type from `persister` too; pin it.
    persister: persisted<Notification[]>,
  });
