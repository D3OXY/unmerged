// The diff highlighting workers' host (see highlightPool in src/entrypoints/diffs.ts). github.com can't start a
// worker from the extension's files; this page can. Each port that github.com sends gets one worker, and
// messages pass both ways between the two.
addEventListener('message', (event) => {
  if (event.source !== parent || event.origin !== 'https://github.com') return;
  for (const port of event.ports) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    port.onmessage = ({ data }) => worker.postMessage(data);
    worker.onmessage = ({ data }) => port.postMessage(data);
  }
});
