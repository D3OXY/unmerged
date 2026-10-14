import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { gql } from '@/github/client';
import { toast } from '@/ui/toast';

type Vars = { query: string; variables: Record<string, unknown>; success?: string };

/** Runs one of the PR `MUTATIONS`, toasts the outcome, and refetches the PR. One instance per button keeps spinners separate. */
export function usePrMutation(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ query, variables }: Vars) => gql(query, variables),
    onSuccess: (_, { success }) => {
      if (success) toast.success(success);
      return queryClient.invalidateQueries({ queryKey });
    },
    onError: toast.error,
  });
}
