import changesetsChangelog from '@changesets/cli/changelog';

/** Keep CHANGELOG.md to the user-visible line: no commit hashes, no dependency bumps. */
async function getReleaseLine(changeset, type, options) {
  return changesetsChangelog.getReleaseLine({ ...changeset, commit: undefined }, type, options);
}

async function getDependencyReleaseLine() {
  return '';
}

export default { getReleaseLine, getDependencyReleaseLine };
