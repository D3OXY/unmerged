import { queryOptions } from '@tanstack/react-query';
import { gql } from '@/github/client';
import type { Label } from '@/github/types';
import { persisted } from '@/lib/persist';
import type { Permission } from '@/pages/repo/query';

// Markdown templates and config.yml come parsed from GitHub. YAML issue forms aren't in `issueTemplates`, so
// the template folder's files come along to list them; GitHub's own page renders them (see matchRoute).
const NEW_ISSUE_QUERY = /* GraphQL */ `
  query NewIssue($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      id viewerPermission isBlankIssuesEnabled
      issueTemplates {
        name about title body filename
        labels(first: 20) { nodes { id name color } }
        assignees(first: 10) { nodes { id login avatarUrl } }
      }
      contactLinks { name about url }
      templateFolder: object(expression: "HEAD:.github/ISSUE_TEMPLATE") {
        ... on Tree { entries { name object { ... on Blob { text } } } }
      }
    }
  }
`;

export type IssueLabel = Label & { id: string };
export type Assignee = { id: string; login: string; avatarUrl: string };

/** A Markdown issue template (`.github/ISSUE_TEMPLATE/*.md`), as GitHub parsed its front matter. */
export type IssueTemplate = {
  name: string;
  about: string | null;
  title: string | null;
  body: string | null;
  filename: string;
  labels: { nodes: IssueLabel[] };
  assignees: { nodes: Assignee[] };
};

/** A YAML issue form, listed in the chooser and opened on GitHub. */
export type IssueForm = { name: string; about: string | null; filename: string };

type NewIssueData = {
  repository: {
    id: string;
    viewerPermission: Permission | null;
    isBlankIssuesEnabled: boolean;
    issueTemplates: IssueTemplate[] | null;
    contactLinks: { name: string; about: string | null; url: string }[] | null;
    templateFolder: { entries?: { name: string; object: { text?: string | null } | null }[] } | null;
  } | null;
};

/** What the new-issue page needs to know about a repo: its templates and whether the viewer may triage. */
export type NewIssueInfo = NonNullable<ReturnType<typeof toInfo>>;

function toInfo({ repository: repo }: NewIssueData) {
  if (!repo) return null;
  const forms = (repo.templateFolder?.entries ?? []).flatMap(({ name, object }) =>
    /\.ya?ml$/i.test(name) && !/^config\.ya?ml$/i.test(name) && object?.text ? (formSummary(name, object.text) ?? []) : [],
  );
  return {
    id: repo.id,
    // Triage access is what lets GitHub's own form set labels and assignees.
    canTriage: !!repo.viewerPermission && repo.viewerPermission !== 'READ',
    blankAllowed: repo.isBlankIssuesEnabled,
    templates: repo.issueTemplates ?? [],
    forms,
    contactLinks: repo.contactLinks ?? [],
  };
}

export const newIssueQuery = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ['new-issue', owner.toLowerCase(), repo.toLowerCase()],
    queryFn: async () => toInfo(await gql<NewIssueData>(NEW_ISSUE_QUERY, { owner, repo }, true)),
    persister: persisted,
  });

/**
 * An issue form's top-level `name` and `description`: plain, quoted, or a `|` / `>` block. Not a YAML parser,
 * just enough for the chooser. Null without a name (GitHub doesn't list those either).
 */
