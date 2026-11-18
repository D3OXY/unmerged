import { describe, expect, it } from 'vitest';
import { runGraph } from './graph';
import type { Job } from './query';
import type { WorkflowJob } from './workflow';

const wf = (id: string, needs: string[] = [], extra: Partial<WorkflowJob> = {}): WorkflowJob => ({ id, needs, uses: false, ...extra });
const jobs = (...names: string[]): Job[] =>
  names.map((name, i) => ({ id: i + 1, name, status: 'completed', conclusion: 'success', started_at: null, completed_at: null, runner_name: null }));

/** The graph as card ids per level, and each card's needs and labels. */
const shape = (workflow: WorkflowJob[], run: Job[]) =>
  runGraph(workflow, run)?.map((level) => level.map(({ id, title, jobs, needs }) => ({ id, title, labels: jobs.map((j) => j.label), needs })));

describe('runGraph', () => {
  it('groups a matrix and a reusable workflow call, and matches the closest name', () => {
    const workflow = [
      wf('preflight', [], { name: 'Preflight' }),
      wf('test', ['preflight'], { name: 'Release tests' }),
      wf('test_server', ['preflight'], { name: 'Release server tests ${{ matrix.shard }}' }),
      wf('desktop_linux', ['preflight'], { name: 'Desktop Linux', uses: true }),
      wf('lint', ['preflight']),
    ];
    const run = jobs('Preflight', 'Release tests', 'Release server tests 2', 'Release server tests 1', 'Desktop Linux / Build Linux', 'Desktop Linux / Verify', 'lint (node, 22)', 'Someone else');
    expect(shape(workflow, run)).toEqual([
      [
        { id: 'preflight', title: undefined, labels: ['Preflight'], needs: [] },
        { id: 'job-8', title: undefined, labels: ['Someone else'], needs: [] },
      ],
      [
        { id: 'test', title: undefined, labels: ['Release tests'], needs: ['preflight'] },
        { id: 'test_server', title: 'Matrix: test_server', labels: ['Release server tests 2', 'Release server tests 1'], needs: ['preflight'] },
        { id: 'desktop_linux', title: 'Desktop Linux', labels: ['Build Linux', 'Verify'], needs: ['preflight'] },
        { id: 'lint', title: undefined, labels: ['lint (node, 22)'], needs: ['preflight'] },
      ],
    ]);
  });

  it('leaves out lines that another line already implies, and passes needs through jobs that did not run', () => {
    const workflow = [wf('a'), wf('b', ['a']), wf('skipped', ['b']), wf('c', ['a', 'b', 'skipped'])];
    expect(shape(workflow, jobs('a', 'b', 'c'))?.map((level) => level.map(({ id, needs }) => [id, needs]))).toEqual([[['a', []]], [['b', ['a']]], [['c', ['b']]]]);
  });

  it('orders a level under what it waits for', () => {
    const workflow = [wf('left'), wf('right'), wf('under_right', ['right']), wf('under_left', ['left'])];
    expect(shape(workflow, jobs('left', 'right', 'under_right', 'under_left'))?.[1]?.map((node) => node.id)).toEqual(['under_left', 'under_right']);
  });

  it('is null when no job waits for another', () => {
    expect(runGraph([wf('a'), wf('b')], jobs('a', 'b'))).toBeNull();
  });
});
