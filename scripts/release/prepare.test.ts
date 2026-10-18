// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dateRelease, validateChangeset } from './prepare';

const changeset = (release: string, summary = '[New][Pull requests] Ship the change.') =>
  `---\n${release}\n---\n\n${summary}\n`;

describe('validateChangeset', () => {
  it('accepts one patch line in the [Kind][Area] form', () => {
    expect(() => validateChangeset('a.md', changeset('"unmerged": patch'))).not.toThrow();
  });

  it('rejects minor and major bumps', () => {
    expect(() => validateChangeset('a.md', changeset('"unmerged": minor'))).toThrow(/patch-only/);
    expect(() => validateChangeset('a.md', changeset('"unmerged": major'))).toThrow(/patch-only/);
  });

  it('rejects other packages', () => {
    expect(() => validateChangeset('a.md', changeset('"site": patch'))).toThrow(/only unmerged/);
  });

  it('rejects summaries without a kind and area, or over several lines', () => {
    expect(() => validateChangeset('a.md', changeset('"unmerged": patch', 'Ship the change.'))).toThrow(/summary/);
    expect(() => validateChangeset('a.md', changeset('"unmerged": patch', '[Changed][PRs] Ship.'))).toThrow(/summary/);
    const twoLines = '[New][PRs] Ship one.\n\n[Fixed][PRs] Ship two.';
    expect(() => validateChangeset('a.md', changeset('"unmerged": patch', twoLines))).toThrow(/summary/);
  });
});

describe('dateRelease', () => {
  it('dates the newest release only', () => {
    const changelog = '# unmerged\n\n## 0.1.2\n\n- [New][PRs] A.\n\n## 0.1.1 (2026-10-01)\n';
    expect(dateRelease(changelog, '0.1.2', '2026-10-18')).toContain('## 0.1.2 (2026-10-18)\n');
    expect(() => dateRelease(changelog, '0.1.3', '2026-10-18')).toThrow(/not ## 0\.1\.3/);
  });
});

describe('prepare', () => {
  const root = resolve(import.meta.dirname, '../..');
  // A git hook exports GIT_DIR; a child git inheriting it would commit to this repository instead.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  let directory = '';
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('consumes changesets into a patch version and a dated changelog without commit hashes', () => {
    directory = mkdtempSync(join(tmpdir(), 'unmerged-release-'));
    mkdirSync(join(directory, '.changeset'));
    mkdirSync(join(directory, 'scripts/release'), { recursive: true });
    const config = JSON.parse(readFileSync(join(root, '.changeset/config.json'), 'utf8'));
    writeFileSync(join(directory, '.changeset/config.json'), JSON.stringify({ ...config, ignore: [] }));
    writeFileSync(join(directory, '.changeset/ship.md'), changeset('"unmerged": patch'));
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'unmerged', version: '0.1.0', private: true }));
    writeFileSync(join(directory, '.gitignore'), 'node_modules\n');
    copyFileSync(join(root, 'scripts/release/changelog.mjs'), join(directory, 'scripts/release/changelog.mjs'));
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, env, stdio: 'ignore' });
    git('init', '--initial-branch=main');
    git('add', '--all');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Add changeset');

    const script = join(root, 'scripts/release/prepare.ts');
    execFileSync(process.execPath, [script, '--root', directory, '--date', '2026-10-18'], { env, stdio: 'ignore' });

    expect(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version).toBe('0.1.1');
    expect(readFileSync(join(directory, 'CHANGELOG.md'), 'utf8')).toBe(
      '# unmerged\n\n## 0.1.1 (2026-10-18)\n\n### Patch Changes\n\n- [New][Pull requests] Ship the change.\n',
    );
  });
});
