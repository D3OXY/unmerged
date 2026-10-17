import { useState } from 'react';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ArrowUpRight01Icon, FileEditIcon, Link04Icon, Settings02Icon } from '@hugeicons/core-free-icons';
import { gql } from '@/github/client';
import { emitNavigate } from '@/lib/navigation';
import { useDebounced } from '@/lib/useDebounced';
import { useTitle } from '@/lib/useTitle';
import { Card, Field, Person } from '@/pages/pr/PrSidebar';
import { LoadError } from '@/pages/repo/LoadError';
import { RepoFrame } from '@/pages/repo/RepoFrame';
import { repoQuery } from '@/pages/repo/query';
import { Button } from '@/ui/Button';
import { CommentBox } from '@/ui/CommentBox';
import { Menu, type MenuOption } from '@/ui/Menu';
import { Kbd, Panel, Pill, Skeleton } from '@/ui/primitives';
import { toast } from '@/ui/toast';
import {
  assignableQuery,
  CREATE_ISSUE,
  createInput,
  hasChoices,
  newIssueQuery,
  prefillOf,
  repoLabelsQuery,
  viewOf,
  type Assignee,
  type CreatedIssue,
  type IssueLabel,
  type IssueTemplate,
  type NewIssueInfo,
  type Prefill,
} from './newIssue';

type Props = { owner: string; repo: string; choose: boolean; search: string };

/** `/owner/repo/issues/new` and `/issues/new/choose`: the template chooser, or the form, under the repo's frame. */
export function NewIssuePage({ owner, repo, choose, search }: Props) {
  useTitle(`New issue · ${owner}/${repo}`);
  const { data: info, error, refetch } = useQuery(newIssueQuery(owner, repo));
  const prefill = prefillOf(search);
  const view = info && viewOf(info, prefill, choose);

  return (
    <RepoFrame owner={owner} name={repo} view="issues" item="New issue">
      {view ? (
        view.choose ? (
          <Chooser owner={owner} repo={repo} info={info} />
        ) : (
          <NewIssueForm owner={owner} repo={repo} info={info} template={view.template} prefill={prefill} />
        )
      ) : error ? (
        <LoadError what="the new issue form" error={error} retry={refetch} />
      ) : (
        // Null info is a missing repo, which the frame reports.
        info === undefined && <Skeleton className="h-80 max-w-[860px] rounded-xl" />
      )}
    </RepoFrame>
  );
}

/** GitHub's template chooser: Markdown templates (ours), YAML forms (GitHub's page), contact links, blank. */
function Chooser({ owner, repo, info }: { owner: string; repo: string; info: NewIssueInfo }) {
  const base = `/${owner}/${repo}/issues/new`;
  const withTemplate = (filename: string) => `${base}?template=${encodeURIComponent(filename)}`;
  return (
    <div className="max-w-[860px]">
      <h1 className="text-[24px] leading-tight font-semibold tracking-tight">New issue</h1>
      <p className="mt-1.5 text-[13px] text-muted">Pick a template to start from.</p>
      <Panel className="mt-6 flex flex-col divide-y divide-line overflow-hidden">
        {info.templates.map((t) => (
          <Choice key={t.filename} href={withTemplate(t.filename)} icon={FileEditIcon} name={t.name} about={t.about} />
        ))}
        {info.forms.map((f) => (
          <Choice key={f.filename} href={withTemplate(f.filename)} icon={FileEditIcon} name={f.name} about={f.about} external="Opens GitHub's form" />
        ))}
        {info.contactLinks.map((link) => (
          <Choice key={link.url} href={link.url} icon={Link04Icon} name={link.name} about={link.about} external={new URL(link.url).host} />
        ))}
        {info.blankAllowed && <Choice href={`${base}?template=`} icon={FileEditIcon} name="Blank issue" about="Start from scratch." />}
      </Panel>
    </div>
  );
}

