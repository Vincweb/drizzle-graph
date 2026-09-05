# Changelog

## 0.1.1

- Published to npm: `npm i -D drizzle-graph`, or `npx drizzle-graph` with nothing installed. Every
  release still carries the built tarball for installs that skip the registry.

## 0.1.0

First release.

- `drizzle-graph` serves the migration DAG as a git-log-style graph on `http://127.0.0.1:4600`,
  rescanning the migrations folder on every request.
- `/` is a picker listing the migrations folders found under the working directory — those a
  `drizzle.config.*` declares as its `out`, read as text and never executed, and those that look
  like one on disk — and each opens its own graph at `/graph?dir=<path>`. The folder lives in the
  URL rather than in the server, so a graph can be reloaded, bookmarked, sent to someone with the
  same checkout, or opened in a second tab beside another folder.
- `drizzle-graph --check` exits 1 when the graph has more than one open head, and warns about
  `prevIds` entries no folder declares.
- The check panel runs `drizzle-kit check --output json` on demand and states whether the reported
  conflicts are the same statement on both branches or different statements on the same object. It
  starts the `drizzle-kit` nearest the folder in the URL, so a request another page in the browser
  fired is refused.
- The page holds up in a narrow window: rows drop columns rather than wrap, an open migration
  takes the whole screen, and the filter sits behind a magnifier. It carries a favicon, icons and a web manifest, so it can be installed
  as an app.
- The welcome screen carries the Drizzle mark, the version it is running, and a path field that
  completes against the directories the server can see, one at a time.
- No runtime dependency: the server is `node:http`, and the page — React 19, TanStack Query and
  Tailwind CSS v4 — is bundled at build time, so nothing is fetched from a CDN.
