import { describe, expect, it } from 'vitest';
import { createInput, formSummary, prefillOf, viewOf, type IssueTemplate, type NewIssueInfo } from './newIssue';

const bug: IssueTemplate = {
  name: 'Bug report',
  about: null,
  title: 'Bug: ',
  body: 'Steps',
  filename: 'bug_report.md',
  labels: { nodes: [{ id: 'L1', name: 'bug', color: 'f00' }] },
  assignees: { nodes: [] },
};
const info = (changes: Partial<NewIssueInfo> = {}): NewIssueInfo => ({
  id: 'R1',
  canTriage: false,
  blankAllowed: true,
  templates: [bug],
  forms: [],
  contactLinks: [],
  ...changes,
});

describe('formSummary', () => {
  it('reads plain, quoted and block values at the top level only', () => {
    const text = [
      'name: "⚛️ Bug \\"report\\""',
      "description: 'It''s broken' # why",
      'body:',
      '  - type: input',
      '    attributes:',
      '      name: nested',
    ].join('\n');
    expect(formSummary('bug.yml', text)).toEqual({ name: '⚛️ Bug "report"', about: "It's broken", filename: 'bug.yml' });
    expect(formSummary('f.yaml', 'name: Feature # comment\ndescription: >-\n  Ask for\n  a thing\nbody: []')).toEqual({ name: 'Feature', about: 'Ask for a thing', filename: 'f.yaml' });
  });

  it('skips forms without a name', () => {
    expect(formSummary('x.yml', 'description: no name\nbody: []')).toBeNull();
  });
});

describe('prefillOf', () => {
  it('reads GitHub’s query parameters, with comma lists', () => {
    expect(prefillOf('?template=bug_report.md&title=Crash%20on%20start&body=Hi&labels=bug,%20needs%20triage,&assignees=octocat')).toEqual({
      template: 'bug_report.md',
      title: 'Crash on start',
      body: 'Hi',
      labels: ['bug', 'needs triage'],
      assignees: ['octocat'],
    });
    expect(prefillOf('')).toEqual({ template: null, title: '', body: '', labels: [], assignees: [] });
    expect(prefillOf('?template=').template).toBe('');
  });
});

describe('viewOf', () => {
  it('chooses on /choose and when nothing picks the form', () => {
    expect(viewOf(info(), prefillOf('?template=bug_report.md'), true)).toEqual({ choose: true });
    expect(viewOf(info(), prefillOf(''), false)).toEqual({ choose: true });
  });

  it('opens the named template, matching the filename case-insensitively', () => {
    expect(viewOf(info(), prefillOf('?template=BUG_REPORT.md'), false)).toEqual({ choose: false, template: bug });
  });

  it('opens a blank form when asked for one, if the repo allows it', () => {
    expect(viewOf(info(), prefillOf('?template='), false)).toEqual({ choose: false });
    expect(viewOf(info(), prefillOf('?title=Hi'), false)).toEqual({ choose: false });
    expect(viewOf(info({ blankAllowed: false }), prefillOf('?title=Hi'), false)).toEqual({ choose: true });
  });

  it('goes straight to the form in a repo without templates', () => {
    expect(viewOf(info({ templates: [] }), prefillOf(''), false)).toEqual({ choose: false });
  });
});

describe('createInput', () => {
  const form = { title: '  Crash  ', body: 'Steps', template: bug, labels: [{ id: 'L2', name: 'p1', color: '000' }], assignees: [{ id: 'U1', login: 'me', avatarUrl: '' }] };

  it('names the template for viewers who can’t triage, so GitHub applies its labels', () => {
    expect(createInput(info(), form)).toEqual({ repositoryId: 'R1', title: 'Crash', body: 'Steps', issueTemplate: 'Bug report' });
    expect(createInput(info(), { ...form, template: undefined })).toEqual({ repositoryId: 'R1', title: 'Crash', body: 'Steps' });
  });

  it('sends triagers’ labels and assignees as picked', () => {
    expect(createInput(info({ canTriage: true }), form)).toEqual({ repositoryId: 'R1', title: 'Crash', body: 'Steps', labelIds: ['L2'], assigneeIds: ['U1'] });
  });
});
