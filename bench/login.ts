import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { SESSION } from './run.ts';

// Opens a browser window on github.com/login. Sign in there (2FA included); once github.com knows who you are, the
// session is saved to bench/.auth/github.json (git ignores it) and `pnpm bench` loads both sides signed in.
// It's a full GitHub session: keep the file private, and delete it (or sign out of that session on GitHub) when done.

const browser = await chromium.launch({ channel: 'chromium', headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://github.com/login');
console.log('Sign in to GitHub in the browser window. Waiting up to 5 minutes…');
await page.waitForFunction(() => !!document.querySelector('meta[name="user-login"]')?.getAttribute('content'), null, { timeout: 300_000, polling: 1000 });
mkdirSync(dirname(SESSION), { recursive: true });
await context.storageState({ path: SESSION });
console.log(`Saved the session to ${SESSION}`);
await browser.close();
