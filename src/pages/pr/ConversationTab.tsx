import type { QueryKey } from '@tanstack/react-query';
import { Composer } from './Composer';
import { MergeBox } from './MergeBox';
import { ChecksCard, FilesCard, LinkedIssuesCard, PeopleCard } from './PrSidebar';
import type { PullRequest, Repo } from './query';
import { Threads } from './Threads';
import { CommentCard, MoreOnGitHub, Timeline } from './Timeline';

/** Description, review threads and activity, with merge controls pinned on the right. */
export function ConversationTab({ pr, repo, queryKey }: { pr: PullRequest; repo: Repo; queryKey: QueryKey }) {
  const checks = pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? [];
  const hiddenThreads = pr.reviewThreads.totalCount - pr.reviewThreads.nodes.length;
  return (
    <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <CommentCard author={pr.author} createdAt={pr.createdAt} html={pr.bodyHTML} editable={{ kind: 'pr', node: pr, queryKey }} />
        <Threads threads={pr.reviewThreads.nodes} queryKey={queryKey} />
        {hiddenThreads > 0 && <MoreOnGitHub count={hiddenThreads} noun="review threads" className="-mt-3 px-1" />}
        <Timeline items={pr.timelineItems.nodes} hiddenCount={pr.timelineItems.nodes.length === 100 ? pr.timelineItems.totalCount - 100 : 0} queryKey={queryKey} />
        <Composer pr={pr} queryKey={queryKey} />
      </div>
      <aside className="flex flex-col gap-4 *:shrink-0 @3xl:sticky @3xl:top-[108px] @3xl:max-h-[calc(100vh-124px)] @3xl:self-start @3xl:overflow-y-auto">
        <MergeBox repo={repo} pr={pr} queryKey={queryKey} />
        <ChecksCard checks={checks} />
        <PeopleCard pr={pr} queryKey={queryKey} />
        <LinkedIssuesCard issues={pr.closingIssuesReferences.nodes} />
        <FilesCard pr={pr} />
      </aside>
    </div>
  );
}
