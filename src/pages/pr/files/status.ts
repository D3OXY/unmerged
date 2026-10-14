const DOT: Record<string, string> = { added: 'bg-success', removed: 'bg-danger', deleted: 'bg-danger', renamed: 'bg-info', copied: 'bg-info' };

/** Dot color for a changed file. Accepts REST ("removed") and GraphQL ("DELETED") statuses; anything else is a modification. */
export const statusDot = (status: string) => DOT[status.toLowerCase()] ?? 'bg-warning';
