import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// Release preparation. `--check` validates pending changesets (part of `pnpm check`); without it, the
// Release workflow runs this to consume them: bump the patch version in package.json (WXT reads the
// manifest version from it) and write a dated release to CHANGELOG.md.

const SUMMARY = /^\[(New|Improved|Fixed)\]\[[^\]\n]+\] \S[^\n]*$/;

/** Throws unless a changeset is a single `unmerged: patch` release with one `[Kind][Area] Summary.` line. */
export function validateChangeset(file: string, contents: string) {
  const frontmatter = contents.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatter?.[1]) throw new Error(`${file}: invalid changeset frontmatter`);

  const releases = [...frontmatter[1].matchAll(/^["']?([^"':]+)["']?:\s*(patch|minor|major)\s*$/gm)];
  if (releases.length !== 1 || releases[0]?.[1] !== 'unmerged') {
    throw new Error(`${file}: changeset must release only unmerged`);
  }
  if (releases[0][2] !== 'patch') throw new Error(`${file}: Unmerged releases are patch-only`);

  if (!SUMMARY.test(contents.slice(frontmatter[0].length).trim())) {
    throw new Error(`${file}: summary must be one line: [New|Improved|Fixed][Area] User-visible summary.`);
  }
}

/** Adds the ISO date to the heading Changesets just wrote, which must be the newest release. */
export function dateRelease(changelog: string, version: string, date: string) {
  const heading = `## ${version}`;
  if (changelog.match(/^## .*$/m)?.[0] !== heading) {
    throw new Error(`The newest CHANGELOG.md release is not ${heading}`);
  }
  return changelog.replace(heading, `${heading} (${date})`);
}

function prepare(root: string, date: string, check: boolean) {
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid release date: ${date}`);
  }

  const changesetDirectory = join(root, '.changeset');
  const files = existsSync(changesetDirectory)
    ? readdirSync(changesetDirectory).filter((file) => file.endsWith('.md') && file !== 'README.md')
    : [];
  if (files.length === 0) return console.log('No pending changesets; nothing to release.');
  for (const file of files) validateChangeset(file, readFileSync(join(changesetDirectory, file), 'utf8'));
  if (check) return console.log(`Validated ${files.length} pending changeset(s).`);

  const packagePath = join(root, 'package.json');
  const readVersion = () => (JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string }).version;
  const [major, minor, patch] = readVersion().split('.').map(Number);
  const expected = `${major}.${minor}.${Number(patch) + 1}`;

  const changesetBin = resolve(import.meta.dirname, '../../node_modules/@changesets/cli/bin.js');
  execFileSync(process.execPath, [changesetBin, 'version'], { cwd: root, stdio: 'inherit' });

  const version = readVersion();
  if (version !== expected) throw new Error(`Expected version ${expected}, got ${version}`);
  const changelogPath = join(root, 'CHANGELOG.md');
  writeFileSync(changelogPath, dateRelease(readFileSync(changelogPath, 'utf8'), version, date));
  console.log(`Prepared Unmerged ${version} (${date}).`);
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: resolve(import.meta.dirname, '../..') },
      date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
      check: { type: 'boolean', default: false },
    },
  });
  prepare(resolve(values.root), values.date, values.check);
}
