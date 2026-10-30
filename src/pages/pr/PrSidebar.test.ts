import { describe, expect, it } from 'vitest';
import { participantsOf, pickerOptions } from './PrSidebar';

const ada = { value: 'U1', label: 'ada' };
const bob = { value: 'U2', label: 'bob' };
const cy = { value: 'U3', label: 'cy' };

describe('pickerOptions', () => {
  it('lists the selection first, then candidates, each once', () => {
    expect(pickerOptions([bob], [ada, bob, cy], '', [])).toEqual([bob, ada, cy]);
  });

  it('only lists matches while searching, selected or not', () => {
    expect(pickerOptions([bob], [cy], 'c', [])).toEqual([cy]);
  });

  it('leaves out hidden labels, even when selected', () => {
    expect(pickerOptions([ada], [ada, bob, cy], '', ['ada', 'cy', undefined])).toEqual([bob]);
  });
});

describe('participantsOf', () => {
  const person = (login: string) => ({ login, avatarUrl: `${login}.png` });
  const thread = (...logins: string[]) => ({ comments: { nodes: logins.map((login) => ({ author: person(login) })) } });

  it('lists the author, then commenters, reviewers and thread commenters, each once, in order of first appearance', () => {
    const pr = { author: person('ada'), reviewThreads: { nodes: [thread('cy', 'ada'), thread('dan')] } } as Parameters<typeof participantsOf>[0];
    const timeline = [
      { __typename: 'IssueComment', author: person('bob') },
      { __typename: 'PullRequestReview', author: person('cy') },
      { __typename: 'LabeledEvent' },
      { __typename: 'IssueComment', author: null },
    ];
    expect(participantsOf(pr, timeline).map((p) => p.login)).toEqual(['ada', 'bob', 'cy', 'dan']);
  });
});
