// Organization pages stay on stock GitHub. Logins we've learned are orgs are remembered so we
// never hide an org page just to give it back.
const KEY = 'unmerged:orgs';

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export const isKnownOrg = (login: string) => read().includes(login.toLowerCase());

export function rememberOrgs(logins: string[]) {
  const all = new Set([...read(), ...logins.map((l) => l.toLowerCase())]);
  localStorage.setItem(KEY, JSON.stringify([...all]));
}
