import { EmptyState } from "@/client/components/EmptyState";
import { PublicShell } from "@/client/components/PublicShell";

export function LinkNotFound() {
  return (
    <PublicShell>
      <EmptyState kind="filtered" title="This link doesn't work" description="It may have been turned off." />
    </PublicShell>
  );
}
