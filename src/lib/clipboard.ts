import { toast } from '@/ui/toast';

/** Copies text and confirms with a toast ("Copied branch name"). */
export const copy = (text: string, label: string) =>
  navigator.clipboard.writeText(text).then(() => toast.success(`Copied ${label}`), toast.error);
