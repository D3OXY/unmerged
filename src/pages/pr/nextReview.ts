import type { QueryClient } from '@tanstack/react-query';
import { navigate } from '@/lib/navigation';
import { homeQueries } from '@/pages/home/queries';
import { toast } from '@/ui/toast';
import { prefetchPr } from './query';

// PRs approved, sent back or merged since this page loaded. The cached review queue can still list them.
const done = new Set<string>();

/**
 * Toasts `message` after the viewer is done with the PR at `url` (approved, requested changes, merged), with
 * a "Next review" action to the next PR waiting on their review, already prefetched. The queue is Home's
 * "review requested" search, from cache when there is one.
 */
export async function toastNextReview(client: QueryClient, message: string, url: string) {
  done.add(url);
  const queue = homeQueries.reviewRequested();
  const next = (await client.ensureQueryData(queue).catch(() => null))?.nodes.find((pr) => !done.has(pr.url));
  client.invalidateQueries({ queryKey: queue.queryKey });
  if (!next) return toast.success(message);
  const [owner = '', repo = ''] = next.repository.nameWithOwner.split('/');
  prefetchPr(client, owner, repo, next.number, 'conversation');
  toast.success(message, { label: `Next review: #${next.number}`, run: () => navigate(next.url) });
}
