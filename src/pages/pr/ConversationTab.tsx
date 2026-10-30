import { useMemo } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { canPushWith } from '@/pages/repo/query';
import { Skeleton } from '@/ui/primitives';
import { Composer, quoteReply } from './Composer';
import { MergeBox } from './MergeBox';
import { ChecksCard, FilesCard, LinkedIssuesCard, NotificationsCard, participantsOf, PeopleCard } from './PrSidebar';
import type { LoadedPr } from './query';
import { Threads } from './Threads';
import { CommentCard, MoreOnGitHub, Timeline } from './Timeline';

/**
 * Description, review threads and activity, with merge controls pinned on the right. The description shows
 * with the first part of the pull request; each other part fills in its own places when it lands.
 */
export function ConversationTab({ loaded, queryKey }: { loaded: LoadedPr; queryKey: QueryKey }) {
  const { pr, merge, review, timelineItems } = loaded;
  const hiddenThreads = review ? review.reviewThreads.totalCount - review.reviewThreads.nodes.length : 0;
  const participants = useMemo(() => review && timelineItems && participantsOf(review, timelineItems.nodes), [review, timelineItems]);
  return (
    <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <CommentCard
          author={pr.author}
          createdAt={pr.createdAt}
          html={pr.bodyHTML}
          editable={{ kind: 'pr', node: pr, queryKey }}
          meta={{ url: pr.url, lastEditedAt: pr.lastEditedAt }}
          onQuote={pr.body ? () => quoteReply(pr.id, pr.body) : undefined}
        />
        {review && <Threads threads={review.reviewThreads.nodes} queryKey={queryKey} />}
        {hiddenThreads > 0 && <MoreOnGitHub count={hiddenThreads} noun="review threads" className="-mt-3 px-1" />}
        {/* Waits for the threads too, so the activity doesn't move down when they land. */}
        {review && timelineItems ? (
          <>
            <Timeline newest={timelineItems} queryKey={queryKey} pr={pr} />
            <Composer pr={review} queryKey={queryKey} />
          </>
        ) : (
          <Skeleton className="h-48 rounded-xl" />
        )}
      </div>
      <aside className="flex flex-col gap-4 *:shrink-0 @3xl:sticky @3xl:top-[108px] @3xl:max-h-[calc(100vh-124px)] @3xl:self-start @3xl:overflow-y-auto">
        {merge ? (
          <>
            <MergeBox repo={merge.repo} pr={merge.pr} queryKey={queryKey} />
            <ChecksCard checks={merge.pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []} />
          </>
        ) : (
          <Skeleton className="h-40 rounded-xl" />
        )}
        {review ? (
          <>
            <PeopleCard pr={review} queryKey={queryKey} />
            <LinkedIssuesCard pr={review} queryKey={queryKey} />
            <FilesCard pr={review} />
            {participants && <NotificationsCard pr={review} participants={participants} canLock={canPushWith(merge?.repo.viewerPermission)} queryKey={queryKey} />}
          </>
        ) : (
          <Skeleton className="h-48 rounded-xl" />
        )}
      </aside>
    </div>
  );
}
