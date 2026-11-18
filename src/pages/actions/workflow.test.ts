import { describe, expect, it } from 'vitest';
import { parseWorkflowJobs } from './workflow';

describe('parseWorkflowJobs', () => {
  it('reads each job’s name, needs and reusable workflow call', () => {
    const text = `name: Release
on:
  push:
jobs:
  # Comments and blank lines are skipped.

  preflight:
    name: Preflight # trailing comment
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "needs: [nope]"
  "test-server":
    name: 'Server tests \${{ matrix.shard }}'
    needs: preflight
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]
  desktop:
    name: "Desktop \\"x64\\""
    needs: [preflight, test-server]
    uses: ./.github/workflows/desktop.yml
  release:
    needs:
      [
        preflight, # why
        desktop,
      ]
  announce:
    needs:
    - release
    - desktop
permissions:
  contents: read
`;
    expect(parseWorkflowJobs(text)).toEqual([
      { id: 'preflight', name: 'Preflight', needs: [], uses: false },
      { id: 'test-server', name: 'Server tests ${{ matrix.shard }}', needs: ['preflight'], uses: false },
      { id: 'desktop', name: 'Desktop "x64"', needs: ['preflight', 'test-server'], uses: true },
      { id: 'release', needs: ['preflight', 'desktop'], uses: false },
      { id: 'announce', needs: ['release', 'desktop'], uses: false },
    ]);
  });

  it('is null without jobs', () => {
    expect(parseWorkflowJobs('name: x\non: push\n')).toBeNull();
  });
});
