import { useEffect, type ReactNode } from 'react';
import { createStore } from '@/lib/store';

export type Command = {
  id: string;
  title: string;
  group: string;
  icon?: ReactNode;
  hint?: string;
  keywords?: string;
  perform: () => void;
};

// Pages register context actions (merge, approve…) that the ⌘K palette lists.
const registry = new Map<string, Command[]>();
export const registeredCommands = createStore<Command[]>([]);

export function useRegisterCommands(scope: string, commands: Command[]) {
  useEffect(() => {
    registry.set(scope, commands);
    registeredCommands.set([...registry.values()].flat());
    return () => {
      registry.delete(scope);
      registeredCommands.set([...registry.values()].flat());
    };
  }, [scope, commands]);
}

export const paletteOpen = createStore(false);
