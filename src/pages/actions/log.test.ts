import { describe, expect, it } from 'vitest';
import { ansiSpans, splitLog, type StepTiming } from './log';

const step = (number: number, start: string, end: string, conclusion = 'success'): StepTiming => ({
  number,
  conclusion,
  started_at: `2026-10-17T07:${start}Z`,
  completed_at: `2026-10-17T07:${end}Z`,
});

/** Log lines stamped like the runner's, from [mm:ss.fff, text] pairs. */
const log = (...lines: [string, string][]) => `﻿${lines.map(([time, text]) => `2026-10-17T07:${time}0000Z ${text}`).join('\n')}\n`;

const texts = (split: Map<number, { text: string }[]>) => Object.fromEntries([...split].map(([n, lines]) => [n, lines.map((l) => l.text)]));

describe('splitLog', () => {
  it('starts a step at its first line when several steps begin in the same second', () => {
    const steps = [step(1, '00:20', '00:20'), step(2, '00:20', '00:20'), step(3, '00:20', '00:28')];
    const split = splitLog(log(['00:20.456', 'Current runner version'], ['00:20.705', '##[group]Run ./setup.sh'], ['00:20.771', '##[group]Run actions/checkout@v6'], ['00:21.000', 'Fetching']), steps);
    expect(texts(split)).toEqual({ 1: ['Current runner version'], 2: ['Run ./setup.sh'], 3: ['Run actions/checkout@v6', 'Fetching'] });
  });

  it('keeps a composite action’s inner steps in the step that ran it', () => {
    const steps = [step(1, '07:28', '07:28'), step(2, '07:28', '07:29')];
    const split = splitLog(
      log(
        ['07:28.270', '##[group]Run ./.github/actions/setup'],
        ['07:28.271', '##[endgroup]'],
        ['07:28.275', '##[start-action display=Install;id=__self.__run]'],
        ['07:28.276', '##[group]Run apt-get install'],
        ['07:28.308', '##[end-action id=__self.__run;outcome=success]'],
        ['07:28.310', '##[group]Run vp install'],
      ),
      steps,
    );
    expect(texts(split)).toEqual({ 1: ['Run ./.github/actions/setup', 'Run apt-get install'], 2: ['Run vp install'] });
  });

  it('moves on once a step has ended, and gives skipped steps no log', () => {
    const steps = [step(1, '08:32', '08:35'), step(2, '08:35', '08:35', 'skipped'), step(22, '08:35', '09:13', 'failure')];
    const split = splitLog(log(['08:35.900', 'tsc done'], ['08:56.525', 'Cache not saved'], ['08:56.536', 'node:events:487']), steps);
    expect(texts(split)).toEqual({ 1: ['tsc done'], 22: ['Cache not saved', 'node:events:487'] });
  });

  it('numbers lines per step, folds groups and reads the runner’s commands', () => {
    const [lines] = splitLog(
      log(
        ['00:01.000', '##[group]Run pnpm test'],
        ['00:01.001', 'shell: bash'],
        ['00:01.002', '##[endgroup]'],
        ['00:01.003', '[command]/usr/bin/git version'],
        ['00:01.004', '##[warning]Deprecated'],
        ['00:01.005', '##[error]Process completed with exit code 1.'],
      ),
      [step(1, '00:01', '00:02', 'failure')],
    ).values();
    expect(lines).toEqual([
      { number: 1, text: 'Run pnpm test', kind: 'group' },
      { number: 2, text: 'shell: bash', group: 1 },
      { number: 3, text: '/usr/bin/git version', kind: 'command' },
      { number: 4, text: 'Deprecated', kind: 'warning' },
      { number: 5, text: 'Process completed with exit code 1.', kind: 'error' },
    ]);
  });
});

describe('ansiSpans', () => {
  it('splits text into styled spans and drops the codes', () => {
    expect(ansiSpans('\x1b[36;1mecho hi\x1b[0m done')).toEqual([{ text: 'echo hi', fg: 'var(--log-cyan)', bold: true }, { text: ' done' }]);
  });

  it('reads 256-color and true-color codes', () => {
    expect(ansiSpans('\x1b[38;5;196ma\x1b[48;2;1;2;3mb\x1b[39mc')).toEqual([
      { text: 'a', fg: 'rgb(255 0 0)' },
      { text: 'b', fg: 'rgb(255 0 0)', bg: 'rgb(1 2 3)' },
      { text: 'c', bg: 'rgb(1 2 3)' },
    ]);
  });

  it('drops other escape sequences', () => {
    expect(ansiSpans('\x1b[2Kprogress\x1b[1A')).toEqual([{ text: 'progress' }]);
  });
});