export function formSummary(filename: string, text: string): IssueForm | null {
  const lines = text.split(/\r?\n/);
  const field = (key: string) => {
    const at = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (at < 0) return null;
    const value = lines[at]!.slice(key.length + 1).trim();
    if (/^[|>][-+]?$/.test(value)) {
      const block = lines.slice(at + 1);
      const end = block.findIndex((line) => line.trim() && !/^\s/.test(line));
      return (end < 0 ? block : block.slice(0, end)).map((line) => line.trim()).filter(Boolean).join(' ') || null;
    }
    const quoted = /^(["'])(.*)\1\s*(#.*)?$/.exec(value);
    if (quoted) return quoted[1] === "'" ? quoted[2]!.replaceAll("''", "'") : quoted[2]!.replace(/\\(.)/g, '$1');
    return value.replace(/\s+#.*$/, '') || null;
  };
  const name = field('name');
  return name ? { name, about: field('description'), filename } : null;
}

/** The query parameters GitHub's new-issue page takes. `template` is null when absent, '' for a blank issue. */
export type Prefill = { template: string | null; title: string; body: string; labels: string[]; assignees: string[] };

export function prefillOf(search: string): Prefill {
  const params = new URLSearchParams(search);
  const list = (key: string) => (params.get(key) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { template: params.get('template'), title: params.get('title') ?? '', body: params.get('body') ?? '', labels: list('labels'), assignees: list('assignees') };
}

/**
 * What `/issues/new` shows: the chooser, or the form and the template it starts from. Like GitHub, a repo with
 * templates or contact links gets the chooser unless the URL names a template or prefills the form; a URL
 * naming no known template opens a blank issue, if the repo allows those.
 */
export function viewOf(info: NewIssueInfo, prefill: Prefill, choose: boolean): { choose: true } | { choose: false; template?: IssueTemplate } {
  if (choose) return { choose: true };
  const name = prefill.template?.toLowerCase();
  const template = name && info.templates.find((t) => t.filename.toLowerCase() === name);
  if (template) return { choose: false, template };
  if (!hasChoices(info)) return { choose: false };
  const prefilled = prefill.template !== null || !!(prefill.title || prefill.body || prefill.labels.length || prefill.assignees.length);
  return info.blankAllowed && prefilled ? { choose: false } : { choose: true };
}

/** Whether the repo has anything for the chooser to offer besides a blank issue. */
export const hasChoices = (info: NewIssueInfo) => info.templates.length + info.forms.length + info.contactLinks.length > 0;

/**
 * The `createIssue` input. Someone who can triage sets labels and assignees outright (the template's are
 * where they start). Anyone else names the template, so GitHub applies its labels and assignees, which an
 * explicit list from them would silently drop.
 */
export function createInput(
  info: Pick<NewIssueInfo, 'id' | 'canTriage'>,
  form: { title: string; body: string; template?: IssueTemplate; labels: IssueLabel[]; assignees: Assignee[] },
) {
  const base = { repositoryId: info.id, title: form.title.trim(), body: form.body };
  if (info.canTriage) return { ...base, labelIds: form.labels.map((l) => l.id), assigneeIds: form.assignees.map((a) => a.id) };
  return form.template ? { ...base, issueTemplate: form.template.name } : base;
}

export const CREATE_ISSUE = /* GraphQL */ `
  mutation CreateIssue($input: CreateIssueInput!) { createIssue(input: $input) { issue { url } } }
`;

export type CreatedIssue = { createIssue: { issue: { url: string } } };

const LABELS_QUERY = /* GraphQL */ `
  query NewIssueLabels($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) { labels(first: 100, orderBy: { field: NAME, direction: ASC }) { nodes { id name color description } } }
  }
`;

/** The repo's labels, for the label picker and for resolving `?labels=` (triagers only). */
export const repoLabelsQuery = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ['repo-labels', owner.toLowerCase(), repo.toLowerCase()],
    queryFn: async () => {
      const data = await gql<{ repository: { labels: { nodes: (IssueLabel & { description: string | null })[] } } | null }>(LABELS_QUERY, { owner, repo });
      return data.repository?.labels.nodes ?? [];
    },
    staleTime: 60_000,
  });

const ASSIGNABLE_QUERY = /* GraphQL */ `
  query NewIssueAssignable($owner: String!, $repo: String!, $q: String!) {
    repository(owner: $owner, name: $repo) { assignableUsers(first: 20, query: $q) { nodes { id login name avatarUrl } } }
  }
`;

/** People who can be assigned, matching `q` by login or name; for the assignee picker and `?assignees=`. */
export const assignableQuery = (owner: string, repo: string, q: string) =>
  queryOptions({
    queryKey: ['assignable', owner.toLowerCase(), repo.toLowerCase(), q],
    queryFn: async () => {
      const data = await gql<{ repository: { assignableUsers: { nodes: (Assignee & { name: string | null })[] } } | null }>(ASSIGNABLE_QUERY, { owner, repo, q });
      return data.repository?.assignableUsers.nodes ?? [];
    },
    staleTime: 60_000,
  });
