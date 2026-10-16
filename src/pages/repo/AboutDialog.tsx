import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { rest } from '@/github/client';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { toast } from '@/ui/toast';
import { repoAboutQuery, repoQuery, type Repo } from './query';

const FIELD = 'rounded-lg border border-line bg-bg px-2.5 text-[13px] outline-none placeholder:text-subtle focus:border-accent/60';

/** Edits a repo's description, website and topics (what GitHub's gear on About opens); admins only. */
export function AboutDialog({ repo, topics, onClose }: { repo: Repo; topics: string[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [owner, name] = repo.nameWithOwner.split('/') as [string, string];
  const [description, setDescription] = useState(repo.description ?? '');
  const [homepage, setHomepage] = useState(repo.homepageUrl ?? '');
  const [topicText, setTopicText] = useState(topics.join(' '));

  // Two REST calls: GraphQL's `homepageUrl` is a URI and can't be cleared with an empty string.
  const save = useMutation({
    mutationFn: () =>
      Promise.all([
        rest<{ description: string | null; homepage: string | null }>(`/repos/${repo.nameWithOwner}`, {
          method: 'PATCH',
          body: { description: description.trim(), homepage: homepage.trim() },
        }),
        rest<{ names: string[] }>(`/repos/${repo.nameWithOwner}/topics`, {
          method: 'PUT',
          body: { names: [...new Set(topicText.toLowerCase().split(/[\s,]+/).filter(Boolean))] },
        }),
      ]),
    onSuccess: ([updated, { names }]) => {
      queryClient.setQueryData(repoQuery(owner, name).queryKey, (d) =>
        d?.repository ? { repository: { ...d.repository, description: updated.description || null, homepageUrl: updated.homepage || null } } : d,
      );
      queryClient.setQueryData(repoAboutQuery(owner, name).queryKey, (d) => d && { ...d, repositoryTopics: { nodes: names.map((n) => ({ topic: { name: n } })) } });
      onClose();
    },
    onError: (error) => {
      toast.error(error);
      // One of the two may have gone through.
      queryClient.invalidateQueries({ queryKey: repoQuery(owner, name).queryKey });
      queryClient.invalidateQueries({ queryKey: repoAboutQuery(owner, name).queryKey });
    },
  });

  return (
    <Modal label="Edit repository details" onClose={onClose} className="w-[440px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <header className="flex items-center px-4 pt-4 pb-3">
          <span className="flex-1 text-[14px] font-semibold tracking-tight">Edit repository details</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field label="Description">
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.currentTarget.form?.requestSubmit()}
              rows={3}
              placeholder="Short description of this repository"
              className={`${FIELD} resize-none py-2 leading-relaxed`}
            />
          </Field>
          <Field label="Website">
            <input value={homepage} onChange={(e) => setHomepage(e.target.value)} placeholder="https://example.com" className={`${FIELD} h-8`} />
          </Field>
          <Field label="Topics" hint="Separate with spaces or commas">
            <input value={topicText} onChange={(e) => setTopicText(e.target.value)} placeholder="react typescript" className={`${FIELD} h-8`} />
          </Field>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save changes
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[12px] font-medium text-muted">
        {label}
        {hint && <span className="font-normal text-subtle">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
