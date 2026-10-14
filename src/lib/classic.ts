// "Classic view" escape hatch: remembers one path per tab that should render as stock GitHub.
const KEY = 'unmerged:classic';

export const classicPath = () => sessionStorage.getItem(KEY);

export function openClassic() {
  sessionStorage.setItem(KEY, location.pathname);
  location.reload();
}

export function leaveClassic() {
  sessionStorage.removeItem(KEY);
  location.reload();
}

/** Forget the classic flag once the user has moved to another path. */
export function clearClassicUnless(pathname: string) {
  if (classicPath() !== pathname) sessionStorage.removeItem(KEY);
}