function Choice({ href, icon, name, about, external }: { href: string; icon: typeof FileEditIcon; name: string; about: string | null; external?: string }) {
  return (
    <a href={href} className="group flex items-center gap-3 px-4 py-3 hover:bg-hover">
      <HugeiconsIcon icon={icon} className="size-4 shrink-0 text-subtle" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{name}</span>
        {about && <span className="mt-0.5 block text-[12.5px] text-muted">{about}</span>}
      </span>
      {external && <span className="shrink-0 text-[12px] text-subtle">{external}</span>}
      <HugeiconsIcon icon={external ? ArrowUpRight01Icon : ArrowRight01Icon} className="size-3.5 shrink-0 text-subtle group-hover:text-fg" />
    </a>
  );
}

/**
 * Title and Markdown body, started from the template and the URL's `?title=` / `?body=`. Viewers who can
 * triage also pick labels and assignees (from the template and `?labels=` / `?assignees=` to begin with).
 * Creating it opens the new issue in place of this page.
 */
function NewIssueForm({ owner, repo, info, template, prefill }: { owner: string; repo: string; info: NewIssueInfo; template?: IssueTemplate; prefill: Prefill }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(prefill.title || template?.title || '');
  const [body, setBody] = useState(prefill.body || template?.body || '');

  // `?labels=` and `?assignees=` name them; the mutation needs their ids. Only triagers can set them.
  const repoLabels = useQuery({ ...repoLabelsQuery(owner, repo), enabled: info.canTriage });
  const assigneeMatches = useQueries({ queries: info.canTriage ? prefill.assignees.map((login) => assignableQuery(owner, repo, login)) : [] });
  // Null until the viewer edits them; until then they follow the template and the URL as those resolve.
  const [labelEdits, setLabels] = useState<IssueLabel[] | null>(null);
  const [assigneeEdits, setAssignees] = useState<Assignee[] | null>(null);
  const labels =
    labelEdits ?? byId([...(template?.labels.nodes ?? []), ...(repoLabels.data ?? []).filter((l) => prefill.labels.some((n) => n.toLowerCase() === l.name.toLowerCase()))]);
  const assignees =
    assigneeEdits ??
    byId([...(template?.assignees.nodes ?? []), ...assigneeMatches.flatMap((q, i) => q.data?.filter((u) => u.login.toLowerCase() === prefill.assignees[i]!.toLowerCase()) ?? [])]);

  const create = useMutation({
    mutationFn: () => gql<CreatedIssue>(CREATE_ISSUE, { input: createInput(info, { title, body, template, labels, assignees }) }),
    onSuccess: ({ createIssue: { issue } }) => {
      queryClient.invalidateQueries({ queryKey: repoQuery(owner, repo).queryKey });
      // Replaces this entry, like GitHub's redirect: Back shouldn't return to a form that was already sent.
      history.replaceState(null, '', issue.url);
      emitNavigate(new URL(issue.url));
      window.scrollTo(0, 0);
    },
    onError: toast.error,
  });
  const submit = () => {
    if (title.trim() && !create.isPending) create.mutate();
  };

  const showDetails = info.canTriage || labels.length + assignees.length > 0;

  return (
    <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[24px] leading-tight font-semibold tracking-tight">New issue</h1>
          {template && <span className="text-[13px] text-muted">{template.name}</span>}
          {hasChoices(info) && (
            <a href={`/${owner}/${repo}/issues/new/choose`} className="text-[13px] text-accent hover:underline">
              {template ? 'Change template' : 'Choose a template'}
            </a>
          )}
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
            e.preventDefault();
            submit();
          }}
          placeholder="Title"
          aria-label="Title"
          className="h-10 rounded-xl border border-line bg-panel px-3.5 text-[14px] font-medium outline-none placeholder:font-normal placeholder:text-subtle focus:border-line-strong"
        />
        <CommentBox value={body} onChange={setBody} onSubmit={submit} rows={16} placeholder="Describe the issue… Markdown supported">
          <Button className="ml-auto" size="sm" variant="primary" disabled={!title.trim()} loading={create.isPending} onClick={submit}>
            Create issue
            <span className="flex gap-0.5 opacity-70">
              <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">⌘</Kbd>
              <Kbd className="h-4 min-w-4 border-white/25 bg-white/10 text-[10px] text-white">↵</Kbd>
            </span>
          </Button>
        </CommentBox>
      </div>
      {showDetails && (
        <aside className="flex flex-col gap-4 @3xl:sticky @3xl:top-[108px] @3xl:self-start">
          <Card title="Details">
            <Field
              label="Assignees"
              action={
                info.canTriage && (
                  <AssigneePicker owner={owner} repo={repo} selected={assignees} onToggle={(u) => setAssignees(toggle(assignees, u))} />
                )
              }
            >
              {assignees.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
              {assignees.map((a) => (
                <Person key={a.id} name={a.login} avatarUrl={a.avatarUrl} />
              ))}
            </Field>
            <Field
              label="Labels"
              action={
                info.canTriage && (
                  <LabelPicker labels={repoLabels.data ?? []} selected={labels} onToggle={(l) => setLabels(toggle(labels, l))} />
                )
              }
            >
              {labels.length === 0 && <span className="px-2 text-[12.5px] text-subtle">None</span>}
              <div className="flex flex-wrap gap-1.5 px-2 pt-0.5">
                {labels.map((l) => (
                  <Pill key={l.id} color={l.color}>
                    {l.name}
                  </Pill>
                ))}
              </div>
            </Field>
            {!info.canTriage && <p className="px-2 pt-1 pb-1 text-[11.5px] text-subtle">Added by the template.</p>}
          </Card>
        </aside>
      )}
    </div>
  );
}

