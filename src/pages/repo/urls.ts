/** Repo URLs. Refs keep their slashes (GitHub resolves them); path segments are encoded. */
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const treeUrl = (nameWithOwner: string, ref: string, path = '') => `/${nameWithOwner}/tree/${ref}${path ? `/${encodePath(path)}` : ''}`;

export const blobUrl = (nameWithOwner: string, ref: string, path: string) => `/${nameWithOwner}/blob/${ref}/${encodePath(path)}`;

export const rawUrl = (nameWithOwner: string, ref: string, path: string) => `https://github.com/${nameWithOwner}/raw/${ref}/${encodePath(path)}`;

export const commitsUrl = (nameWithOwner: string, ref: string, path = '') => `/${nameWithOwner}/commits/${ref}${path ? `/${encodePath(path)}` : ''}`;
