import { useState } from 'react';
import { keepPreviousData, queryOptions, useQuery, type QueryKey } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { KanbanIcon, Settings02Icon } from '@hugeicons/core-free-icons';
import { gql, GitHubError } from '@/github/client';
import { persisted } from '@/lib/persist';
import { useDebounced } from '@/lib/useDebounced';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Field } from './PrSidebar';
import { EDIT_MUTATIONS, prKey, repoPath, type PrWithReview } from './query';
import { usePrMutation } from './usePrMutation';

// Projects need the token's `project` scope (`read:project` to read), which older tokens lack, so they load on
// their own: a missing scope must not fail the rest of the pull request.
const PROJECTS_QUERY = /* GraphQL */ `
  query PrProjects($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        projectItems(first: 10) {
          nodes {
            id
            status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } }
            project { id title url viewerCanUpdate field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } }
          }
        }
      }
    }
  }
`;

// The projects a pull request can go into: the repository's and its owner's.
const PROJECT_CHOICES_QUERY = /* GraphQL */ `
  query PrProjectChoices($owner: String!, $repo: String!, $q: String!) {
    repository(owner: $owner, name: $repo) {
      projectsV2(first: 20, query: $q) { nodes { id title closed viewerCanUpdate } }
      owner { ... on ProjectV2Owner { projectsV2(first: 20, query: $q) { nodes { id title closed viewerCanUpdate } } } }
    }
  }
`;

type ProjectItem = {
  id: string;
  /** Null when the item has no status; `{}` when the project's Status field isn't a single select. */
  status: { optionId?: string | null } | null;
  project: { id: string; title: string; url: string; viewerCanUpdate: boolean; field: { id?: string; options?: { id: string; name: string }[] } | null };
};
type Choice = { id: string; title: string; closed: boolean; viewerCanUpdate: boolean };

/** False once GitHub said the token can't read projects. Until the next page load, nothing asks again. */
let canReadProjects = true;

/** The pull request's projects, with each one's status. Null when the token lacks the scope to read them. */
export const prProjectsQuery = (owner: string, repo: string, number: number) =>
  queryOptions({
    queryKey: ['pr-projects', ...prKey(owner, repo, number)],
    queryFn: async ({ signal }) => {
      if (!canReadProjects) return null;
      try {
        const data = await gql<{ repository: { pullRequest: { projectItems: { nodes: ProjectItem[] } } | null } | null }>(
          PROJECTS_QUERY,
          { owner, repo, number },
          false,
          signal,
        );
        return data.repository?.pullRequest?.projectItems.nodes ?? [];
      } catch (error) {
        if (!(error instanceof GitHubError && error.problem.kind === 'scope')) throw error;
        canReadProjects = false;
        return null;
      }
    },
    persister: persisted,
  });

/**
 * The Projects field of the sidebar's Details card: each project with its status, which people who can edit the
 * project change in place. People who may triage the pull request add it to projects or take it out.
 */
export function ProjectsField({ pr }: { pr: PrWithReview }) {
  const [owner, repo] = repoPath(pr).split('/') as [string, string];
  const query = prProjectsQuery(owner, repo, pr.number);
  const items = useQuery(query).data;
  if (items === undefined) return null;
  return (
    <Field label="Projects" action={items && pr.viewerCanAssign && <ProjectPicker pr={pr} items={items} queryKey={query.queryKey} />}>
      {items === null ? (
        <a href="https://github.com/settings/tokens" className="px-2 text-[12.5px] text-subtle hover:text-accent">
          Add the project scope to your token to see projects
        </a>
      ) : items.length === 0 ? (
        <span className="px-2 text-[12.5px] text-subtle">None</span>
      ) : (
        items.map((item) => <ProjectRow key={item.id} item={item} queryKey={query.queryKey} />)
      )}
    </Field>
  );
}

function ProjectRow({ item, queryKey }: { item: ProjectItem; queryKey: QueryKey }) {
  const set = usePrMutation(queryKey);
  const { project } = item;
  const field = project.field?.id && project.field.options ? { id: project.field.id, options: project.field.options } : undefined;
  const status = field?.options.find((o) => o.id === item.status?.optionId);
  return (
    <div className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px]">
      <HugeiconsIcon icon={KanbanIcon} className="size-3.5 shrink-0 text-subtle" />
      <a href={project.url} className="min-w-0 flex-1 truncate hover:underline">
        {project.title}
      </a>
      {field && project.viewerCanUpdate ? (
        <Menu<string>
          value={status?.id ?? ''}
          options={field.options.map((o) => ({ value: o.id, label: o.name }))}
          onChange={(option) =>
            option !== status?.id &&
            set.mutate({ query: EDIT_MUTATIONS.setProjectStatus, variables: { project: project.id, item: item.id, field: field.id, option } })
          }
          trigger={(open) => (
            <button type="button" onClick={open} disabled={set.isPending} title="Set status" className="shrink-0 cursor-pointer rounded px-1 text-[11.5px] text-muted hover:bg-hover hover:text-fg">
              {status?.name ?? 'No status'}
            </button>
          )}
        />
      ) : (
        status && <span className="shrink-0 text-[11.5px] text-subtle">{status.name}</span>
      )}
    </div>
  );
}

/** Adds the pull request to the repository's or its owner's open projects, or takes it out. Projects load once the menu first opens. */
function ProjectPicker({ pr, items, queryKey }: { pr: PrWithReview; items: ProjectItem[]; queryKey: QueryKey }) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 200);
  const [owner, repo] = repoPath(pr).split('/');
  const choices = useQuery({
    queryKey: ['pr-project-choices', owner, repo, q],
    queryFn: async () => {
      const { repository } = await gql<{ repository: { projectsV2: { nodes: Choice[] }; owner: { projectsV2?: { nodes: Choice[] } } } | null }>(PROJECT_CHOICES_QUERY, {
        owner,
        repo,
        q,
      });
      const all = [...(repository?.projectsV2.nodes ?? []), ...(repository?.owner.projectsV2?.nodes ?? [])];
      return all.filter((p, i) => !p.closed && p.viewerCanUpdate && all.findIndex((o) => o.id === p.id) === i);
    },
    enabled: opened,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const change = usePrMutation(queryKey);
  const itemOf = (projectId: string) => items.find((item) => item.project.id === projectId);
  const options: MenuOption<string>[] = [
    ...(search ? [] : items.map((item) => ({ value: item.project.id, label: item.project.title }))),
    ...(choices.data ?? []).filter((p) => search || !itemOf(p.id)).map((p) => ({ value: p.id, label: p.title })),
  ];
  return (
    <Menu<string>
      value={items.map((item) => item.project.id)}
      options={options}
      onChange={(project) => {
        if (change.isPending) return;
        const item = itemOf(project);
        change.mutate(
          item
            ? { query: EDIT_MUTATIONS.removeFromProject, variables: { project, item: item.id }, success: 'Removed from project' }
            : { query: EDIT_MUTATIONS.addToProject, variables: { project, id: pr.id }, success: 'Added to project' },
        );
      }}
      header={
        <div className="p-1 pb-1.5">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects"
            className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent/60"
          />
          {options.length === 0 && <p className="px-1.5 pt-2 text-[12px] text-subtle">{choices.isFetching ? 'Searching…' : 'No open projects'}</p>}
        </div>
      }
      trigger={(open) => (
        <button
          type="button"
          aria-label="Edit projects"
          title="Edit projects"
          onClick={() => {
            setOpened(true);
            open();
          }}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-subtle hover:bg-hover hover:text-fg"
        >
          <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
        </button>
      )}
    />
  );
}
