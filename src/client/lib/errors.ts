/** A message to show for a failed call; a validation error shows its first issue. */
export function messageOf(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return "That didn't work.";
  if (error.message.startsWith("[")) {
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (issues[0]?.message) return issues[0].message;
    } catch {
      // Not a list of issues.
    }
  }
  return error.message;
}
