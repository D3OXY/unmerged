/** Login of the user signed in to github.com: a string, '' when signed out, null before <head> is parsed. */
export function sessionLogin(): string | null {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="user-login"]');
  return meta ? meta.content : null;
}
