import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { gql } from '@/github/client';
import { toast } from '@/ui/toast';
import { toastNextReview } from './nextReview';

type Vars = {
  query: string;
  variables: Record<string, unknown>;
  success?: string;
  /** The PR's URL when this finishes the viewer's part (approve, request changes, merge): the toast offers the next review. */
  nextAfter?: string;
};

/** Runs one of the PR `MUTATIONS`, toasts the outcome, and refetches the PR. One instance per button keeps spinners separate. */
export function usePrMutation(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ query, variables }: Vars) => gql(query, variables),
    onSuccess: (_, { success, nextAfter }) => {
      if (success && nextAfter) toastNextReview(queryClient, success, nextAfter);
      else if (success) toast.success(success);
      return queryClient.invalidateQueries({ queryKey });
    },
    onError: toast.error,
  });
}
