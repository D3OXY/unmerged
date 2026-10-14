// Shapes shared by several queries. Page-specific result types live next to their queries.

export type Actor = { login: string; avatarUrl: string } | null;

export type CheckState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED';

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

export type PrState = 'OPEN' | 'CLOSED' | 'MERGED';

export type Label = { name: string; color: string };

export type Language = { name: string; color: string | null } | null;

export const REPO_CARD_FIELDS = /* GraphQL */ `
  fragment RepoCard on Repository {
    id name nameWithOwner description url stargazerCount forkCount isPrivate isArchived isFork pushedAt
    primaryLanguage { name color }
  }
`;

export type RepoCard = {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  pushedAt: string | null;
  primaryLanguage: Language;
};
