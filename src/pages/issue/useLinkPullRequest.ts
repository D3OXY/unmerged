import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from '@/ui/toast';
import { linkPullRequest } from './relations';

/** Links pull request `pr` (a node id) to issue `issue` of its repo, toasts the outcome, and refetches `queryKey`. */
export function useLinkPullRequest(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pr, issue }: { pr: string; issue: number }) => linkPullRequest(pr, issue),
    onSuccess: () => {
      toast.success('Linked');
      return queryClient.invalidateQueries({ queryKey });
    },
    onError: toast.error,
  });
}
