/** The shapes the server sends and the client reads. Shared so neither side guesses. */

export type Badge = { kind: string; label: string }

export type Commit = { sha: string; author: string; date: string; subject: string; pr: string }

export type MigrationRow = {
  /** Directory name inside the migrations folder, e.g. `20260112094500_init`. */
  folder: string
  /** The `id` from `snapshot.json`. */
  id: string
  /** The folder name without its timestamp, underscores turned into spaces. */
  name: string
  /** The `prevIds` from `snapshot.json`. */
  parents: string[]
  /** Those parents resolved to folder names, or left as ids when no folder declares them. */
  parentFolders: string[]
  createdAt: string
  /** True for a parent listed in `prevIds` that no folder declares. */
  phantom: boolean
  statementCount: number
  badges: Badge[]
  /** Objects the SQL touches, deduplicated and sorted. */
  tables: string[]
  commit: Commit | null
  /** Lane geometry, in lane indices. */
  lane: number
  incoming: number[]
  outgoing: number[]
  passThrough: number[]
  isMerge: boolean
  isHead: boolean
}

export type Graph = {
  /** `https://github.com/owner/repo`, or empty when the remote is not a GitHub one. */
  repoUrl: string
  /** The migrations folder, relative to the repository root. */
  repoPath: string
  laneCount: number
  rows: MigrationRow[]
  heads: string[]
  unresolved: string[]
}

export type MigrationPayload = { folder: string; sql: string }

export type CheckBranch = {
  leafPath: string
  action: string
  target?: unknown
  statementDescription: string
}

export type CheckDetail = { parentPath: string; branches: CheckBranch[] }

export type CheckReport = {
  status?: string
  error?: { conflicts: number; details: CheckDetail[] }
}

/** What `GET /api/check` answers: the exit code, the parsed report when there is one, the raw output. */
export type CheckPayload = { code: number; report: CheckReport | null; raw: string }

/** A migrations folder the server found on disk, offered on the welcome screen. */
export type MigrationDirCandidate = {
  /** Absolute path. */
  dir: string
  /**
   * The same path, relative to where the search started when it sits inside it and absolute
   * otherwise — what to display, and what to put in a `?dir=` query.
   */
  label: string
  /**
   * How it was found: declared as `out` in a Drizzle config, recognised on disk, or handed to
   * the CLI with `--dir`.
   */
  source: 'drizzle.config' | 'disk' | 'default'
  migrations: number
}

/** One directory offered by the path field's completion. */
export type BrowseEntry = {
  name: string
  /** Absolute path. */
  dir: string
  /** The same path as a `?dir=` value: relative to the root when inside it, absolute otherwise. */
  label: string
  /** How many migrations it holds; 0 for a directory that is only on the way somewhere. */
  migrations: number
}

/** What `GET /api/browse` answers: one directory listing, its parent, and what is inside. */
export type BrowsePayload = {
  /** The directory listed, absolute. */
  path: string
  /** Its parent, absolute, or null at the root of the filesystem. */
  parent: string | null
  entries: BrowseEntry[]
}

/** What `GET /api/dirs` answers: the folders that can be served, and which one is the default. */
export type DirsPayload = {
  /**
   * The folder the server was started on, as a `?dir=` value, or null when it was started
   * without one. Which folder a page shows is decided by its URL, not by the server.
   */
  default: string | null
  /** Where the search started, absolute. */
  root: string
  candidates: MigrationDirCandidate[]
  /** The running version, for the page to show. */
  version: string
}
