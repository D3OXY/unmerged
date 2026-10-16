import { useMutation } from '@tanstack/react-query';
import { UserCheck, UserPlus } from 'lucide-react';
import { gql } from '@/github/client';
import { Button } from '@/ui/Button';
import { toast } from '@/ui/toast';

const FOLLOW = /* GraphQL */ `mutation Follow($id: ID!) { followUser(input: { userId: $id }) { clientMutationId } }`;
const UNFOLLOW = /* GraphQL */ `mutation Unfollow($id: ID!) { unfollowUser(input: { userId: $id }) { clientMutationId } }`;

/** Follow/unfollow toggle. `onToggled` gets the new state so the caller can patch its cached data. */
export function FollowButton({ user, onToggled }: { user: { id: string; viewerIsFollowing: boolean }; onToggled: (following: boolean) => void }) {
  const follow = useMutation({
    mutationFn: () => gql(user.viewerIsFollowing ? UNFOLLOW : FOLLOW, { id: user.id }),
    onSuccess: () => onToggled(!user.viewerIsFollowing),
    onError: toast.error,
  });
  return (
    <Button
      size="sm"
      variant={user.viewerIsFollowing ? 'secondary' : 'primary'}
      loading={follow.isPending}
      icon={user.viewerIsFollowing ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
      onClick={() => follow.mutate()}
    >
      {user.viewerIsFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}
