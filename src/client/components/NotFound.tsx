import { EmptyState } from "@/client/components/EmptyState";
import { PublicShell } from "@/client/components/PublicShell";

export function NotFound() {
  return (
    <PublicShell>
      <EmptyState kind="filtered" title="Page not found" />
    </PublicShell>
  );
}
