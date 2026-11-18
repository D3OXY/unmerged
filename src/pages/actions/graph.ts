import type { Job } from './query';
import type { WorkflowJob } from './workflow';

/**
 * A card in the run graph: one job, or all the jobs of a matrix or a reusable workflow call under `title`.
 * `needs` are the cards it waits for, without those that another of them already waits for.
 */
export type GraphNode = { id: string; title?: string; jobs: { job: Job; label: string }[]; needs: string[] };

/**
 * The run's jobs as a graph, in levels from the top: a card's level is one below the lowest card that it
 * waits for. Null when nothing waits for anything, which a list shows as well. Each level is in an order that
 * keeps lines short: the first job's place in `jobs`, then sorted a few times by where the cards' neighbours are.
 */
export function runGraph(workflow: WorkflowJob[], jobs: Job[]): GraphNode[][] | null {
  const { matched, unmatched } = matchJobs(workflow, jobs);
  const byId = new Map(workflow.map((job) => [job.id, job]));

  // What a card waits for. A job without a card in this run (not run, or not matched) passes on what it waits for.
  const resolved = new Map<string, string[]>();
  const needsOf = (id: string, seen = new Set<string>()): string[] => {
    const known = resolved.get(id);
    if (known) return known;
    if (seen.has(id)) return [];
    seen.add(id);
    const needs = [...new Set((byId.get(id)?.needs ?? []).flatMap((need) => (matched.has(need) ? [need] : needsOf(need, seen))))];
    resolved.set(id, needs);
    return needs;
  };

  // Everything a card waits for, also through other cards.
  const ancestors = new Map<string, Set<string>>();
  const ancestorsOf = (id: string, seen = new Set<string>()): Set<string> => {
    const known = ancestors.get(id);
    if (known) return known;
    const all = new Set<string>();
    if (!seen.has(id)) {
      seen.add(id);
      for (const need of needsOf(id)) {
        all.add(need);
        for (const up of ancestorsOf(need, seen)) all.add(up);
      }
    }
    ancestors.set(id, all);
    return all;
  };

  const nodes: GraphNode[] = [
    ...workflow.flatMap((source) => {
      const runs = matched.get(source.id);
      if (!runs) return [];
      const all = needsOf(source.id);
      return [{ ...nodeOf(source, runs), needs: all.filter((need) => !all.some((other) => other !== need && ancestorsOf(other).has(need))) }];
    }),
    ...unmatched.map((job) => ({ id: `job-${job.id}`, jobs: [{ job, label: job.name }], needs: [] })),
  ];

  const levelOf = new Map<string, number>();
  const level = (node: GraphNode, seen = new Set<string>()): number => {
    const known = levelOf.get(node.id);
    if (known !== undefined) return known;
    if (seen.has(node.id)) return 0;
    seen.add(node.id);
    const parents = node.needs.flatMap((id) => nodes.find((n) => n.id === id) ?? []);
    const value = parents.length ? 1 + Math.max(...parents.map((parent) => level(parent, seen))) : 0;
    levelOf.set(node.id, value);
    return value;
  };
  const depth = Math.max(0, ...nodes.map((node) => level(node)));
  if (depth === 0) return null;

  const first = (node: GraphNode) => Math.min(...node.jobs.map(({ job }) => jobs.indexOf(job)));
  const levels = Array.from({ length: depth + 1 }, (_, l) => nodes.filter((node) => levelOf.get(node.id) === l).sort((a, b) => first(a) - first(b)));
  orderLevels(levels);
  return levels;
}

/**
 * Sorts each level by the mean place of the cards it connects to (the barycenter method): down the graph by
 * what each card waits for, then up by what waits for it. Places count as fractions of their level's width, so
 * levels of different sizes compare.
 */
function orderLevels(levels: GraphNode[][]) {
  const place = new Map<string, number>();
  const measure = () => levels.forEach((level) => level.forEach((node, i) => place.set(node.id, (i + 0.5) / level.length)));
  const children = new Map<string, string[]>();
  for (const node of levels.flat()) for (const need of node.needs) children.set(need, [...(children.get(need) ?? []), node.id]);

  const sortBy = (level: GraphNode[], neighbours: (node: GraphNode) => string[]) => {
    const key = new Map(
      level.map((node) => {
        const places = neighbours(node).flatMap((id) => place.get(id) ?? []);
        return [node.id, places.length ? places.reduce((sum, p) => sum + p, 0) / places.length : (place.get(node.id) ?? 0)];
      }),
    );
    level.sort((a, b) => (key.get(a.id) ?? 0) - (key.get(b.id) ?? 0));
  };

  measure();
  for (let round = 0; round < 2; round++) {
    for (const level of levels.slice(1)) {
      sortBy(level, (node) => node.needs);
      measure();
    }
    for (const level of levels.slice(0, -1).reverse()) {
      sortBy(level, (node) => children.get(node.id) ?? []);
      measure();
    }
  }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * How GitHub names a workflow job's runs. `${{ }}` in the name can be anything. A matrix adds " (a, b)" when the
 * name doesn't use it; a reusable workflow call names its jobs "<caller> / <callee job>", or just "<caller>" when
 * it never started. `weight` (the name's fixed text) picks the closest of the names that match.
 */
function namePattern({ id, name = id, uses }: WorkflowJob) {
  const fixed = name.split(/\$\{\{.*?\}\}/);
  const pattern = new RegExp(`^(${fixed.map(escapeRegExp).join('.*?')}(?: \\(.*\\))?)${uses ? '(?: / (.+))?' : ''}$`, 's');
  return { pattern, weight: fixed.join('').length };
}

/** Finds which workflow job each of the run's jobs came from; jobs that match none are left out. */
function matchJobs(workflow: WorkflowJob[], jobs: Job[]) {
  const patterns = workflow.map((job) => ({ job, ...namePattern(job) }));
  const matched = new Map<string, { job: Job; caller: string; label: string }[]>();
  const unmatched: Job[] = [];
  for (const job of jobs) {
    let best: { id: string; caller: string; label: string; weight: number } | undefined;
    for (const { job: source, pattern, weight } of patterns) {
      const match = pattern.exec(job.name);
      if (match && (!best || weight > best.weight)) best = { id: source.id, caller: match[1] ?? '', label: match[2] ?? job.name, weight };
    }
    if (!best) unmatched.push(job);
    else matched.set(best.id, [...(matched.get(best.id) ?? []), { job, caller: best.caller, label: best.label }]);
  }
  return { matched, unmatched };
}

/** A workflow job's card: its title, and each job's label under it. */
function nodeOf(source: WorkflowJob, jobs: { job: Job; caller: string; label: string }[]): Omit<GraphNode, 'needs'> {
  const [first] = jobs;
  // One call (not a matrix of calls) titles its jobs with the caller's name.
  if (source.uses && first && jobs.every((j) => j.caller === first.caller && j.label !== j.job.name)) {
    return { id: source.id, title: first.caller, jobs: jobs.map(({ job, label }) => ({ job, label })) };
  }
  return { id: source.id, title: jobs.length > 1 ? `Matrix: ${source.id}` : undefined, jobs: jobs.map(({ job }) => ({ job, label: job.name })) };
}
