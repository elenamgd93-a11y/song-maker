import type { ReactNode } from "react";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";

/** The frame of a share-link page, which visitors open without signing in. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border">
        <div className={`${COLUMN} flex h-12 items-center justify-between gap-3`}>
          <span className="text-sm font-medium">Song Maker</span>
          <ThemePreferenceRadio />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className={`${COLUMN} space-y-8 pt-8 pb-24 md:pt-10`}>{children}</main>
      </div>
    </div>
  );
}

const COLUMN = "mx-auto w-full max-w-3xl px-4 md:px-10";
