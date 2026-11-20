import { Link } from "@tanstack/react-router";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** The app's own pages, in the AppShell bar. */
export function AppNav() {
  return (
    <nav className="flex items-center gap-4">
      <Link to="/" className={LINK} activeOptions={{ exact: true, includeSearch: false }}>
        Library
      </Link>
      <Link to="/create" className={LINK} activeOptions={{ includeSearch: false }}>
        Create
      </Link>
      <Link to="/playlists" className={LINK}>
        Playlists
      </Link>
    </nav>
  );
}
