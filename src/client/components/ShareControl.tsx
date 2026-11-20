import { useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/client/components/CopyButton";
import { Input } from "@/client/components/ui/input";
import { Switch } from "@/client/components/ui/switch";
import { messageOf } from "@/client/lib/errors";

/** The share-link switch, and the link to copy while it's on. */
export function ShareControl({
  shareUrl,
  onChange,
}: {
  shareUrl: string | null;
  onChange: (on: boolean) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <label className="flex items-center justify-between gap-3">
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Share link</span>
          {shareUrl ? (
            <span className="block text-sm text-muted-foreground">
              Anyone with the link can listen.
            </span>
          ) : null}
        </span>
        <Switch
          aria-label="Share link"
          checked={shareUrl !== null}
          disabled={pending}
          onCheckedChange={async (on) => {
            setPending(true);
            try {
              await onChange(on);
            } catch (error) {
              toast.error(messageOf(error));
            } finally {
              setPending(false);
            }
          }}
        />
      </label>
      {shareUrl ? (
        <div className="flex items-center gap-2">
          <Input readOnly value={shareUrl} data-testid="share-url" aria-label="Share URL" className="bg-background" />
          <CopyButton value={shareUrl} successMessage="Link copied." size="sm" />
        </div>
      ) : null}
    </section>
  );
}