const byId = <T extends { id: string }>(items: T[]) => items.filter((item, i) => items.findIndex((x) => x.id === item.id) === i);
const toggle = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.filter((x) => x.id !== item.id) : [...list, item]);

/** The label picker: the repo's labels, filtered as you type. */
function LabelPicker({ labels, selected, onToggle }: { labels: (IssueLabel & { description: string | null })[]; selected: IssueLabel[]; onToggle: (label: IssueLabel) => void }) {
  const [search, setSearch] = useState('');
  const text = search.trim().toLowerCase();
  const options = byId<IssueLabel & { description?: string | null }>([...(text ? [] : selected), ...labels.filter((l) => l.name.toLowerCase().includes(text))]);
  return (
    <Picker
      title="Edit labels"
      placeholder="Filter labels"
      options={options.map((l) => ({ value: l.id, label: l.name, hint: l.description ?? undefined }))}
      selected={selected.map((l) => l.id)}
      onToggle={(id) => onToggle(options.find((l) => l.id === id)!)}
      search={search}
      onSearch={setSearch}
    />
  );
}

/** The assignee picker: searches the repo's assignable people as you type, once first opened. */
function AssigneePicker({ owner, repo, selected, onToggle }: { owner: string; repo: string; selected: Assignee[]; onToggle: (user: Assignee) => void }) {
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState(false);
  const q = useDebounced(search.trim(), 200);
  const candidates = useQuery({ ...assignableQuery(owner, repo, q), enabled: opened, placeholderData: keepPreviousData });
  const options = byId<Assignee & { name?: string | null }>([...(search ? [] : selected), ...(candidates.data ?? [])]);
  return (
    <Picker
      title="Assign people"
      placeholder="Search people"
      options={options.map((u) => ({ value: u.id, label: u.login, hint: u.name ?? undefined }))}
      selected={selected.map((a) => a.id)}
      onToggle={(id) => onToggle(options.find((u) => u.id === id)!)}
      search={search}
      onSearch={setSearch}
      onOpen={() => setOpened(true)}
      busy={candidates.isFetching}
    />
  );
}

/** Multi-select menu behind a gear, with a search field above the options (like the PR sidebar's). */
function Picker({
  title,
  placeholder,
  options,
  selected,
  onToggle,
  search,
  onSearch,
  onOpen,
  busy,
}: {
  title: string;
  placeholder: string;
  options: MenuOption<string>[];
  selected: string[];
  onToggle: (id: string) => void;
  search: string;
  onSearch: (text: string) => void;
  onOpen?: () => void;
  busy?: boolean;
}) {
  return (
    <Menu<string>
      value={selected}
      options={options}
      onChange={onToggle}
      header={
        <div className="p-1 pb-1.5">
          <input
            autoFocus
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent/60"
          />
          {options.length === 0 && <p className="px-1.5 pt-2 text-[12px] text-subtle">{busy ? 'Searching…' : 'No matches'}</p>}
        </div>
      }
      trigger={(open) => (
        <button
          type="button"
          aria-label={title}
          title={title}
          onClick={() => {
            onOpen?.();
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
