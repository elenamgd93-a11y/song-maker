import { Badge } from "@/client/components/ui/badge";
import { Spinner } from "@/client/components/ui/spinner";

const LABELS = {
  queued: "Queued",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
} as const;

export function StatusBadge({
  status,
  testId,
}: {
  status: keyof typeof LABELS;
  testId?: string;
}) {
  return (
    <Badge
      data-testid={testId}
      variant={status === "failed" ? "destructive" : status === "ready" ? "secondary" : "outline"}
    >
      {status === "queued" || status === "generating" ? <Spinner aria-hidden /> : null}
      {LABELS[status]}
    </Badge>
  );
}
