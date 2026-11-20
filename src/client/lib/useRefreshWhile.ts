import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/** Reloads the page's data every few seconds while `active` (songs still generating). */
export function useRefreshWhile(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void router.invalidate(), 2000);
    return () => clearInterval(timer);
  }, [active, router]);
}
